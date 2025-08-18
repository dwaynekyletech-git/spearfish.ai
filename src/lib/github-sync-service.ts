/**
 * GitHub Sync Service
 * 
 * Background job service for scheduled GitHub data synchronization
 */

import { githubService } from './github-service';
import { githubStorageService } from './github-storage-service';
import { createServiceClient } from './supabase-server';
import { logInfo, logDebug, logWarn, logError } from './logger';
import type { 
  GitHubSyncLog, 
  GitHubSyncOptions,
  GitHubRepository 
} from '@/types/github';

interface SyncResult {
  success: boolean;
  syncLogId?: string;
  processed: number;
  failed: number;
  errors: string[];
  rateLimit?: {
    remaining: number;
    resetTime: Date;
  };
}

interface QueueItem {
  id: string;
  repositoryId: string;
  fullName: string;
  priority: number;
  retryCount: number;
  lastError?: string;
}

export class GitHubSyncService {
  private supabase = createServiceClient();
  private isRunning = false;
  private queue: QueueItem[] = [];
  private maxConcurrent = 3; // Max concurrent API calls
  private maxRetries = 3;
  private rateLimitBuffer = 200; // Keep buffer for other operations

  // =============================================================================
  // Queue Management
  // =============================================================================

  /**
   * Add repositories to sync queue
   */
  private async buildSyncQueue(options: GitHubSyncOptions): Promise<QueueItem[]> {
    const queue: QueueItem[] = [];

    if (options.repository_id) {
      // Single repository sync
      const { data: repo, error } = await this.supabase
        .from('github_repositories')
        .select('id, full_name')
        .eq('id', options.repository_id)
        .single();

      if (repo) {
        queue.push({
          id: `single-${repo.id}`,
          repositoryId: repo.id,
          fullName: repo.full_name,
          priority: 1,
          retryCount: 0,
        });
      }
    } else if (options.company_id) {
      // Company repositories sync
      const { data: repos } = await this.supabase
        .from('github_repositories')
        .select(`
          id, full_name,
          company_github_repositories!inner(
            company_id, is_primary, confidence_score
          )
        `)
        .eq('company_github_repositories.company_id', options.company_id)
        .eq('archived', false)
        .eq('disabled', false);

      repos?.forEach((repo: any) => {
        queue.push({
          id: `company-${repo.id}`,
          repositoryId: repo.id,
          fullName: repo.full_name,
          priority: repo.company_github_repositories[0]?.is_primary ? 1 : 2,
          retryCount: 0,
        });
      });
    } else {
      // Full sync - all active repositories
      const { data: repos } = await this.supabase
        .from('github_repositories')
        .select('id, full_name, last_synced_at')
        .eq('archived', false)
        .eq('disabled', false)
        .order('last_synced_at', { ascending: true })
        .limit(options.sync_type === 'incremental' ? 100 : 1000);

      repos?.forEach((repo: any, index: number) => {
        queue.push({
          id: `bulk-${repo.id}`,
          repositoryId: repo.id,
          fullName: repo.full_name,
          priority: Math.floor(index / 50) + 1, // Batch priority
          retryCount: 0,
        });
      });
    }

    // Sort by priority (lower number = higher priority)
    return queue.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Process single repository sync
   */
  private async syncRepository(item: QueueItem): Promise<{ success: boolean; error?: string }> {
    try {
      const [owner, repo] = item.fullName.split('/');
      if (!owner || !repo) {
        return { success: false, error: 'Invalid repository name format' };
      }

      // Check rate limit before processing
      const rateLimit = await githubService.getRateLimit();
      if (rateLimit.remaining < this.rateLimitBuffer) {
        const resetTime = new Date(rateLimit.reset * 1000);
        const waitTime = resetTime.getTime() - Date.now();
        
        if (waitTime > 0) {
          logWarn('Rate limit reached, waiting', { waitTimeSeconds: Math.ceil(waitTime / 1000) });
          await new Promise(resolve => setTimeout(resolve, waitTime + 1000));
        }
      }

      // Fetch and store repository data
      const result = await githubStorageService.fetchAndStoreRepository(owner, repo);
      
      if (!result.success) {
        return { success: false, error: result.error };
      }

      logDebug('Repository synced', { fullName: item.fullName, stars: result.data?.repository.stars_count });
      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
      console.error(`❌ Failed to sync ${item.fullName}:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Process queue with concurrency control and retry logic
   */
  private async processQueue(queue: QueueItem[], syncLogId: string): Promise<{
    processed: number;
    failed: number;
    errors: string[];
  }> {
    const results = {
      processed: 0,
      failed: 0,
      errors: [] as string[],
    };

    const processing = new Set<Promise<void>>();
    let queueIndex = 0;

    while (queueIndex < queue.length || processing.size > 0) {
      // Start new jobs up to maxConcurrent
      while (processing.size < this.maxConcurrent && queueIndex < queue.length) {
        const item = queue[queueIndex++];
        
        const job = this.syncRepository(item).then(async (result) => {
          if (result.success) {
            results.processed++;
          } else {
            // Retry logic
            if (item.retryCount < this.maxRetries) {
              item.retryCount++;
              item.lastError = result.error;
              logDebug('Retrying repository sync', { fullName: item.fullName, attempt: item.retryCount, maxRetries: this.maxRetries });
              queue.push(item); // Add back to end of queue
            } else {
              results.failed++;
              results.errors.push(`${item.fullName}: ${result.error}`);
            }
          }

          // Update sync log progress
          await this.supabase
            .from('github_sync_logs')
            .update({
              repositories_processed: results.processed,
              repositories_total: queue.length,
            })
            .eq('id', syncLogId);
        });

        processing.add(job);
        job.finally(() => processing.delete(job));
      }

      // Wait for at least one job to complete
      if (processing.size > 0) {
        await Promise.race(processing);
      }
    }

    return results;
  }

  // =============================================================================
  // Public Sync Methods
  // =============================================================================

  /**
   * Execute GitHub data synchronization
   */
  async executeSync(options: GitHubSyncOptions): Promise<SyncResult> {
    if (this.isRunning) {
      return {
        success: false,
        processed: 0,
        failed: 0,
        errors: ['Sync job already running'],
      };
    }

    this.isRunning = true;
    let syncLog: GitHubSyncLog | null = null;

    try {
      // Create sync log
      const syncLogResult = await githubStorageService.createSyncLog(options);
      if (!syncLogResult.success) {
        throw new Error(`Failed to create sync log: ${syncLogResult.error}`);
      }

      syncLog = syncLogResult.data!;
      logInfo('Starting sync', { syncType: options.sync_type, syncLogId: syncLog.id });

      // Build sync queue
      const queue = await this.buildSyncQueue(options);
      logInfo('Sync queue built', { repositoryCount: queue.length });

      if (queue.length === 0) {
        await githubStorageService.updateSyncLog(syncLog.id, {
          status: 'completed',
          repositories_total: 0,
          repositories_processed: 0,
        });

        return {
          success: true,
          syncLogId: syncLog.id,
          processed: 0,
          failed: 0,
          errors: [],
        };
      }

      // Update sync log with total count
      await this.supabase
        .from('github_sync_logs')
        .update({ repositories_total: queue.length })
        .eq('id', syncLog.id);

      // Process queue
      const results = await this.processQueue(queue, syncLog.id);

      // Get final rate limit status
      const finalRateLimit = await githubService.getRateLimit();

      // Update sync log with completion status
      const finalStatus = results.failed === 0 ? 'completed' : 
                         results.processed > 0 ? 'partial' : 'failed';

      await githubStorageService.updateSyncLog(syncLog.id, {
        status: finalStatus,
        repositories_processed: results.processed,
        repositories_total: queue.length,
        error_message: results.errors.length > 0 ? results.errors.join('; ') : undefined,
        rate_limit_remaining: finalRateLimit.remaining,
      });

      logInfo('Sync completed', { processed: results.processed, failed: results.failed });

      return {
        success: results.failed === 0 || results.processed > 0,
        syncLogId: syncLog.id,
        processed: results.processed,
        failed: results.failed,
        errors: results.errors,
        rateLimit: {
          remaining: finalRateLimit.remaining,
          resetTime: new Date(finalRateLimit.reset * 1000),
        },
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
      console.error('❌ Sync failed:', errorMessage);

      if (syncLog) {
        await githubStorageService.updateSyncLog(syncLog.id, {
          status: 'failed',
          error_message: errorMessage,
        });
      }

      return {
        success: false,
        syncLogId: syncLog?.id,
        processed: 0,
        failed: 0,
        errors: [errorMessage],
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Execute daily sync for all repositories
   */
  async executeDailySync(): Promise<SyncResult> {
    logInfo('Starting daily GitHub sync');
    
    return this.executeSync({
      sync_type: 'incremental',
      batch_size: 100,
    });
  }

  /**
   * Execute full sync for all repositories (use sparingly)
   */
  async executeFullSync(): Promise<SyncResult> {
    logInfo('Starting full GitHub sync');
    
    return this.executeSync({
      sync_type: 'full',
      force_refresh: true,
    });
  }

  /**
   * Sync repositories for a specific company
   */
  async syncCompanyRepositories(companyId: string): Promise<SyncResult> {
    logInfo('Starting company sync', { companyId });
    
    return this.executeSync({
      sync_type: 'incremental',
      company_id: companyId,
    });
  }

  /**
   * Sync a specific repository
   */
  async syncSingleRepository(repositoryId: string): Promise<SyncResult> {
    logInfo('Starting single repository sync', { repositoryId });
    
    return this.executeSync({
      sync_type: 'repository',
      repository_id: repositoryId,
    });
  }

  // =============================================================================
  // Monitoring and Status
  // =============================================================================

  /**
   * Get current sync status
   */
  getSyncStatus(): {
    isRunning: boolean;
    queueSize: number;
  } {
    return {
      isRunning: this.isRunning,
      queueSize: this.queue.length,
    };
  }

  /**
   * Get recent sync logs
   */
  async getRecentSyncLogs(limit = 10): Promise<GitHubSyncLog[]> {
    const { data, error } = await this.supabase
      .from('github_sync_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch sync logs:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get sync statistics
   */
  async getSyncStatistics(): Promise<{
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    averageDuration: number;
    lastSyncAt?: string;
    repositoriesTracked: number;
  }> {
    const [syncStats, repoCount] = await Promise.all([
      this.supabase
        .from('github_sync_logs')
        .select('status, duration_seconds, completed_at')
        .order('started_at', { ascending: false })
        .limit(100),
      this.supabase
        .from('github_repositories')
        .select('id', { count: 'exact' })
        .eq('archived', false)
        .eq('disabled', false)
    ]);

    const logs = syncStats.data || [];
    const totalSyncs = logs.length;
    const successfulSyncs = logs.filter(log => log.status === 'completed').length;
    const failedSyncs = logs.filter(log => log.status === 'failed').length;
    const completedLogs = logs.filter(log => log.duration_seconds);
    const averageDuration = completedLogs.length > 0 
      ? completedLogs.reduce((sum, log) => sum + (log.duration_seconds || 0), 0) / completedLogs.length
      : 0;

    return {
      totalSyncs,
      successfulSyncs,
      failedSyncs,
      averageDuration,
      lastSyncAt: logs[0]?.completed_at,
      repositoriesTracked: repoCount.count || 0,
    };
  }
}

// Export singleton instance
export const githubSyncService = new GitHubSyncService();