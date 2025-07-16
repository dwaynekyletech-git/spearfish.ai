/**
 * Custom hook for company GitHub data fetching
 * 
 * Provides GitHub repository data with caching and loading states
 */

'use client';

import { useState, useEffect, useRef } from 'react';

interface GitHubRepository {
  id: string;
  full_name: string;
  name: string;
  owner: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stars_count: number;
  forks_count: number;
  open_issues_count: number;
  created_at_github: string;
  updated_at_github: string;
  last_synced_at: string;
  association: {
    is_primary: boolean;
    confidence_score: number;
    discovery_method: string;
  };
  metrics: {
    stars_count: number;
    forks_count: number;
    contributors_count: number;
    commit_count_last_year: number;
    releases_count: number;
  };
  star_growth: {
    monthly_growth: number;
    growth_percentage: number;
    period_days: number;
  };
  top_languages: Array<{
    language: string;
    percentage: number;
  }>;
}

interface GitHubSummary {
  total_repositories: number;
  total_stars: number;
  total_forks: number;
  total_contributors: number;
  total_commits_last_year: number;
  monthly_star_growth: number;
  primary_repository: {
    name: string;
    stars: number;
    language: string | null;
  } | null;
  top_languages: Array<{
    language: string;
    percentage: number;
  }>;
  last_synced: string | null;
}

interface CompanyGitHubData {
  repositories: GitHubRepository[];
  summary: GitHubSummary;
}

interface UseCompanyGitHubDataState {
  data: CompanyGitHubData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Simple in-memory cache
const cache = new Map<string, { data: CompanyGitHubData; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useCompanyGitHubData(companyId: string): UseCompanyGitHubDataState {
  const [data, setData] = useState<CompanyGitHubData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchGitHubData = async (): Promise<void> => {
    const cacheKey = `github:${companyId}`;
    const cachedEntry = cache.get(cacheKey);
    const now = Date.now();

    // Check if we have fresh cached data
    if (cachedEntry && (now - cachedEntry.timestamp) < CACHE_DURATION) {
      setData(cachedEntry.data);
      setIsLoading(false);
      setError(null);
      return;
    }

    try {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/companies/${companyId}/github`, {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Company not found');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch GitHub data');
      }

      const githubData = result.data;

      // Update cache
      cache.set(cacheKey, {
        data: githubData,
        timestamp: now,
      });

      if (isMountedRef.current) {
        setData(githubData);
        setError(null);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Request was cancelled
      }

      console.error('Error fetching GitHub data:', err);
      
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch GitHub data');
        
        // If we have cached data (even if stale), keep it
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
    // Clear cache for this company
    cache.delete(`github:${companyId}`);
    await fetchGitHubData();
  };

  useEffect(() => {
    isMountedRef.current = true;
    fetchGitHubData();

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
    refetch,
  };
}

// Helper hook for just the summary data (lighter weight)
export function useCompanyGitHubSummary(companyId: string): {
  summary: GitHubSummary | null;
  isLoading: boolean;
  error: string | null;
} {
  const { data, isLoading, error } = useCompanyGitHubData(companyId);
  
  return {
    summary: data?.summary || null,
    isLoading,
    error,
  };
}