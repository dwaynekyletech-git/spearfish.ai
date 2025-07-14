/**
 * Filter Sidebar Component
 * 
 * Left sidebar with filtering options for companies
 */

'use client';

import { useState, useEffect } from 'react';

export interface FilterState {
  spearfishScore: string[];
  ycBatch: string[];
  teamSize: string[];
  techStack: string[];
  hiringStatus: string[];
}

interface FilterSidebarProps {
  onFiltersChange: (filters: FilterState) => void;
}

export function FilterSidebar({ onFiltersChange }: FilterSidebarProps) {
  const [filters, setFilters] = useState<FilterState>({
    spearfishScore: [],
    ycBatch: [],
    teamSize: [],
    techStack: [],
    hiringStatus: []
  });

  const handleFilterChange = (category: keyof FilterState, value: string, checked: boolean) => {
    setFilters(prev => {
      const newFilters = {
        ...prev,
        [category]: checked 
          ? [...prev[category], value]
          : prev[category].filter(item => item !== value)
      };
      return newFilters;
    });
  };

  // Call parent callback when filters change
  useEffect(() => {
    onFiltersChange(filters);
  }, [filters, onFiltersChange]);

  return (
    <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6 sticky top-8">
      <h3 className="text-lg font-semibold text-white mb-4">FILTERS</h3>
      
      <div className="space-y-6">
        {/* Spearfish Score Filter */}
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-3">Spearfish Score</h4>
          <div className="space-y-2">
            {[
              { label: 'Excellent (8-10)', value: '8-10' },
              { label: 'Good (6-8)', value: '6-8' },
              { label: 'Average (4-6)', value: '4-6' },
              { label: 'Below Average (2-4)', value: '2-4' }
            ].map((score) => (
              <label key={score.value} className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.spearfishScore.includes(score.value)}
                  onChange={(e) => handleFilterChange('spearfishScore', score.value, e.target.checked)}
                  className="rounded border-slate-600 bg-slate-700 text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
                />
                <span className="ml-2 text-sm text-slate-300 hover:text-white transition-colors">
                  {score.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* YC Batch Filter */}
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-3">YC Batch</h4>
          <div className="space-y-2">
            {['W23', 'S22', 'W22', 'S21'].map((batch) => (
              <label key={batch} className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.ycBatch.includes(batch)}
                  onChange={(e) => handleFilterChange('ycBatch', batch, e.target.checked)}
                  className="rounded border-slate-600 bg-slate-700 text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
                />
                <span className="ml-2 text-sm text-slate-300 hover:text-white transition-colors">
                  {batch}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Team Size Filter */}
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-3">Team Size</h4>
          <div className="space-y-2">
            {[
              { label: '1-10', value: '1-10' },
              { label: '11-50', value: '11-50' },
              { label: '51-200', value: '51-200' },
              { label: '200+', value: '200+' }
            ].map((size) => (
              <label key={size.value} className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.teamSize.includes(size.value)}
                  onChange={(e) => handleFilterChange('teamSize', size.value, e.target.checked)}
                  className="rounded border-slate-600 bg-slate-700 text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
                />
                <span className="ml-2 text-sm text-slate-300 hover:text-white transition-colors">
                  {size.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Tech Stack Filter */}
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-3">Tech Stack</h4>
          <div className="space-y-2">
            {['Python', 'PyTorch', 'TensorFlow', 'FastAPI', 'React', 'Node.js'].map((tech) => (
              <label key={tech} className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.techStack.includes(tech)}
                  onChange={(e) => handleFilterChange('techStack', tech, e.target.checked)}
                  className="rounded border-slate-600 bg-slate-700 text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
                />
                <span className="ml-2 text-sm text-slate-300 hover:text-white transition-colors">
                  {tech}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Hiring Status Filter */}
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-3">Status</h4>
          <div className="space-y-2">
            {[
              { label: 'Currently Hiring', value: 'hiring' },
              { label: 'Recently Funded', value: 'funded' }
            ].map((status) => (
              <label key={status.value} className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.hiringStatus.includes(status.value)}
                  onChange={(e) => handleFilterChange('hiringStatus', status.value, e.target.checked)}
                  className="rounded border-slate-600 bg-slate-700 text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
                />
                <span className="ml-2 text-sm text-slate-300 hover:text-white transition-colors">
                  {status.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Clear Filters */}
        <div className="pt-4 border-t border-slate-700">
          <button
            onClick={() => setFilters({
              spearfishScore: [],
              ycBatch: [],
              teamSize: [],
              techStack: [],
              hiringStatus: []
            })}
            className="w-full px-4 py-2 text-sm text-slate-300 hover:text-white bg-slate-700/50 hover:bg-slate-600 rounded-lg transition-colors"
          >
            Clear All Filters
          </button>
        </div>
      </div>
    </div>
  );
}