/**
 * Custom hook for company data fetching with caching
 * 
 * Provides client-side caching, background refetching, and optimized loading states
 */

'use client';

import { useState, useEffect, useRef } from 'react';

interface CacheEntry {
  data: any;
  timestamp: number;
  etag?: string;
}

interface CompanyDataState {
  data: any;
  isLoading: boolean;
  error: string | null;
  isStale: boolean;
  refetch: () => Promise<void>;
}

// Simple in-memory cache
const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const STALE_TIME = 2 * 60 * 1000; // 2 minutes

export function useCompanyData(companyId: string): CompanyDataState {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchCompanyData = async (useCache = true): Promise<void> => {
    const cacheKey = `company:${companyId}`;
    const cachedEntry = cache.get(cacheKey);
    const now = Date.now();

    // Check if we have fresh cached data
    if (useCache && cachedEntry && (now - cachedEntry.timestamp) < CACHE_DURATION) {
      setData(cachedEntry.data);
      setIsLoading(false);
      setError(null);
      
      // Check if data is stale
      const isDataStale = (now - cachedEntry.timestamp) > STALE_TIME;
      setIsStale(isDataStale);
      
      // If stale, fetch in background
      if (isDataStale) {
        fetchCompanyData(false).catch(console.error);
      }
      return;
    }

    try {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      // Set loading state only if we don't have cached data
      if (!cachedEntry) {
        setIsLoading(true);
      }
      setError(null);

      const headers: HeadersInit = {};
      
      // Add If-None-Match header for conditional requests
      if (cachedEntry?.etag) {
        headers['If-None-Match'] = cachedEntry.etag;
      }

      const response = await fetch(`/api/companies/${companyId}`, {
        headers,
        signal: abortControllerRef.current.signal,
      });

      // Handle 304 Not Modified
      if (response.status === 304 && cachedEntry) {
        // Update timestamp but keep existing data
        cache.set(cacheKey, {
          ...cachedEntry,
          timestamp: now,
        });
        setIsStale(false);
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch company');
      }

      const newData = result.data;
      const etag = response.headers.get('etag');

      // Update cache
      cache.set(cacheKey, {
        data: newData,
        timestamp: now,
        etag: etag || undefined,
      });

      if (isMountedRef.current) {
        setData(newData);
        setIsStale(false);
        setError(null);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Request was cancelled
      }

      console.error('Error fetching company data:', err);
      
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch company');
        
        // If we have cached data, don't clear it on error
        if (!cachedEntry) {
          setData(null);
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const refetch = async (): Promise<void> => {
    setIsStale(false);
    await fetchCompanyData(false);
  };

  useEffect(() => {
    isMountedRef.current = true;
    fetchCompanyData();

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [companyId]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    data,
    isLoading,
    error,
    isStale,
    refetch,
  };
}

/**
 * Hook for companies list with pagination caching
 */
export function useCompaniesData(params: any) {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const isMountedRef = useRef(true);

  const fetchCompanies = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const searchParams = new URLSearchParams(params);
      const response = await fetch(`/api/companies?${searchParams}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch companies');
      }

      if (isMountedRef.current) {
        setData(result.data);
        setHasMore(result.data.length === params.limit);
      }
    } catch (err) {
      console.error('Error fetching companies:', err);
      
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch companies');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    fetchCompanies();

    return () => {
      isMountedRef.current = false;
    };
  }, [JSON.stringify(params)]);

  return {
    data,
    isLoading,
    error,
    hasMore,
    refetch: fetchCompanies,
  };
}