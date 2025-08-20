/**
 * Company Discovery Client Component
 * 
 * Main client component for displaying company cards with spearfish scores
 * Now uses client-side caching to reduce API calls and eliminate rate limiting issues
 */

'use client';

import { useMemo } from 'react';
import { CompanyCard } from './CompanyCard';
import { CompanyData } from '@/lib/spearfish-scoring-service';
import { FilterState } from './FilterSidebar';
import { useCompaniesCache, CompaniesParams } from '@/hooks/useCompaniesCache';

interface CompanyWithScore extends CompanyData {
  spearfish_score?: number;
  updated_at?: string;
}

interface CompanyDiscoveryClientProps {
  searchQuery?: string;
  selectedTags?: string[];
  filters?: FilterState;
}

export function CompanyDiscoveryClient({ 
  searchQuery = '', 
  selectedTags = [], 
  filters = {
    spearfishScore: [],
    ycBatch: [],
    teamSize: [],
    techStack: [],
    hiringStatus: [],
    enrichmentStatus: []
  }
}: CompanyDiscoveryClientProps) {
  // Convert filters to API parameters
  const apiParams: CompaniesParams = useMemo(() => {
    const params: CompaniesParams = {
      limit: 20,
      offset: 0,
    };

    // Add search query if provided
    if (searchQuery.trim()) {
      params.search = searchQuery.trim();
    }

    // Add batch filter
    if (filters.ycBatch && filters.ycBatch.length > 0) {
      params.batches = filters.ycBatch;
    }

    // Add team size filter
    if (filters.teamSize && filters.teamSize.length > 0) {
      params.teamSizes = filters.teamSize.map(size => parseInt(size.toString()));
    }

    // Add hiring status filter
    if (filters.hiringStatus && filters.hiringStatus.includes('hiring')) {
      params.hiringOnly = true;
    }

    // Add spearfish score filter (convert to minimum score)
    if (filters.spearfishScore && filters.spearfishScore.length > 0) {
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
      params.minScore = Math.min(...minScores);
    }

    // Note: Enrichment status filter removed as we no longer use Apify enrichment

    return params;
  }, [searchQuery, filters]);

  // Use the cached companies data hook
  const {
    data: companies,
    isLoading,
    isLoadingMore,
    error,
    isStale,
    hasMore,
    refetch,
    loadMore,
  } = useCompaniesCache(apiParams);

  // Handle load more function for infinite scroll
  const handleLoadMore = () => {
    if (!isLoading && !isLoadingMore && hasMore) {
      loadMore();
    }
  };

  // Filter companies by selected tags (client-side filtering for tags)
  const filteredCompanies = companies.filter(company => {
    if (selectedTags.length === 0) return true;
    return selectedTags.some(tag => 
      company.tags?.some((companyTag: string) => 
        companyTag.toLowerCase().includes(tag.toLowerCase())
      )
    );
  });

  // Debug logging for filtering
  console.log(`[DEBUG] UI Filter - Total companies: ${companies.length}, Selected tags: ${selectedTags.length}, Filtered companies: ${filteredCompanies.length}`);

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-red-400 mb-2">Error loading companies</div>
          <div className="text-slate-400 text-sm mb-4">{error}</div>
          <button
            onClick={() => refetch()}
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
        <div className="text-slate-300 flex items-center gap-2">
          {isLoading && companies.length === 0 ? (
            'Loading companies...'
          ) : (
            `Showing ${filteredCompanies.length} companies${searchQuery ? ` for "${searchQuery}"` : ''}`
          )}
          {/* Show cache status indicator */}
          {isStale && !isLoading && (
            <span className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded-md border border-yellow-500/30">
              Refreshing...
            </span>
          )}
        </div>
        {filteredCompanies.length > 0 && (
          <div className="text-sm text-slate-400 flex items-center gap-2">
            Sorted by Spearfish Score
            {isStale && (
              <button
                onClick={() => refetch()}
                className="text-xs px-2 py-1 text-purple-400 hover:text-purple-300 border border-purple-500/30 rounded transition-colors"
                title="Refresh data"
              >
                Refresh
              </button>
            )}
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
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoadingMore ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Loading More...
              </div>
            ) : (
              'Load More Companies'
            )}
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