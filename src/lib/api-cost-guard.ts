/**
 * API Cost Guard Service
 * 
 * This service enforces daily API spending limits to prevent cost overruns.
 * Features:
 * - Per-user and global daily cost tracking
 * - Cost estimation before API calls
 * - Circuit breaker pattern for cost overruns
 * - Configurable cost limits via environment variables
 * - Real-time cost monitoring with Redis
 */

import { Redis } from '@upstash/redis';
import { getValidatedEnv } from './env-validation';
import { logInfo, logWarn, logError, logDebug } from './logger';

export interface CostEstimate {
  estimatedCostUSD: number;
  provider: 'openai' | 'perplexity';
  model: string;
  inputTokens: number;
  outputTokens: number;
  details: string;
}

export interface CostCheckResult {
  allowed: boolean;
  reason?: string;
  currentDailyCost: number;
  remainingBudget: number;
  estimatedCost: number;
  limitType?: 'user' | 'global';
}

export interface DailyCostSummary {
  userId?: string;
  date: string;
  totalCostUSD: number;
  requestCount: number;
  providerBreakdown: Record<string, { cost: number; requests: number }>;
  lastUpdated: Date;
}

// Model pricing in USD per 1K tokens (as of 2024)
export const MODEL_PRICING = {
  // OpenAI GPT-4o
  'gpt-4o': { input: 0.0025, output: 0.01 },
  
  // OpenAI GPT-4o-mini (cost-effective)
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  
  // OpenAI GPT-3.5-turbo (cheapest)
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  
  // Perplexity models
  'sonar-pro': { input: 0.001, output: 0.001 },
  'sonar': { input: 0.0005, output: 0.0005 },
  'sonar-medium': { input: 0.0015, output: 0.0015 },
  'sonar-deep-research': { input: 0.001, output: 0.001 }, // Estimated
} as const;

export type ModelName = keyof typeof MODEL_PRICING;

export class ApiCostGuard {
  private redis: Redis;
  private maxDailyCostUSD: number;
  private maxUserDailyCostUSD: number;
  private isConnected: boolean = false;

  constructor() {
    const env = getValidatedEnv();
    
    this.maxDailyCostUSD = typeof env.MAX_DAILY_API_COST_USD === 'string' 
      ? parseFloat(env.MAX_DAILY_API_COST_USD) 
      : env.MAX_DAILY_API_COST_USD;
    
    this.maxUserDailyCostUSD = typeof env.MAX_USER_DAILY_COST_USD === 'string'
      ? parseFloat(env.MAX_USER_DAILY_COST_USD)
      : env.MAX_USER_DAILY_COST_USD;

    // Initialize Redis connection
    const redisUrl = process.env.UPSTASH_REDIS_URL;
    const redisToken = process.env.UPSTASH_REDIS_TOKEN;

    if (!redisUrl || !redisToken) {
      logWarn('Redis credentials not found - cost tracking will be limited', {
        hasUrl: !!redisUrl,
        hasToken: !!redisToken
      });
      this.redis = this.createMockRedis();
      return;
    }

    this.redis = new Redis({
      url: redisUrl,
      token: redisToken,
      retry: {
        retries: 3,
        backoff: (retryCount) => Math.min(1000 * Math.pow(2, retryCount), 3000),
      },
    });

    this.initializeConnection();
    
    logInfo('API Cost Guard initialized', {
      maxDailyCostUSD: this.maxDailyCostUSD,
      maxUserDailyCostUSD: this.maxUserDailyCostUSD
    });
  }

  private async initializeConnection(): Promise<void> {
    try {
      await this.redis.ping();
      this.isConnected = true;
      logDebug('Cost Guard Redis connection established');
    } catch (error) {
      logError('Failed to connect to Redis for cost tracking', { 
        error: error instanceof Error ? error.message : error 
      });
      this.isConnected = false;
      this.redis = this.createMockRedis();
    }
  }

  private createMockRedis(): any {
    return {
      get: async () => null,
      set: async () => 'OK',
      incrbyfloat: async () => 0,
      expire: async () => 1,
      ping: async () => 'PONG',
    };
  }

  /**
   * Generate Redis keys for cost tracking
   */
  private getDailyKey(prefix: string, userId?: string): string {
    const today = new Date().toISOString().split('T')[0];
    return userId ? `${prefix}:${userId}:${today}` : `${prefix}:global:${today}`;
  }

  /**
   * Estimate the cost of an API call
   */
  estimateCost(
    model: string,
    inputTokens: number,
    outputTokens: number = 0,
    provider: 'openai' | 'perplexity' = 'openai'
  ): CostEstimate {
    const normalizedModel = model.toLowerCase() as ModelName;
    const pricing = MODEL_PRICING[normalizedModel];

    if (!pricing) {
      logWarn(`Unknown model pricing for ${model}, using default rates`, { model, provider });
      // Default to GPT-4o pricing as conservative estimate
      const defaultPricing = MODEL_PRICING['gpt-4o'];
      const estimatedCost = (inputTokens * defaultPricing.input + outputTokens * defaultPricing.output) / 1000;
      
      return {
        estimatedCostUSD: estimatedCost,
        provider,
        model,
        inputTokens,
        outputTokens,
        details: `Unknown model, estimated using GPT-4o rates: $${estimatedCost.toFixed(6)}`
      };
    }

    const estimatedCost = (inputTokens * pricing.input + outputTokens * pricing.output) / 1000;

    return {
      estimatedCostUSD: estimatedCost,
      provider,
      model,
      inputTokens,
      outputTokens,
      details: `${inputTokens} input + ${outputTokens} output tokens at $${pricing.input}/$${pricing.output} per 1K`
    };
  }

  /**
   * Check if an API call is within cost limits
   */
  async checkCostLimit(
    estimatedCost: number,
    userId?: string
  ): Promise<CostCheckResult> {
    try {
      // Get current daily costs
      const userDailyCost = userId ? await this.getDailyCost(userId) : 0;
      const globalDailyCost = await this.getDailyCost();

      // Check user limit first (if applicable)
      if (userId && userDailyCost + estimatedCost > this.maxUserDailyCostUSD) {
        const remainingBudget = Math.max(0, this.maxUserDailyCostUSD - userDailyCost);
        
        logWarn('User daily cost limit would be exceeded', {
          userId,
          currentCost: userDailyCost,
          estimatedCost,
          limit: this.maxUserDailyCostUSD,
          remainingBudget
        });

        return {
          allowed: false,
          reason: `Daily limit exceeded: $${userDailyCost.toFixed(2)} of $${this.maxUserDailyCostUSD} used`,
          currentDailyCost: userDailyCost,
          remainingBudget,
          estimatedCost,
          limitType: 'user'
        };
      }

      // Check global limit
      if (globalDailyCost + estimatedCost > this.maxDailyCostUSD) {
        const remainingBudget = Math.max(0, this.maxDailyCostUSD - globalDailyCost);
        
        logWarn('Global daily cost limit would be exceeded', {
          currentCost: globalDailyCost,
          estimatedCost,
          limit: this.maxDailyCostUSD,
          remainingBudget
        });

        return {
          allowed: false,
          reason: `Global daily limit exceeded: $${globalDailyCost.toFixed(2)} of $${this.maxDailyCostUSD} used`,
          currentDailyCost: globalDailyCost,
          remainingBudget,
          estimatedCost,
          limitType: 'global'
        };
      }

      // Cost check passed
      const currentCost = userId ? userDailyCost : globalDailyCost;
      const limit = userId ? this.maxUserDailyCostUSD : this.maxDailyCostUSD;
      const remainingBudget = limit - currentCost;

      return {
        allowed: true,
        currentDailyCost: currentCost,
        remainingBudget,
        estimatedCost
      };

    } catch (error) {
      logError('Cost limit check failed', { 
        error: error instanceof Error ? error.message : error,
        userId,
        estimatedCost
      });

      // In case of error, allow the request but log the issue
      return {
        allowed: true,
        currentDailyCost: 0,
        remainingBudget: userId ? this.maxUserDailyCostUSD : this.maxDailyCostUSD,
        estimatedCost,
        reason: 'Cost check failed - allowing request'
      };
    }
  }

  /**
   * Record actual API cost after the call
   */
  async recordCost(
    actualCost: number,
    provider: 'openai' | 'perplexity',
    model: string,
    userId?: string
  ): Promise<void> {
    if (!this.isConnected) {
      logDebug('Redis not connected, skipping cost recording');
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Record user cost if userId provided
      if (userId) {
        const userCostKey = this.getDailyKey('cost', userId);
        const userCountKey = this.getDailyKey('count', userId);
        const userProviderKey = this.getDailyKey(`cost:${provider}`, userId);

        await Promise.all([
          this.redis.incrbyfloat(userCostKey, actualCost),
          this.redis.incrbyfloat(userCountKey, 1),
          this.redis.incrbyfloat(userProviderKey, actualCost),
          this.redis.expire(userCostKey, 86400 * 7), // Keep for 7 days
          this.redis.expire(userCountKey, 86400 * 7),
          this.redis.expire(userProviderKey, 86400 * 7),
        ]);
      }

      // Record global cost
      const globalCostKey = this.getDailyKey('cost');
      const globalCountKey = this.getDailyKey('count');
      const globalProviderKey = this.getDailyKey(`cost:${provider}`);

      await Promise.all([
        this.redis.incrbyfloat(globalCostKey, actualCost),
        this.redis.incrbyfloat(globalCountKey, 1),
        this.redis.incrbyfloat(globalProviderKey, actualCost),
        this.redis.expire(globalCostKey, 86400 * 7),
        this.redis.expire(globalCountKey, 86400 * 7),
        this.redis.expire(globalProviderKey, 86400 * 7),
      ]);

      logDebug('API cost recorded', {
        actualCost,
        provider,
        model,
        userId: userId ? `${userId.substring(0, 8)}...` : 'global',
        date: today
      });

    } catch (error) {
      logError('Failed to record API cost', { 
        error: error instanceof Error ? error.message : error,
        actualCost,
        provider,
        model,
        userId
      });
    }
  }

  /**
   * Get current daily cost for user or global
   */
  async getDailyCost(userId?: string): Promise<number> {
    if (!this.isConnected) {
      return 0;
    }

    try {
      const costKey = this.getDailyKey('cost', userId);
      const cost = await this.redis.get(costKey);
      return typeof cost === 'number' ? cost : 0;
    } catch (error) {
      logError('Failed to get daily cost', { 
        error: error instanceof Error ? error.message : error,
        userId
      });
      return 0;
    }
  }

  /**
   * Get comprehensive daily cost summary
   */
  async getDailyCostSummary(userId?: string): Promise<DailyCostSummary> {
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const costKey = this.getDailyKey('cost', userId);
      const countKey = this.getDailyKey('count', userId);
      const openaiKey = this.getDailyKey('cost:openai', userId);
      const perplexityKey = this.getDailyKey('cost:perplexity', userId);

      const [totalCost, requestCount, openaiCost, perplexityCost] = await Promise.all([
        this.redis.get(costKey),
        this.redis.get(countKey),
        this.redis.get(openaiKey),
        this.redis.get(perplexityKey),
      ]);

      return {
        userId,
        date: today,
        totalCostUSD: typeof totalCost === 'number' ? totalCost : 0,
        requestCount: typeof requestCount === 'number' ? requestCount : 0,
        providerBreakdown: {
          openai: {
            cost: typeof openaiCost === 'number' ? openaiCost : 0,
            requests: 0 // TODO: Track per-provider request counts separately if needed
          },
          perplexity: {
            cost: typeof perplexityCost === 'number' ? perplexityCost : 0,
            requests: 0
          }
        },
        lastUpdated: new Date()
      };

    } catch (error) {
      logError('Failed to get daily cost summary', { 
        error: error instanceof Error ? error.message : error,
        userId
      });

      return {
        userId,
        date: today,
        totalCostUSD: 0,
        requestCount: 0,
        providerBreakdown: {
          openai: { cost: 0, requests: 0 },
          perplexity: { cost: 0, requests: 0 }
        },
        lastUpdated: new Date()
      };
    }
  }

  /**
   * Reset daily costs (for testing or manual intervention)
   */
  async resetDailyCosts(userId?: string): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const keysToDelete = [
        this.getDailyKey('cost', userId),
        this.getDailyKey('count', userId),
        this.getDailyKey('cost:openai', userId),
        this.getDailyKey('cost:perplexity', userId),
      ];

      await Promise.all(keysToDelete.map(key => this.redis.del(key)));
      
      logInfo('Daily costs reset', { userId, date: today });
      return true;

    } catch (error) {
      logError('Failed to reset daily costs', { 
        error: error instanceof Error ? error.message : error,
        userId
      });
      return false;
    }
  }

  /**
   * Get cost guard status and health
   */
  async getStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'critical';
    message: string;
    globalDailyCost: number;
    globalLimit: number;
    utilization: number;
    redisConnected: boolean;
  }> {
    try {
      const globalCost = await this.getDailyCost();
      const utilization = globalCost / this.maxDailyCostUSD;

      let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
      let message = 'Cost guard operating normally';

      if (utilization >= 0.9) {
        status = 'critical';
        message = 'Daily cost limit nearly exceeded';
      } else if (utilization >= 0.7) {
        status = 'degraded';
        message = 'Daily cost approaching limit';
      } else if (!this.isConnected) {
        status = 'degraded';
        message = 'Redis connection unavailable - cost tracking limited';
      }

      return {
        status,
        message,
        globalDailyCost: globalCost,
        globalLimit: this.maxDailyCostUSD,
        utilization,
        redisConnected: this.isConnected
      };

    } catch (error) {
      return {
        status: 'critical',
        message: `Cost guard health check failed: ${error instanceof Error ? error.message : error}`,
        globalDailyCost: 0,
        globalLimit: this.maxDailyCostUSD,
        utilization: 0,
        redisConnected: false
      };
    }
  }
}

// Export singleton instance
let costGuard: ApiCostGuard | null = null;

export function getCostGuard(): ApiCostGuard {
  if (!costGuard) {
    costGuard = new ApiCostGuard();
  }
  return costGuard;
}

export default ApiCostGuard;