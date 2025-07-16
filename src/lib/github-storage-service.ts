/**
 * GitHub Storage Service
 * 
 * Service for storing GitHub repository data and metrics in Supabase
 */

import { createServiceClient } from './supabase-server';
import { githubService, GitHubRepository as APIRepository, GitHubRepositoryStats } from './github-service';
import type { 
  GitHubRepository, 
  GitHubRepositoryMetrics, 
  GitHubRepositoryLanguage,
  CompanyGitHubRepository,
  GitHubSyncLog,
  CreateGitHubRepositoryInput,
  CreateRepositoryMetricsInput,
  CreateCompanyRepositoryAssociationInput,
  GitHubSyncOptions
} from '@/types/github';

interface StorageResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface BatchStorageResult {
  success: boolean;
  total: number;
  successful: number;
  failed: number;
  errors: string[];
}

export class GitHubStorageService {
  private supabase = createServiceClient();

  // =============================================================================
  // Repository Storage
  // =============================================================================

  /**
   * Store or update a repository from GitHub API data
   */
  async storeRepository(apiRepo: APIRepository): Promise<StorageResult<GitHubRepository>> {
    try {
      const repoData: CreateGitHubRepositoryInput = {
        github_id: apiRepo.id,
        full_name: apiRepo.full_name,
        name: apiRepo.name,
        owner: apiRepo.owner,
        description: apiRepo.description,
        html_url: apiRepo.html_url,
        language: apiRepo.language,
        stars_count: apiRepo.stars_count,
        forks_count: apiRepo.forks_count,
        open_issues_count: apiRepo.open_issues_count,
        size: apiRepo.size,
        archived: apiRepo.archived,
        disabled: apiRepo.disabled,
        private: apiRepo.private,
        created_at_github: apiRepo.created_at,
        updated_at_github: apiRepo.updated_at,
        pushed_at_github: apiRepo.pushed_at,
      };

      // Use upsert to handle both insert and update
      const { data, error } = await this.supabase
        .from('github_repositories')
        .upsert(repoData, { 
          onConflict: 'github_id',
          ignoreDuplicates: false 
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      // Update last_synced_at
      await this.supabase
        .from('github_repositories')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', data.id);

      return { success: true, data };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error storing repository'
      };
    }
  }

  /**
   * Store repository metrics for historical tracking
   */
  async storeRepositoryMetrics(
    repositoryId: string, 
    metricsData: Omit<CreateRepositoryMetricsInput, 'repository_id'>
  ): Promise<StorageResult<GitHubRepositoryMetrics>> {
    try {
      const { data, error } = await this.supabase
        .from('github_repository_metrics')
        .insert({
          repository_id: repositoryId,
          ...metricsData,
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error storing metrics'
      };
    }
  }

  /**
   * Store repository languages breakdown
   */
  async storeRepositoryLanguages(
    repositoryId: string, 
    languages: Record<string, number>
  ): Promise<StorageResult<GitHubRepositoryLanguage[]>> {
    try {
      // Calculate total bytes
      const totalBytes = Object.values(languages).reduce((sum, bytes) => sum + bytes, 0);
      
      if (totalBytes === 0) {
        return { success: true, data: [] };
      }

      // Transform to language records with percentages
      const languageRecords = Object.entries(languages).map(([language, bytes]) => ({
        repository_id: repositoryId,
        language,
        bytes_count: bytes,
        percentage: Number(((bytes / totalBytes) * 100).toFixed(2)),
      }));

      // Delete existing languages for this repository
      await this.supabase
        .from('github_repository_languages')
        .delete()
        .eq('repository_id', repositoryId);

      // Insert new languages
      const { data, error } = await this.supabase
        .from('github_repository_languages')
        .insert(languageRecords)
        .select();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error storing languages'
      };
    }
  }

  // =============================================================================
  // Company Association
  // =============================================================================

  /**
   * Associate a repository with a company
   */
  async associateRepositoryWithCompany(
    associationData: CreateCompanyRepositoryAssociationInput
  ): Promise<StorageResult<CompanyGitHubRepository>> {
    try {
      const { data, error } = await this.supabase
        .from('company_github_repositories')
        .upsert(associationData, { 
          onConflict: 'company_id,repository_id',
          ignoreDuplicates: false 
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error creating association'
      };
    }
  }

  // =============================================================================
  // High-Level Storage Operations
  // =============================================================================

  /**
   * Fetch repository from GitHub API and store with full metrics
   */
  async fetchAndStoreRepository(owner: string, repo: string): Promise<StorageResult<{
    repository: GitHubRepository;
    metrics: GitHubRepositoryMetrics;
    languages: GitHubRepositoryLanguage[];
  }>> {
    try {
      // Check rate limit
      if (!(await githubService.checkRateLimit(4))) {
        return { 
          success: false, 
          error: 'Insufficient GitHub API rate limit for full repository fetch' 
        };
      }

      // Fetch repository stats from GitHub API
      const repoStats = await githubService.getRepositoryStats(owner, repo);

      // Store repository
      const repoResult = await this.storeRepository(repoStats.repository);
      if (!repoResult.success) {
        return { success: false, error: `Failed to store repository: ${repoResult.error}` };
      }

      const storedRepo = repoResult.data!;

      // Store metrics
      const metricsResult = await this.storeRepositoryMetrics(storedRepo.id, {
        stars_count: repoStats.repository.stars_count,
        forks_count: repoStats.repository.forks_count,
        open_issues_count: repoStats.repository.open_issues_count,
        size: repoStats.repository.size,
        contributors_count: repoStats.contributors_count,
        commit_count_last_year: repoStats.commit_count_last_year,
        releases_count: repoStats.releases_count,
      });

      if (!metricsResult.success) {
        return { success: false, error: `Failed to store metrics: ${metricsResult.error}` };
      }

      // Store languages
      const languagesResult = await this.storeRepositoryLanguages(storedRepo.id, repoStats.languages);
      if (!languagesResult.success) {
        return { success: false, error: `Failed to store languages: ${languagesResult.error}` };
      }

      return {
        success: true,
        data: {
          repository: storedRepo,
          metrics: metricsResult.data!,
          languages: languagesResult.data!,
        }
      };

    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return { success: false, error: `Repository ${owner}/${repo} not found or is private` };
      }
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error fetching repository'
      };
    }
  }

  /**
   * Fetch and store multiple repositories for a company
   */
  async fetchAndStoreCompanyRepositories(
    companyId: string,
    repositoryNames: string[],
    options: {
      discoveryMethod?: 'manual' | 'search' | 'api' | 'website';
      markPrimary?: string; // full_name of primary repository
    } = {}
  ): Promise<BatchStorageResult> {
    const results = {
      success: true,
      total: repositoryNames.length,
      successful: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const fullName of repositoryNames) {
      try {
        const [owner, repo] = fullName.split('/');
        if (!owner || !repo) {
          results.failed++;
          results.errors.push(`Invalid repository name format: ${fullName}`);
          continue;
        }

        // Fetch and store repository
        const fetchResult = await this.fetchAndStoreRepository(owner, repo);
        if (!fetchResult.success) {
          results.failed++;
          results.errors.push(`${fullName}: ${fetchResult.error}`);
          continue;
        }

        // Associate with company
        const associationResult = await this.associateRepositoryWithCompany({
          company_id: companyId,
          repository_id: fetchResult.data!.repository.id,
          is_primary: fullName === options.markPrimary,
          discovery_method: options.discoveryMethod || 'manual',
          confidence_score: 1.0,
        });

        if (!associationResult.success) {
          results.failed++;
          results.errors.push(`${fullName} association: ${associationResult.error}`);
          continue;
        }

        results.successful++;

      } catch (error) {
        results.failed++;
        results.errors.push(`${fullName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (results.failed > 0) {
      results.success = results.successful > 0; // Partial success if some succeeded
    }

    return results;
  }

  // =============================================================================
  // Data Retrieval
  // =============================================================================

  /**
   * Get repository with latest metrics and languages
   */
  async getRepositoryWithMetrics(repositoryId: string): Promise<StorageResult<{
    repository: GitHubRepository;
    latestMetrics?: GitHubRepositoryMetrics;
    languages: GitHubRepositoryLanguage[];
  }>> {
    try {
      // Get repository
      const { data: repository, error: repoError } = await this.supabase
        .from('github_repositories')
        .select('*')
        .eq('id', repositoryId)
        .single();

      if (repoError) {
        return { success: false, error: repoError.message };
      }

      // Get latest metrics
      const { data: latestMetrics } = await this.supabase
        .from('github_repository_metrics')
        .select('*')
        .eq('repository_id', repositoryId)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single();

      // Get languages
      const { data: languages } = await this.supabase
        .from('github_repository_languages')
        .select('*')
        .eq('repository_id', repositoryId)
        .order('percentage', { ascending: false });

      return {
        success: true,
        data: {
          repository,
          latestMetrics: latestMetrics || undefined,
          languages: languages || [],
        }
      };

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error retrieving repository'
      };
    }
  }

  /**
   * Get repositories for a company
   */
  async getCompanyRepositories(companyId: string): Promise<StorageResult<GitHubRepository[]>> {
    try {
      const { data, error } = await this.supabase
        .from('github_repositories')
        .select(`
          *,
          company_github_repositories!inner(
            company_id,
            is_primary,
            confidence_score
          )
        `)
        .eq('company_github_repositories.company_id', companyId)
        .eq('archived', false)
        .eq('disabled', false)
        .order('company_github_repositories.is_primary', { ascending: false })
        .order('stars_count', { ascending: false });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error retrieving company repositories'
      };
    }
  }

  // =============================================================================
  // Sync Logging
  // =============================================================================

  /**
   * Create a sync log entry
   */
  async createSyncLog(options: GitHubSyncOptions): Promise<StorageResult<GitHubSyncLog>> {
    try {
      const { data, error } = await this.supabase
        .from('github_sync_logs')
        .insert({
          sync_type: options.sync_type,
          repository_id: options.repository_id || null,
          company_id: options.company_id || null,
          status: 'running',
          repositories_total: 0,
          repositories_processed: 0,
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error creating sync log'
      };
    }
  }

  /**
   * Update sync log with completion status
   */
  async updateSyncLog(
    syncLogId: string, 
    updates: {
      status: 'completed' | 'failed' | 'partial';
      repositories_processed?: number;
      repositories_total?: number;
      error_message?: string;
      rate_limit_remaining?: number;
    }
  ): Promise<StorageResult<GitHubSyncLog>> {
    try {
      const { data, error } = await this.supabase
        .from('github_sync_logs')
        .update({
          ...updates,
          completed_at: new Date().toISOString(),
          duration_seconds: Math.floor((Date.now() - new Date().getTime()) / 1000),
        })
        .eq('id', syncLogId)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error updating sync log'
      };
    }
  }
}

// Export singleton instance
export const githubStorageService = new GitHubStorageService();