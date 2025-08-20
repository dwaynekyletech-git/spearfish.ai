/**
 * Client-Side Cache Manager
 * 
 * Provides a centralized caching system for API responses with:
 * - TTL-based cache invalidation
 * - Stale-while-revalidate pattern
 * - Memory-efficient storage with size limits
 * - Cache key generation for different filter combinations
 */

'use client';

// =============================================================================
// Type Definitions
// =============================================================================

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  etag?: string;
  lastModified?: string;
  staleTime: number;
  expiresAt: number;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  staleTime?: number; // Time after which data is considered stale
  maxSize?: number; // Maximum number of entries
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
}

// =============================================================================
// Cache Manager Class
// =============================================================================

class ClientCacheManager {
  private cache = new Map<string, CacheEntry>();
  private accessTimes = new Map<string, number>();
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    hitRate: 0
  };

  private readonly defaultOptions: Required<CacheOptions> = {
    ttl: 5 * 60 * 1000, // 5 minutes
    staleTime: 2 * 60 * 1000, // 2 minutes
    maxSize: 100 // Maximum 100 cache entries
  };

  /**
   * Generate a cache key from parameters
   */
  generateKey(prefix: string, params: Record<string, any>): string {
    // Sort parameters to ensure consistent keys
    const sortedKeys = Object.keys(params).sort();
    const keyParts = [prefix];
    
    for (const key of sortedKeys) {
      const value = params[key];
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          keyParts.push(`${key}=${value.sort().join(',')}`);
        } else {
          keyParts.push(`${key}=${value}`);
        }
      }
    }
    
    return keyParts.join('|');
  }

  /**
   * Get data from cache
   */
  get<T>(key: string): {
    data: T | null;
    isStale: boolean;
    isExpired: boolean;
  } {
    const entry = this.cache.get(key);
    const now = Date.now();
    
    if (!entry) {
      this.metrics.misses++;
      this.updateMetrics();
      return {
        data: null,
        isStale: false,
        isExpired: true
      };
    }

    // Update access time for LRU
    this.accessTimes.set(key, now);

    // Check if expired
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      this.accessTimes.delete(key);
      this.metrics.misses++;
      this.updateMetrics();
      return {
        data: null,
        isStale: true,
        isExpired: true
      };
    }

    // Check if stale
    const isStale = now > (entry.timestamp + entry.staleTime);

    this.metrics.hits++;
    this.updateMetrics();

    return {
      data: entry.data,
      isStale,
      isExpired: false
    };
  }

  /**
   * Set data in cache
   */
  set<T>(
    key: string, 
    data: T, 
    options: CacheOptions = {},
    headers?: Headers
  ): void {
    const opts = { ...this.defaultOptions, ...options };
    const now = Date.now();

    // Extract cache-related headers
    const etag = headers?.get('etag') || undefined;
    const lastModified = headers?.get('last-modified') || undefined;

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      etag,
      lastModified,
      staleTime: opts.staleTime,
      expiresAt: now + opts.ttl
    };

    // Evict entries if at max size
    if (this.cache.size >= opts.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, entry);
    this.accessTimes.set(key, now);
    this.updateMetrics();
  }

  /**
   * Delete specific cache entry
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    this.accessTimes.delete(key);
    this.updateMetrics();
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.accessTimes.clear();
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      hitRate: 0
    };
  }

  /**
   * Clear entries matching a pattern
   */
  clearByPattern(pattern: string | RegExp): number {
    let cleared = 0;
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    
    const keysToDelete: string[] = [];
    this.cache.forEach((_, key) => {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.accessTimes.delete(key);
      cleared++;
    });
    
    this.updateMetrics();
    return cleared;
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Get all cache keys (for debugging)
   */
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Check if entry exists and is valid
   */
  has(key: string): boolean {
    const result = this.get(key);
    return result.data !== null && !result.isExpired;
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestTime = Date.now();
    let oldestKey: string | null = null;

    this.accessTimes.forEach((time, key) => {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    });

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.accessTimes.delete(oldestKey);
      this.metrics.evictions++;
    }
  }

  /**
   * Update cache metrics
   */
  private updateMetrics(): void {
    this.metrics.size = this.cache.size;
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = total > 0 ? this.metrics.hits / total : 0;
  }

  /**
   * Cleanup expired entries (manual garbage collection)
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    const keysToClean: string[] = [];
    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        keysToClean.push(key);
      }
    });
    
    keysToClean.forEach(key => {
      this.cache.delete(key);
      this.accessTimes.delete(key);
      cleaned++;
    });

    this.updateMetrics();
    return cleaned;
  }
}

// =============================================================================
// Singleton Instance and Utility Functions
// =============================================================================

// Create singleton instance
const cacheManager = new ClientCacheManager();

// Auto-cleanup every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    const cleaned = cacheManager.cleanup();
    if (cleaned > 0) {
      console.debug(`Cache cleanup: removed ${cleaned} expired entries`);
    }
  }, 5 * 60 * 1000);
}

/**
 * Get data from cache
 */
export function getCachedData<T>(key: string) {
  return cacheManager.get<T>(key);
}

/**
 * Set data in cache
 */
export function setCachedData<T>(
  key: string, 
  data: T, 
  options?: CacheOptions,
  headers?: Headers
) {
  return cacheManager.set(key, data, options, headers);
}

/**
 * Generate cache key for API requests
 */
export function generateCacheKey(endpoint: string, params: Record<string, any> = {}) {
  return cacheManager.generateKey(endpoint, params);
}

/**
 * Clear cache entries
 */
export function clearCache(pattern?: string | RegExp) {
  if (pattern) {
    return cacheManager.clearByPattern(pattern);
  } else {
    cacheManager.clear();
    return 0;
  }
}

/**
 * Pre-fetch and cache company data for instant loading
 */
export function prefetchCompanyData(companyId: string): Promise<void> {
  const cacheKey = `company:${companyId}`;
  
  // Check if already cached and fresh
  const cached = getCachedData(cacheKey);
  if (cached.data && !cached.isExpired) {
    return Promise.resolve();
  }

  // Pre-fetch data in background
  return fetch(`/api/companies/${companyId}`)
    .then(response => {
      if (response.ok) {
        return response.json();
      }
      // Don't throw errors for pre-fetch failures
      return null;
    })
    .then(data => {
      if (data?.success) {
        setCachedData(cacheKey, data, cacheConfig.companyDetails);
      }
    })
    .catch(() => {
      // Silently fail for pre-fetch operations
    });
}

/**
 * Seed cache with basic company data from list
 */
export function seedCompanyCache(companyId: string, basicData: any): void {
  const cacheKey = `company:${companyId}`;
  
  // Only seed if we don't have fresh data already
  const cached = getCachedData(cacheKey);
  if (cached.data && !cached.isExpired) {
    return;
  }

  // Create a mock API response structure with basic data
  const seedData = {
    success: true,
    data: {
      ...basicData,
      _seeded: true, // Mark as seeded data
      _seedTime: Date.now()
    },
    metadata: {
      timestamp: new Date().toISOString()
    }
  };

  // Cache with shorter TTL since it's incomplete data
  setCachedData(
    cacheKey, 
    seedData, 
    {
      ttl: 30 * 1000, // 30 seconds only
      staleTime: 10 * 1000 // 10 seconds
    }
  );
}

/**
 * Delete specific cache entry
 */
export function deleteCacheEntry(key: string) {
  return cacheManager.delete(key);
}

/**
 * Get cache metrics for monitoring
 */
export function getCacheMetrics() {
  return cacheManager.getMetrics();
}

/**
 * Check if cache has valid entry
 */
export function hasCachedData(key: string) {
  return cacheManager.has(key);
}

/**
 * Get cache size
 */
export function getCacheSize() {
  return cacheManager.size();
}

/**
 * Get all cache keys (for debugging)
 */
export function getCacheKeys() {
  return cacheManager.getKeys();
}

// Export the cache manager for advanced use cases
export { cacheManager as clientCache };

// Default cache options for different data types
export const cacheConfig = {
  // Companies list data - moderately fresh
  companiesList: {
    ttl: 5 * 60 * 1000, // 5 minutes
    staleTime: 2 * 60 * 1000 // 2 minutes
  },
  
  // Individual company data - longer cache
  companyDetails: {
    ttl: 10 * 60 * 1000, // 10 minutes  
    staleTime: 5 * 60 * 1000 // 5 minutes
  },
  
  // Frequently changing data - shorter cache
  liveData: {
    ttl: 30 * 1000, // 30 seconds
    staleTime: 15 * 1000 // 15 seconds
  },
  
  // Static reference data - long cache
  staticData: {
    ttl: 60 * 60 * 1000, // 1 hour
    staleTime: 30 * 60 * 1000 // 30 minutes
  }
} as const;