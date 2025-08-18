/**
 * Company Discovery Client Component
 * 
 * Main client component for displaying company cards with spearfish scores
 */

'use client';

import { useState, useEffect } from 'react';
import { CompanyCard } from './CompanyCard';
import { CompanyData } from '@/lib/spearfish-scoring-service';
import { FilterState } from './FilterSidebar';

interface CompanyWithScore extends CompanyData {
  spearfish_score?: number;
  updated_at?: string;
}

interface CompanyDiscoveryClientProps {
  searchQuery?: string;
  selectedTags?: string[];
  filters?: FilterState;
}

interface ApiResponse {
  success: boolean;
  data: CompanyWithScore[];
  metadata: {
    total: number;
    limit: number;
    offset: number;
    timestamp: string;
  };
  error?: string;
}

export function CompanyDiscoveryClient({ 
  searchQuery = '', 
  selectedTags = [], 
  filters = {
    spearfishScore: [],
    ycBatch: [],
    teamSize: [],
    techStack: [],
    hiringStatus: []
  }
}: CompanyDiscoveryClientProps) {
  const [companies, setCompanies] = useState<CompanyWithScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  // Fetch companies from API
  const fetchCompanies = async (reset: boolean = false) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const currentOffset = reset ? 0 : offset;
      const searchParams = new URLSearchParams({
        limit: '20',
        offset: currentOffset.toString(),
      });

      // Add search query if provided
      if (searchQuery.trim()) {
        searchParams.append('search', searchQuery.trim());
      }

      // Add filters
      if (filters.ycBatch && filters.ycBatch.length > 0) {
        searchParams.append('batches', filters.ycBatch.join(','));
      }

      if (filters.teamSize && filters.teamSize.length > 0) {
        searchParams.append('teamSizes', filters.teamSize.join(','));
      }

      if (filters.hiringStatus && filters.hiringStatus.includes('hiring')) {
        searchParams.append('hiringOnly', 'true');
      }

      if (filters.spearfishScore && filters.spearfishScore.length > 0) {
        // Convert spearfish score filter to minimum score
        const minScores = filters.spearfishScore.map(range => {
          switch (range) {
            case '8-10': return 8;
            case '6-8': return 6;
            case '4-6': return 4;
            case '2-4': return 2;
            case '0-2': return 0;
            default: return 0;
          }
        });
        const minScore = Math.min(...minScores);
        searchParams.append('minScore', minScore.toString());
      }

      const response = await fetch(`/api/company-data?${searchParams}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: ApiResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch companies');
      }

      if (reset) {
        setCompanies(result.data);
        setOffset(result.data.length);
      } else {
        setCompanies(prev => [...prev, ...result.data]);
        setOffset(prev => prev + result.data.length);
      }

      // Check if there are more results
      setHasMore(result.data.length === 20);

    } catch (err) {
      console.error('Error fetching companies:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch companies');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load and reload when search/filters change
  useEffect(() => {
    setOffset(0);
    fetchCompanies(true);
  }, [searchQuery, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load more function for infinite scroll
  const loadMore = () => {
    if (!isLoading && hasMore) {
      fetchCompanies(false);
    }
  };

  // Filter companies by selected tags (client-side filtering for tags)
  const filteredCompanies = companies.filter(company => {
    if (selectedTags.length === 0) return true;
    return selectedTags.some(tag => 
      company.tags?.some(companyTag => 
        companyTag.toLowerCase().includes(tag.toLowerCase())
      )
    );
  });

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-red-400 mb-2">Error loading companies</div>
          <div className="text-slate-400 text-sm mb-4">{error}</div>
          <button
            onClick={() => fetchCompanies(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Results Header */}
      <div className="flex items-center justify-between">
        <div className="text-slate-300">
          {isLoading && companies.length === 0 ? (
            'Loading companies...'
          ) : (
            `Showing ${filteredCompanies.length} companies${searchQuery ? ` for "${searchQuery}"` : ''}`
          )}
        </div>
        {filteredCompanies.length > 0 && (
          <div className="text-sm text-slate-400">
            Sorted by Spearfish Score
          </div>
        )}
      </div>

      {/* Company Cards */}
      <div className="space-y-4">
        {filteredCompanies.map((company) => (
          <CompanyCard 
            key={company.id} 
            company={company} 
          />
        ))}
      </div>

      {/* Loading State */}
      {isLoading && companies.length === 0 && (
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6 animate-pulse">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="h-12 w-12 bg-slate-700 rounded-lg"></div>
                    <div className="space-y-2">
                      <div className="h-4 bg-slate-700 rounded w-32"></div>
                      <div className="h-3 bg-slate-700 rounded w-24"></div>
                    </div>
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="h-3 bg-slate-700 rounded w-full"></div>
                    <div className="h-3 bg-slate-700 rounded w-2/3"></div>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-6 bg-slate-700 rounded w-16"></div>
                    <div className="h-6 bg-slate-700 rounded w-12"></div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="h-6 bg-slate-700 rounded w-12 mb-2"></div>
                  <div className="h-3 bg-slate-700 rounded w-16"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load More Button */}
      {!isLoading && hasMore && filteredCompanies.length > 0 && (
        <div className="text-center py-8">
          <button
            onClick={loadMore}
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white rounded-lg transition-colors"
          >
            Load More Companies
          </button>
        </div>
      )}

      {/* No Results */}
      {!isLoading && filteredCompanies.length === 0 && companies.length === 0 && (
        <div className="text-center py-12">
          <div className="text-slate-400 mb-4">
            {searchQuery ? `No companies found for "${searchQuery}"` : 'No companies found'}
          </div>
          <div className="text-sm text-slate-500">
            Try adjusting your search criteria or filters
          </div>
        </div>
      )}

      {/* No Results After Filtering */}
      {!isLoading && filteredCompanies.length === 0 && companies.length > 0 && (
        <div className="text-center py-12">
          <div className="text-slate-400 mb-4">
            No companies match the selected tags
          </div>
          <div className="text-sm text-slate-500">
            Try selecting different tags or remove tag filters
          </div>
        </div>
      )}
    </div>
  );
}