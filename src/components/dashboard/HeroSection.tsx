/**
 * Hero Section Component
 * 
 * Main hero section with search bar and tag filters
 */

'use client';

import { useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface HeroSectionProps {
  onSearch: (query: string) => void;
  onTagFilter: (tag: string) => void;
}

export function HeroSection({ onSearch, onTagFilter }: HeroSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const handleSearch = () => {
    onSearch(searchQuery);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleTagClick = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
    onTagFilter(tag);
  };

  const popularTags = [
    '#LangChain',
    '#MLOps', 
    '#Open Source',
    '+Remote',
    '#Computer Vision',
    '#NLP',
    '#Generative AI'
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Find Your Next AI Mission.
        </h2>
        <p className="text-xl text-slate-300 mb-8">
          Curated companies at the edge of artificial intelligence.
        </p>
        
        {/* Search Bar */}
        <div className="relative max-w-2xl mx-auto mb-8">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search companies, roles, or technologies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            className="w-full pl-10 pr-4 py-4 bg-slate-800/80 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <button 
            onClick={handleSearch}
            className="absolute right-2 top-2 bottom-2 px-6 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            Search
          </button>
        </div>

        {/* Tag Filters */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {popularTags.map((tag) => (
            <button
              key={tag}
              onClick={() => handleTagClick(tag)}
              className={`px-4 py-2 border border-slate-600 rounded-full text-sm transition-colors ${
                selectedTags.includes(tag)
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-slate-700/50 hover:bg-slate-600 text-slate-300 hover:text-white'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Search Results Info */}
        {searchQuery && (
          <div className="text-slate-400 text-sm">
            Searching for: <span className="text-white font-medium">&quot;{searchQuery}&quot;</span>
          </div>
        )}

        {selectedTags.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            <span className="text-slate-400 text-sm">Active filters:</span>
            {selectedTags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 bg-purple-600 text-white rounded-full text-xs cursor-pointer hover:bg-purple-700 transition-colors"
                onClick={() => handleTagClick(tag)}
              >
                {tag} ×
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}