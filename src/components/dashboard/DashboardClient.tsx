/**
 * Dashboard Client Component
 * 
 * Client-side component that manages search state and coordinates
 * between HeroSection and CompanyDiscoveryClient
 */

'use client';

import { useState, Suspense, useCallback } from 'react';
import { HeroSection } from './HeroSection';
import { FilterSidebar, FilterState } from './FilterSidebar';
import { CompanyDiscoveryClient } from './CompanyDiscoveryClient';

export function DashboardClient() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    spearfishScore: [],
    ycBatch: [],
    teamSize: [],
    techStack: [],
    hiringStatus: []
  });

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleTagFilter = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleFiltersChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
  }, []);

  return (
    <>
      {/* Hero Section */}
      <HeroSection 
        onSearch={handleSearch}
        onTagFilter={handleTagFilter}
      />

      {/* Main Content Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Filters */}
          <div className="lg:col-span-1">
            <FilterSidebar onFiltersChange={handleFiltersChange} />
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            <Suspense fallback={
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
              </div>
            }>
              <CompanyDiscoveryClient 
                searchQuery={searchQuery}
                selectedTags={selectedTags}
                filters={filters}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </>
  );
}