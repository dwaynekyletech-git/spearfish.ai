/**
 * Apify Integration Service
 * 
 * Service for connecting to Apify API and fetching Y Combinator company data.
 * Handles authentication, data retrieval, cost tracking, and error handling.
 * 
 * Features:
 * - Direct dataset fetching from Apify
 * - Actor execution for fresh data
 * - Paginated data retrieval 
 * - Cost tracking and API usage monitoring
 * - Error handling with retry logic
 */

import { ApifyClient } from 'apify-client';
import { z } from 'zod';
import { createServiceClient } from './supabase-server';
import { logInfo, logDebug, logWarn, logError } from './logger';

// =============================================================================
// Type Definitions
// =============================================================================

export interface ApifyConfig {
  token: string;
  actorId?: string;
  datasetId?: string;
}

export interface ApifyDatasetOptions {
  limit?: number;
  offset?: number;
  clean?: boolean;
  format?: 'json' | 'csv' | 'xlsx' | 'html' | 'xml' | 'rss';
}

export interface ApifyUsageStats {
  itemsRetrieved: number;
  costUsd: number;
  requestCount: number;
  processingTimeMs: number;
}

export interface ApifyServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  usage: ApifyUsageStats;
}

// =============================================================================
// Apify Service Class
// =============================================================================

export class ApifyService {
  private client: ApifyClient;
  private supabase;
  private config: ApifyConfig;

  constructor(config: ApifyConfig) {
    this.config = config;
    this.client = new ApifyClient({ token: config.token });
    this.supabase = createServiceClient();
  }

  /**
   * Test connection to Apify API
   */
  async testConnection(): Promise<boolean> {
    try {
      logDebug('Testing Apify API connection...');
      
      // Try to get user info to verify authentication
      const user = await this.client.user().get();
      if (user) {
        logInfo(`Connected to Apify as user: ${user.username || 'Unknown'}`);
        return true;
      }
      
      return false;
    } catch (error) {
      logError('Failed to connect to Apify API', { error });
      return false;
    }
  }

  /**
   * Fetch data from a specific dataset
   */
  async fetchDataset<T = any>(
    datasetId?: string, 
    options: ApifyDatasetOptions = {}
  ): Promise<ApifyServiceResult<T[]>> {
    const startTime = Date.now();
    const targetDatasetId = datasetId || this.config.datasetId;
    
    if (!targetDatasetId) {
      return {
        success: false,
        error: 'No dataset ID provided',
        usage: this.createEmptyUsage(startTime)
      };
    }

    try {
      logInfo(`Fetching data from Apify dataset: ${targetDatasetId}`);
      logDebug('Fetch options:', options);

      // Get dataset info first
      const datasetInfo = await this.client.dataset(targetDatasetId).get();
      if (!datasetInfo) {
        throw new Error(`Dataset ${targetDatasetId} not found`);
      }

      logInfo(`Dataset info - Items: ${datasetInfo.itemCount}, Size: ${datasetInfo.cleanItemCount || 'unknown'} clean items`);

      // Fetch items with pagination support
      const { items } = await this.client.dataset(targetDatasetId).listItems({
        limit: options.limit || 10000, // Default to 10k items
        offset: options.offset || 0,
        clean: options.clean !== false // Default to clean items
      });

      const processingTime = Date.now() - startTime;
      const itemCount = Array.isArray(items) ? items.length : 0;

      logInfo(`Successfully fetched ${itemCount} items from dataset`);

      // Track API usage
      const usage: ApifyUsageStats = {
        itemsRetrieved: itemCount,
        costUsd: this.estimateDatasetCost(itemCount),
        requestCount: 1,
        processingTimeMs: processingTime
      };

      await this.trackApiUsage(usage, { 
        operation: 'dataset_fetch',
        datasetId: targetDatasetId,
        itemCount 
      });

      return {
        success: true,
        data: items as T[],
        usage
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logError(`Failed to fetch dataset ${targetDatasetId}`, { error, processingTime });

      return {
        success: false,
        error: errorMessage,
        usage: this.createEmptyUsage(startTime)
      };
    }
  }

  /**
   * Run an actor and get its output dataset
   */
  async runActor(
    actorId?: string, 
    input: Record<string, any> = {}
  ): Promise<ApifyServiceResult<string>> {
    const startTime = Date.now();
    const targetActorId = actorId || this.config.actorId;
    
    if (!targetActorId) {
      return {
        success: false,
        error: 'No actor ID provided',
        usage: this.createEmptyUsage(startTime)
      };
    }

    try {
      logInfo(`Running Apify actor: ${targetActorId}`);
      logDebug('Actor input:', input);

      // Run the actor
      const run = await this.client.actor(targetActorId).call(input);
      
      if (!run) {
        throw new Error('Actor run failed - no run object returned');
      }

      const processingTime = Date.now() - startTime;

      logInfo(`Actor run completed - Status: ${run.status}, Dataset: ${run.defaultDatasetId}`);

      // Estimate cost based on compute units and items processed
      const usage: ApifyUsageStats = {
        itemsRetrieved: 0, // Will be known when dataset is fetched
        costUsd: this.estimateActorCost(run),
        requestCount: 1,
        processingTimeMs: processingTime
      };

      await this.trackApiUsage(usage, { 
        operation: 'actor_run',
        actorId: targetActorId,
        runId: run.id,
        status: run.status
      });

      return {
        success: true,
        data: run.defaultDatasetId,
        usage
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logError(`Failed to run actor ${targetActorId}`, { error, processingTime });

      return {
        success: false,
        error: errorMessage,
        usage: this.createEmptyUsage(startTime)
      };
    }
  }

  /**
   * Get the latest dataset from the configured actor
   */
  async getLatestDataset<T = any>(
    options: ApifyDatasetOptions = {}
  ): Promise<ApifyServiceResult<T[]>> {
    try {
      const actorId = this.config.actorId;
      if (!actorId) {
        return {
          success: false,
          error: 'No actor ID configured for fetching latest dataset',
          usage: this.createEmptyUsage(Date.now())
        };
      }

      logInfo(`Getting latest dataset from actor: ${actorId}`);

      // Get the actor's last run
      const runs = await this.client.actor(actorId).runs().list({ limit: 1, status: 'SUCCEEDED' });
      
      if (!runs.items || runs.items.length === 0) {
        throw new Error('No successful runs found for the actor');
      }

      const latestRun = runs.items[0];
      const datasetId = latestRun.defaultDatasetId;

      if (!datasetId) {
        throw new Error('Latest run has no dataset');
      }

      logInfo(`Using dataset from latest run: ${datasetId} (${latestRun.finishedAt})`);

      // Fetch the dataset
      return await this.fetchDataset<T>(datasetId, options);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logError('Failed to get latest dataset', { error });

      return {
        success: false,
        error: errorMessage,
        usage: this.createEmptyUsage(Date.now())
      };
    }
  }

  /**
   * Track API usage in the database
   */
  private async trackApiUsage(
    usage: ApifyUsageStats, 
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('api_usage_log')
        .insert({
          service: 'apify',
          cost_usd: usage.costUsd,
          items_processed: usage.itemsRetrieved,
          metadata: {
            requestCount: usage.requestCount,
            processingTimeMs: usage.processingTimeMs,
            ...metadata
          }
        });

      if (error) {
        logWarn('Failed to track API usage', { error });
      }
    } catch (error) {
      logWarn('Failed to track API usage', { error });
    }
  }

  /**
   * Estimate cost for dataset operations (rough estimation)
   */
  private estimateDatasetCost(itemCount: number): number {
    // Apify dataset reads are generally free, but we'll add a small cost for tracking
    // This is a placeholder - adjust based on actual Apify pricing
    return Math.max(0.01, itemCount * 0.0001); // $0.0001 per item, min $0.01
  }

  /**
   * Estimate cost for actor runs (rough estimation)
   */
  private estimateActorCost(run: any): number {
    // Estimate based on compute units and run time
    // This is a placeholder - adjust based on actual Apify pricing
    const computeUnits = run.options?.computeUnits || 1;
    const runtimeMs = run.stats?.runTimeSecs ? run.stats.runTimeSecs * 1000 : 60000;
    
    // Rough estimate: $0.25 per compute unit hour
    return Math.max(0.01, (computeUnits * (runtimeMs / 3600000)) * 0.25);
  }

  /**
   * Create empty usage stats
   */
  private createEmptyUsage(startTime: number): ApifyUsageStats {
    return {
      itemsRetrieved: 0,
      costUsd: 0,
      requestCount: 0,
      processingTimeMs: Date.now() - startTime
    };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create an ApifyService instance with environment configuration
 */
export function createApifyService(): ApifyService {
  const token = process.env.APIFY_API_TOKEN;
  
  if (!token) {
    throw new Error('APIFY_API_TOKEN environment variable is required');
  }

  const config: ApifyConfig = {
    token,
    actorId: process.env.APIFY_ACTOR_ID || undefined,
    datasetId: process.env.APIFY_DATASET_ID || undefined
  };

  return new ApifyService(config);
}

// =============================================================================
// Validation Schema
// =============================================================================

export const ApifyConfigSchema = z.object({
  token: z.string().min(1, 'API token is required'),
  actorId: z.string().optional(),
  datasetId: z.string().optional()
});

/**
 * Validate Apify configuration
 */
export function validateApifyConfig(config: unknown): ApifyConfig {
  return ApifyConfigSchema.parse(config);
}