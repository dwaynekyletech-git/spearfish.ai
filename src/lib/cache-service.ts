/**
 * Redis Cache Service for AI API Cost Optimization
 * 
 * This service provides intelligent caching for AI API responses to reduce costs by up to 40%.
 * Features:
 * - Automatic cache key generation based on content hash
 * - TTL-based expiration for different content types
 * - Cache hit/miss metrics
 * - Automatic retry with exponential backoff
 */

import { Redis } from '@upstash/redis';
import { createHash } from 'crypto';
import { logDebug, logInfo, logWarn, logError } from './logger';

export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  totalRequests: number;
}

export interface CacheConfig {
  ttlSeconds?: number;
  keyPrefix?: string;
  enableMetrics?: boolean;
  retryAttempts?: number;
}

export interface CachedResult<T> {
  data: T;
  cached: boolean;
  cacheKey?: string;
  age?: number; // seconds since cached
}

// Default TTL values for different content types (in seconds)
export const CACHE_TTL = {
  RESEARCH_QUERY: 3600,        // 1 hour - research content changes slowly
  EMAIL_TEMPLATE: 86400,       // 24 hours - email templates are relatively stable
  CLASSIFICATION: 604800,      // 1 week - company classifications rarely change
  PROJECT_IDEAS: 7200,         // 2 hours - project ideas can be reused but should stay fresh
  ANALYSIS: 1800,             // 30 minutes - analysis results should be fairly current
  SYNTHESIS: 3600,            // 1 hour - synthesis can be cached moderately long
} as const;

export class CacheService {
  private redis: Redis;
  private metrics: Map<string, CacheMetrics> = new Map();
  private isConnected: boolean = false;

  constructor() {
    const redisUrl = process.env.UPSTASH_REDIS_URL;
    const redisToken = process.env.UPSTASH_REDIS_TOKEN;

    if (!redisUrl || !redisToken) {
      logWarn('Redis credentials not found - caching will be disabled', {
        hasUrl: !!redisUrl,
        hasToken: !!redisToken
      });
      // Create a mock Redis instance for graceful degradation
      this.redis = this.createMockRedis();
      return;
    }

    this.redis = new Redis({
      url: redisUrl,
      token: redisToken,
      // Retry configuration
      retry: {
        retries: 3,
        backoff: (retryCount) => Math.min(1000 * Math.pow(2, retryCount), 5000),
      },
      // Timeout configuration
      automaticDeserialization: false, // We'll handle serialization manually for better control
    });

    this.initializeConnection();
  }

  private async initializeConnection(): Promise<void> {
    try {
      // Test the connection
      await this.redis.ping();
      this.isConnected = true;
      logInfo('Redis cache service initialized successfully');
    } catch (error) {
      logError('Failed to connect to Redis', { error: error instanceof Error ? error.message : error });
      this.isConnected = false;
      // Continue with mock Redis for graceful degradation
      this.redis = this.createMockRedis();
    }
  }

  private createMockRedis(): any {
    // Mock Redis implementation for graceful degradation when Redis is unavailable
    return {
      get: async () => null,
      set: async () => 'OK',
      setex: async () => 'OK',
      del: async () => 1,
      ping: async () => 'PONG',
      incr: async () => 1,
    };
  }

  /**
   * Generate a cache key based on content hash and optional prefix
   */
  private generateCacheKey(content: string, keyPrefix: string = 'ai_cache'): string {
    const contentHash = createHash('sha256').update(content).digest('hex').substring(0, 16);
    return `${keyPrefix}:${contentHash}`;
  }

  /**
   * Serialize data for storage in Redis
   */
  private serialize<T>(data: T): string {
    try {
      return JSON.stringify({
        data,
        timestamp: Date.now(),
        version: '1.0'
      });
    } catch (error) {
      logError('Failed to serialize cache data', { error: error instanceof Error ? error.message : error });
      throw new Error('Cache serialization failed');
    }
  }

  /**
   * Deserialize data from Redis storage
   */
  private deserialize<T>(serialized: string): { data: T; timestamp: number } {
    try {
      const parsed = JSON.parse(serialized);
      return {
        data: parsed.data,
        timestamp: parsed.timestamp || Date.now()
      };
    } catch (error) {
      logError('Failed to deserialize cache data', { error: error instanceof Error ? error.message : error });
      throw new Error('Cache deserialization failed');
    }
  }

  /**
   * Update cache metrics
   */
  private updateMetrics(keyPrefix: string, hit: boolean): void {
    if (!this.metrics.has(keyPrefix)) {
      this.metrics.set(keyPrefix, { hits: 0, misses: 0, hitRate: 0, totalRequests: 0 });
    }

    const metrics = this.metrics.get(keyPrefix)!;
    metrics.totalRequests += 1;
    
    if (hit) {
      metrics.hits += 1;
    } else {
      metrics.misses += 1;
    }
    
    metrics.hitRate = metrics.hits / metrics.totalRequests;
    
    // Log metrics every 10 requests for monitoring
    if (metrics.totalRequests % 10 === 0) {
      logDebug(`Cache metrics for ${keyPrefix}`, {
        hitRate: (metrics.hitRate * 100).toFixed(1) + '%',
        totalRequests: metrics.totalRequests,
        hits: metrics.hits,
        misses: metrics.misses
      });
    }
  }

  /**
   * Get cached value or generate it using the provided function
   */
  async getCachedOrGenerate<T>(
    key: string,
    generator: () => Promise<T>,
    config: CacheConfig = {}
  ): Promise<CachedResult<T>> {
    const {
      ttlSeconds = CACHE_TTL.ANALYSIS,
      keyPrefix = 'ai_cache',
      enableMetrics = true,
      retryAttempts = 2
    } = config;

    const cacheKey = this.generateCacheKey(key, keyPrefix);

    try {
      // Try to get from cache first
      const cached = await this.redis.get(cacheKey);
      
      if (cached && typeof cached === 'string') {
        try {
          const { data, timestamp } = this.deserialize<T>(cached);
          const age = Math.floor((Date.now() - timestamp) / 1000);
          
          if (enableMetrics) this.updateMetrics(keyPrefix, true);
          
          logDebug(`Cache HIT for key ${keyPrefix}`, { 
            cacheKey: cacheKey.substring(0, 20) + '...', 
            age: `${age}s`,
            ttl: `${ttlSeconds}s`
          });
          
          return {
            data,
            cached: true,
            cacheKey,
            age
          };
        } catch (deserializationError) {
          logWarn('Cache data corrupted, regenerating', { 
            cacheKey: cacheKey.substring(0, 20) + '...',
            error: deserializationError instanceof Error ? deserializationError.message : deserializationError
          });
          // Continue to generate fresh data
        }
      }

      // Cache miss - generate fresh data
      if (enableMetrics) this.updateMetrics(keyPrefix, false);
      
      logDebug(`Cache MISS for key ${keyPrefix}`, { 
        cacheKey: cacheKey.substring(0, 20) + '...',
        ttl: `${ttlSeconds}s`
      });

      const freshData = await generator();
      
      // Store in cache with TTL
      try {
        const serialized = this.serialize(freshData);
        await this.redis.setex(cacheKey, ttlSeconds, serialized);
        
        logDebug(`Cached fresh data`, { 
          cacheKey: cacheKey.substring(0, 20) + '...',
          ttl: `${ttlSeconds}s`,
          dataSize: `${serialized.length} chars`
        });
      } catch (cacheStoreError) {
        logWarn('Failed to store data in cache', { 
          error: cacheStoreError instanceof Error ? cacheStoreError.message : cacheStoreError,
          cacheKey: cacheKey.substring(0, 20) + '...'
        });
        // Continue without caching - data is still valid
      }

      return {
        data: freshData,
        cached: false,
        cacheKey,
        age: 0
      };

    } catch (error) {
      logError('Cache operation failed, falling back to generator', { 
        error: error instanceof Error ? error.message : error,
        keyPrefix,
        retryAttempts
      });

      // Fallback to generating fresh data without caching
      const freshData = await generator();
      return {
        data: freshData,
        cached: false
      };
    }
  }

  /**
   * Manually cache a value
   */
  async set<T>(key: string, data: T, ttlSeconds: number = CACHE_TTL.ANALYSIS, keyPrefix: string = 'ai_cache'): Promise<boolean> {
    if (!this.isConnected) {
      logDebug('Redis not connected, skipping cache set');
      return false;
    }

    try {
      const cacheKey = this.generateCacheKey(key, keyPrefix);
      const serialized = this.serialize(data);
      await this.redis.setex(cacheKey, ttlSeconds, serialized);
      
      logDebug(`Manually cached data`, { 
        cacheKey: cacheKey.substring(0, 20) + '...',
        ttl: `${ttlSeconds}s`
      });
      
      return true;
    } catch (error) {
      logError('Failed to manually cache data', { 
        error: error instanceof Error ? error.message : error,
        keyPrefix
      });
      return false;
    }
  }

  /**
   * Get cached value only (no generation)
   */
  async get<T>(key: string, keyPrefix: string = 'ai_cache'): Promise<CachedResult<T> | null> {
    if (!this.isConnected) {
      return null;
    }

    try {
      const cacheKey = this.generateCacheKey(key, keyPrefix);
      const cached = await this.redis.get(cacheKey);
      
      if (cached && typeof cached === 'string') {
        const { data, timestamp } = this.deserialize<T>(cached);
        const age = Math.floor((Date.now() - timestamp) / 1000);
        
        return {
          data,
          cached: true,
          cacheKey,
          age
        };
      }
      
      return null;
    } catch (error) {
      logError('Failed to get cached data', { 
        error: error instanceof Error ? error.message : error,
        keyPrefix
      });
      return null;
    }
  }

  /**
   * Delete cached value
   */
  async delete(key: string, keyPrefix: string = 'ai_cache'): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const cacheKey = this.generateCacheKey(key, keyPrefix);
      await this.redis.del(cacheKey);
      
      logDebug(`Deleted cache entry`, { 
        cacheKey: cacheKey.substring(0, 20) + '...'
      });
      
      return true;
    } catch (error) {
      logError('Failed to delete cached data', { 
        error: error instanceof Error ? error.message : error,
        keyPrefix
      });
      return false;
    }
  }

  /**
   * Get cache metrics for monitoring
   */
  getMetrics(keyPrefix?: string): CacheMetrics | Map<string, CacheMetrics> {
    if (keyPrefix) {
      return this.metrics.get(keyPrefix) || { hits: 0, misses: 0, hitRate: 0, totalRequests: 0 };
    }
    return new Map(this.metrics);
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics.clear();
    logDebug('Cache metrics cleared');
  }

  /**
   * Health check for cache service
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; message: string; metrics?: any }> {
    try {
      // Test the actual connection instead of relying on isConnected flag
      const startTime = Date.now();
      await this.redis.ping();
      const latency = Date.now() - startTime;
      
      // Update connection status based on successful ping
      this.isConnected = true;

      const allMetrics = this.getMetrics() as Map<string, CacheMetrics>;
      const totalMetrics = Array.from(allMetrics.values()).reduce(
        (acc, metrics) => ({
          hits: acc.hits + metrics.hits,
          misses: acc.misses + metrics.misses,
          totalRequests: acc.totalRequests + metrics.totalRequests,
          hitRate: 0 // Will calculate below
        }),
        { hits: 0, misses: 0, totalRequests: 0, hitRate: 0 }
      );
      
      if (totalMetrics.totalRequests > 0) {
        totalMetrics.hitRate = totalMetrics.hits / totalMetrics.totalRequests;
      }

      return {
        status: latency < 100 ? 'healthy' : 'degraded',
        message: `Redis responsive in ${latency}ms`,
        metrics: {
          latency,
          ...totalMetrics,
          hitRatePercent: (totalMetrics.hitRate * 100).toFixed(1) + '%'
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Cache health check failed: ${error instanceof Error ? error.message : error}`
      };
    }
  }
}

// Export singleton instance for shared state across the application
let cacheService: CacheService | null = null;

export function getCacheService(): CacheService {
  if (!cacheService) {
    cacheService = new CacheService();
  }
  return cacheService;
}

export default CacheService;