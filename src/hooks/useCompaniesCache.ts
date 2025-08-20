/**
 * Companies List Caching Hook
 * 
 * Custom hook that provides caching for companies list data with:
 * - Cache-based instant loading
 * - Background refresh when data is stale
 * - Deduplicated concurrent requests
 * - Proper error handling and fallback
 */

'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  generateCacheKey, 
  getCachedData, 
  setCachedData, 
  cacheConfig 
} from '@/lib/client-cache';

// =============================================================================
// Type Definitions
// =============================================================================

export interface CompaniesParams {
  limit?: number;
  offset?: number;
  search?: string;
  batches?: string[];
  teamSizes?: number[];
  hiringOnly?: boolean;
  minScore?: number;
  orderBy?: string;
  orderDirection?: string;
}

export interface CompaniesResponse {
  success: boolean;
  data: any[];
  metadata: {
    total: number;
    limit: number;
    offset: number;
    hasMore?: boolean;
    timestamp: string;
  };
  error?: string;
}

export interface UseCompaniesCacheResult {
  data: any[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  isStale: boolean;
  hasMore: boolean;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
  clearCache: () => void;
}

// =============================================================================
// In-Flight Request Tracking
// =============================================================================

// Track in-flight requests to prevent duplicates
const inFlightRequests = new Map<string, Promise<CompaniesResponse>>();

// =============================================================================
// Hook Implementation
// =============================================================================

export function useCompaniesCache(params: CompaniesParams): UseCompaniesCacheResult {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentOffset, setCurrentOffset] = useState(0);

  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Generate cache key based on params (excluding offset for base data)
  const baseCacheKey = useMemo(() => {
    const { offset, ...baseParams } = params;
    return generateCacheKey('companies-list', baseParams);
  }, [params]);

  // Generate cache key including offset for pagination
  const paginatedCacheKey = useMemo(() => {
    return generateCacheKey('companies-list', params);
  }, [params]);

  /**
   * Fetch companies data from API
   */
  const fetchCompaniesData = useCallback(async (
    cacheKey: string,
    requestParams: CompaniesParams,
    useCache = true
  ): Promise<CompaniesResponse> => {
    // Check for cached data first
    if (useCache) {
      const cached = getCachedData<CompaniesResponse>(cacheKey);
      if (cached.data && !cached.isExpired) {
        return cached.data;
      }
    }

    // Check for in-flight request
    const existingRequest = inFlightRequests.get(cacheKey);
    if (existingRequest) {
      return existingRequest;
    }

    // Create new request
    const request = (async (): Promise<CompaniesResponse> => {
      try {
        // Cancel previous request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        abortControllerRef.current = new AbortController();

        // Build query parameters
        const searchParams = new URLSearchParams();
        
        if (requestParams.limit) searchParams.set('limit', requestParams.limit.toString());
        if (requestParams.offset) searchParams.set('offset', requestParams.offset.toString());
        if (requestParams.search?.trim()) searchParams.set('search', requestParams.search.trim());
        if (requestParams.batches?.length) searchParams.set('batches', requestParams.batches.join(','));
        if (requestParams.teamSizes?.length) searchParams.set('teamSizes', requestParams.teamSizes.join(','));
        if (requestParams.hiringOnly) searchParams.set('hiringOnly', 'true');
        if (requestParams.minScore !== undefined) searchParams.set('minScore', requestParams.minScore.toString());
        if (requestParams.orderBy) searchParams.set('orderBy', requestParams.orderBy);
        if (requestParams.orderDirection) searchParams.set('orderDirection', requestParams.orderDirection);

        // Make API request
        const response = await fetch(`/api/company-data?${searchParams}`, {
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result: CompaniesResponse = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch companies');
        }

        // Cache the response
        setCachedData(
          cacheKey,
          result,
          cacheConfig.companiesList,
          response.headers
        );

        return result;

      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw error; // Let abort errors bubble up
        }
        
        console.error('Error fetching companies:', error);
        
        // Try to return cached data as fallback
        const cached = getCachedData<CompaniesResponse>(cacheKey);
        if (cached.data) {
          console.warn('Using stale cached data due to fetch error');
          return cached.data;
        }
        
        throw error;
      } finally {
        // Remove from in-flight requests
        inFlightRequests.delete(cacheKey);
      }
    })();

    // Track in-flight request
    inFlightRequests.set(cacheKey, request);

    return request;
  }, []);

  /**
   * Load initial data or refresh
   */
  const loadData = useCallback(async (forceRefresh = false): Promise<void> => {
    if (!isMountedRef.current) return;

    try {
      // Check cache first for instant loading
      if (!forceRefresh) {
        const cached = getCachedData<CompaniesResponse>(baseCacheKey);
        if (cached.data && !cached.isExpired) {
          setData(cached.data.data);
          setIsStale(cached.isStale);
          setError(null);
          setHasMore(cached.data.metadata?.hasMore ?? (cached.data.data.length === (params.limit || 20)));
          setCurrentOffset(cached.data.data.length);
          
          // Set loading to false if we have valid cached data
          if (!cached.isStale) {
            setIsLoading(false);
          }
          
          // If stale, fetch in background
          if (cached.isStale) {
            fetchCompaniesData(baseCacheKey, { ...params, offset: 0 }, false)
              .then(result => {
                if (isMountedRef.current) {
                  setData(result.data);
                  setIsStale(false);
                  setHasMore(result.metadata?.hasMore ?? (result.data.length === (params.limit || 20)));
                  setCurrentOffset(result.data.length);
                }
              })
              .catch(err => {
                if (err?.name !== 'AbortError') {
                  console.error('Background refresh failed:', err);
                }
              })
              .finally(() => {
                if (isMountedRef.current) {
                  setIsLoading(false);
                }
              });
          }
          
          return;
        }
      }

      // No cache or force refresh - show loading state
      setIsLoading(true);
      setError(null);

      const result = await fetchCompaniesData(
        baseCacheKey, 
        { ...params, offset: 0 }, 
        !forceRefresh
      );

      if (isMountedRef.current) {
        setData(result.data);
        setIsStale(false);
        setError(null);
        setHasMore(result.metadata?.hasMore ?? (result.data.length === (params.limit || 20)));
        setCurrentOffset(result.data.length);
      }

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Don't handle abort errors
      }

      console.error('Error loading companies data:', err);
      
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch companies');
        
        // Don't clear existing data on error if we have some
        if (data.length === 0) {
          setData([]);
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [baseCacheKey, params, fetchCompaniesData, data.length]);

  /**
   * Load more data for pagination
   */
  const loadMore = useCallback(async (): Promise<void> => {
    if (!hasMore || isLoadingMore || isLoading) return;

    try {
      setIsLoadingMore(true);
      setError(null);

      const result = await fetchCompaniesData(
        generateCacheKey('companies-list', { ...params, offset: currentOffset }),
        { ...params, offset: currentOffset },
        true
      );

      if (isMountedRef.current) {
        console.log(`[DEBUG] LoadMore - previous count: ${data.length}, new data: ${result.data.length}, hasMore: ${result.metadata?.hasMore}, total after: ${data.length + result.data.length}`);
        console.log(`[DEBUG] LoadMore - new company IDs:`, result.data.map(c => c.id));
        const newDataArray = [...data, ...result.data];
        console.log(`[DEBUG] LoadMore - combined array length: ${newDataArray.length}`);
        setData(newDataArray);
        setHasMore(result.metadata?.hasMore ?? (result.data.length === (params.limit || 20)));
        setCurrentOffset(prev => prev + result.data.length);
      }

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      console.error('Error loading more companies:', err);
      
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load more companies');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoadingMore(false);
      }
    }
  }, [hasMore, isLoadingMore, isLoading, currentOffset, params, fetchCompaniesData, data]);

  /**
   * Refetch data (force refresh)
   */
  const refetch = useCallback(async (): Promise<void> => {
    setCurrentOffset(0);
    await loadData(true);
  }, [loadData]);

  /**
   * Clear cache for this query
   */
  const clearCache = useCallback((): void => {
    // Clear all related cache entries
    inFlightRequests.delete(baseCacheKey);
    setIsStale(false);
  }, [baseCacheKey]);

  // Load data when params change
  useEffect(() => {
    isMountedRef.current = true;
    setCurrentOffset(0);
    loadData();

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    data,
    isLoading,
    isLoadingMore,
    error,
    isStale,
    hasMore,
    refetch,
    loadMore,
    clearCache,
  };
}