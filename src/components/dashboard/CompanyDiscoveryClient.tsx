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

// Mock data for now - will be replaced with real API calls
const mockCompanies: CompanyWithScore[] = [
  {
    id: '1',
    name: 'Anthropic',
    batch: 'S21',
    industry: 'Artificial Intelligence',
    one_liner: 'AI safety company focused on developing safe, beneficial AI systems',
    spearfish_score: 9.2,
    team_size: 150,
    status: 'Active',
    is_hiring: true,
    tags: ['AI Safety', 'LLM', 'Research'],
    regions: ['San Francisco'],
    github_repos: [],
    huggingface_models: [],
  },
  {
    id: '2',
    name: 'Cohere',
    batch: 'W21',
    industry: 'Machine Learning',
    one_liner: 'Natural language processing platform for enterprise applications',
    spearfish_score: 8.7,
    team_size: 120,
    status: 'Active',
    is_hiring: true,
    tags: ['NLP', 'Enterprise', 'API'],
    regions: ['Toronto'],
    github_repos: [],
    huggingface_models: [],
  },
  {
    id: '3',
    name: 'OpenAI',
    batch: 'W16',
    industry: 'Artificial Intelligence',
    one_liner: 'AI research and deployment company creating safe AGI',
    spearfish_score: 9.8,
    team_size: 500,
    status: 'Active',
    is_hiring: true,
    tags: ['AGI', 'Research', 'GPT'],
    regions: ['San Francisco'],
    github_repos: [],
    huggingface_models: [],
  },
  {
    id: '4',
    name: 'Stability AI',
    batch: 'Independent',
    industry: 'Generative AI',
    one_liner: 'Open-source generative AI for images, language, and code',
    spearfish_score: 8.4,
    team_size: 80,
    status: 'Active',
    is_hiring: false,
    tags: ['Stable Diffusion', 'Open Source', 'Generative'],
    regions: ['London'],
    github_repos: [],
    huggingface_models: [],
  },
  {
    id: '5',
    name: 'Hugging Face',
    batch: 'Independent',
    industry: 'Machine Learning',
    one_liner: 'The collaborative platform for the machine learning community',
    spearfish_score: 9.1,
    team_size: 200,
    status: 'Active',
    is_hiring: true,
    tags: ['ML Platform', 'Open Source', 'Community'],
    regions: ['New York'],
    github_repos: [],
    huggingface_models: [],
  },
  {
    id: '6',
    name: 'Scale AI',
    batch: 'S16',
    industry: 'Data Infrastructure',
    one_liner: 'Data platform for AI applications and machine learning training',
    spearfish_score: 7.9,
    team_size: 300,
    status: 'Active',
    is_hiring: true,
    tags: ['Data Platform', 'ML Training', 'Enterprise'],
    regions: ['San Francisco'],
    github_repos: [],
    huggingface_models: [],
  },
  {
    id: '7',
    name: 'Replicate',
    batch: 'S20',
    industry: 'Machine Learning',
    one_liner: 'Run machine learning models in the cloud with a simple API',
    spearfish_score: 8.2,
    team_size: 25,
    status: 'Active',
    is_hiring: true,
    tags: ['ML API', 'Cloud', 'Developer Tools'],
    regions: ['San Francisco'],
    github_repos: [],
    huggingface_models: [],
  },
  {
    id: '8',
    name: 'Weights & Biases',
    batch: 'S17',
    industry: 'Machine Learning',
    one_liner: 'Developer tools for machine learning experiment tracking and collaboration',
    spearfish_score: 8.9,
    team_size: 180,
    status: 'Active',
    is_hiring: true,
    tags: ['ML Tools', 'Developer', 'Experiment Tracking'],
    regions: ['San Francisco'],
    github_repos: [],
    huggingface_models: [],
  },
  {
    id: '9',
    name: 'Midjourney',
    batch: 'Independent',
    industry: 'Generative AI',
    one_liner: 'AI-powered image generation platform for creative professionals',
    spearfish_score: 8.8,
    team_size: 15,
    status: 'Active',
    is_hiring: false,
    tags: ['Image Generation', 'Creative', 'AI Art'],
    regions: ['San Francisco'],
    github_repos: [],
    huggingface_models: [],
  },
  {
    id: '10',
    name: 'Notion AI',
    batch: 'S13',
    industry: 'Productivity',
    one_liner: 'AI-powered workspace for notes, docs, and collaboration',
    spearfish_score: 9.3,
    team_size: 400,
    status: 'Active',
    is_hiring: true,
    tags: ['Productivity', 'AI Writing', 'Workspace'],
    regions: ['San Francisco'],
    github_repos: [],
    huggingface_models: [],
  },
  {
    id: '11',
    name: 'Runway ML',
    batch: 'W18',
    industry: 'Creative AI',
    one_liner: 'AI tools for content creation and video editing',
    spearfish_score: 7.8,
    team_size: 90,
    status: 'Active',
    is_hiring: true,
    tags: ['Creative AI', 'Video', 'Content Creation'],
    regions: ['New York'],
    github_repos: [],
    huggingface_models: [],
  },
  {
    id: '12',
    name: 'Adept AI',
    batch: 'Independent',
    industry: 'AI Agents',
    one_liner: 'AI that can use software tools and APIs to help with work',
    spearfish_score: 8.1,
    team_size: 65,
    status: 'Active',
    is_hiring: true,
    tags: ['AI Agents', 'Automation', 'Software Tools'],
    regions: ['San Francisco'],
    github_repos: [],
    huggingface_models: [],
  },
  {
    id: '13',
    name: 'Character.AI',
    batch: 'Independent',
    industry: 'Conversational AI',
    one_liner: 'Platform for creating and chatting with AI characters',
    spearfish_score: 7.5,
    team_size: 45,
    status: 'Active',
    is_hiring: true,
    tags: ['Conversational AI', 'Characters', 'Entertainment'],
    regions: ['Palo Alto'],
    github_repos: [],
    huggingface_models: [],
  },
  {
    id: '14',
    name: 'LangChain',
    batch: 'Independent',
    industry: 'AI Development',
    one_liner: 'Framework for building applications with large language models',
    spearfish_score: 8.6,
    team_size: 30,
    status: 'Active',
    is_hiring: true,
    tags: ['LLM Framework', 'Developer Tools', 'Open Source'],
    regions: ['San Francisco'],
    github_repos: [],
    huggingface_models: [],
  },
  {
    id: '15',
    name: 'Pinecone',
    batch: 'W21',
    industry: 'Vector Database',
    one_liner: 'Vector database for machine learning applications',
    spearfish_score: 8.3,
    team_size: 85,
    status: 'Active',
    is_hiring: true,
    tags: ['Vector DB', 'ML Infrastructure', 'Search'],
    regions: ['New York'],
    github_repos: [],
    huggingface_models: [],
  },
  {
    id: '16',
    name: 'Jasper AI',
    batch: 'Independent',
    industry: 'AI Writing',
    one_liner: 'AI writing assistant for marketing and content creation',
    spearfish_score: 7.2,
    team_size: 220,
    status: 'Active',
    is_hiring: true,
    tags: ['AI Writing', 'Marketing', 'Content'],
    regions: ['Austin'],
    github_repos: [],
    huggingface_models: [],
  },
  {
    id: '17',
    name: 'Perplexity AI',
    batch: 'Independent',
    industry: 'AI Search',
    one_liner: 'AI-powered search engine for accurate information discovery',
    spearfish_score: 8.0,
    team_size: 35,
    status: 'Active',
    is_hiring: true,
    tags: ['AI Search', 'Information', 'Research'],
    regions: ['San Francisco'],
    github_repos: [],
    huggingface_models: [],
  },
  {
    id: '18',
    name: 'Cerebras',
    batch: 'Independent',
    industry: 'AI Hardware',
    one_liner: 'AI compute platform with purpose-built chips for deep learning',
    spearfish_score: 7.7,
    team_size: 310,
    status: 'Active',
    is_hiring: true,
    tags: ['AI Hardware', 'Deep Learning', 'Compute'],
    regions: ['Sunnyvale'],
    github_repos: [],
    huggingface_models: [],
  },
  {
    id: '19',
    name: 'Mistral AI',
    batch: 'Independent',
    industry: 'Language Models',
    one_liner: 'Open-source large language models for enterprise applications',
    spearfish_score: 8.5,
    team_size: 55,
    status: 'Active',
    is_hiring: true,
    tags: ['Open Source', 'LLM', 'Enterprise'],
    regions: ['Paris'],
    github_repos: [],
    huggingface_models: [],
  },
  {
    id: '20',
    name: 'Inflection AI',
    batch: 'Independent',
    industry: 'Conversational AI',
    one_liner: 'Personal AI companion focused on emotional intelligence',
    spearfish_score: 7.9,
    team_size: 75,
    status: 'Active',
    is_hiring: false,
    tags: ['Conversational AI', 'Emotional Intelligence', 'Personal AI'],
    regions: ['Palo Alto'],
    github_repos: [],
    huggingface_models: [],
  }
];

export function CompanyDiscoveryClient({ searchQuery, selectedTags, filters }: CompanyDiscoveryClientProps) {
  const [companies, setCompanies] = useState<CompanyWithScore[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<CompanyWithScore[]>([]);
  const [displayedCompanies, setDisplayedCompanies] = useState<CompanyWithScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'score' | 'name' | 'batch' | 'team_size'>('score');
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    // Simulate API call with mock data
    const fetchCompanies = async () => {
      try {
        setLoading(true);
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        setCompanies(mockCompanies);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchCompanies();
  }, []);

  // Filter and sort companies when search query, tags, filters, or sortBy changes
  useEffect(() => {
    if (companies.length > 0) {
      let filtered = [...companies];
      
      // Apply search filter
      if (searchQuery && searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(company => 
          company.name.toLowerCase().includes(query) ||
          company.one_liner?.toLowerCase().includes(query) ||
          company.industry?.toLowerCase().includes(query) ||
          company.batch?.toLowerCase().includes(query) ||
          company.long_description?.toLowerCase().includes(query)
        );
      }
      
      // Apply tag filters
      if (selectedTags && selectedTags.length > 0) {
        filtered = filtered.filter(company => {
          const companyText = `${company.name} ${company.one_liner} ${company.industry} ${company.long_description}`.toLowerCase();
          return selectedTags.some(tag => 
            companyText.includes(tag.toLowerCase().replace('#', '').replace('+', ''))
          );
        });
      }
      
      // Apply sidebar filters
      if (filters) {
        // Spearfish Score filter
        if (filters.spearfishScore.length > 0) {
          filtered = filtered.filter(company => {
            const score = company.spearfish_score || 0;
            return filters.spearfishScore.some(range => {
              switch (range) {
                case '8-10':
                  return score >= 8 && score <= 10;
                case '6-8':
                  return score >= 6 && score < 8;
                case '4-6':
                  return score >= 4 && score < 6;
                case '2-4':
                  return score >= 2 && score < 4;
                default:
                  return false;
              }
            });
          });
        }
        
        // YC Batch filter
        if (filters.ycBatch.length > 0) {
          filtered = filtered.filter(company => 
            filters.ycBatch.includes(company.batch || '')
          );
        }
        
        // Team Size filter
        if (filters.teamSize.length > 0) {
          filtered = filtered.filter(company => {
            const teamSize = company.team_size || 0;
            return filters.teamSize.some(range => {
              switch (range) {
                case '1-10':
                  return teamSize >= 1 && teamSize <= 10;
                case '11-50':
                  return teamSize >= 11 && teamSize <= 50;
                case '51-200':
                  return teamSize >= 51 && teamSize <= 200;
                case '200+':
                  return teamSize > 200;
                default:
                  return false;
              }
            });
          });
        }
        
        // Tech Stack filter
        if (filters.techStack.length > 0) {
          filtered = filtered.filter(company => {
            const companyText = `${company.name} ${company.one_liner} ${company.industry} ${company.long_description}`.toLowerCase();
            return filters.techStack.some(tech => 
              companyText.includes(tech.toLowerCase())
            );
          });
        }
        
        // Hiring Status filter
        if (filters.hiringStatus.length > 0) {
          filtered = filtered.filter(company => {
            return filters.hiringStatus.some(status => {
              switch (status) {
                case 'hiring':
                  return company.is_hiring === true;
                case 'funded':
                  // For now, we'll consider companies with high spearfish scores as recently funded
                  return (company.spearfish_score || 0) >= 8;
                default:
                  return false;
              }
            });
          });
        }
      }
      
      // Apply sorting
      const sortedCompanies = filtered.sort((a, b) => {
        switch (sortBy) {
          case 'score':
            return (b.spearfish_score || 0) - (a.spearfish_score || 0);
          case 'name':
            return a.name.localeCompare(b.name);
          case 'batch':
            return (a.batch || '').localeCompare(b.batch || '');
          case 'team_size':
            return (b.team_size || 0) - (a.team_size || 0);
          default:
            return 0;
        }
      });
      
      setFilteredCompanies(sortedCompanies);
      // Reset pagination when filters change
      setCurrentPage(1);
      setHasMore(sortedCompanies.length > ITEMS_PER_PAGE);
    }
  }, [companies, searchQuery, selectedTags, filters, sortBy]);

  // Update displayed companies when filtered companies or page changes
  useEffect(() => {
    if (filteredCompanies.length > 0) {
      const startIndex = 0;
      const endIndex = currentPage * ITEMS_PER_PAGE;
      const paginatedCompanies = filteredCompanies.slice(startIndex, endIndex);
      
      setDisplayedCompanies(paginatedCompanies);
      setHasMore(endIndex < filteredCompanies.length);
    } else {
      setDisplayedCompanies([]);
      setHasMore(false);
    }
  }, [filteredCompanies, currentPage]);

  // Load more companies for infinite scroll
  const loadMoreCompanies = async () => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setCurrentPage(prev => prev + 1);
    setLoadingMore(false);
  };

  // Infinite scroll detection
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 1000) {
        if (!loadingMore && hasMore) {
          loadMoreCompanies();
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadingMore, hasMore]);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Loading skeletons */}
        {[...Array(6)].map((_, index) => (
          <div key={index} className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6 animate-pulse">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="h-6 bg-slate-700 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-slate-700 rounded w-1/2 mb-4"></div>
                <div className="h-4 bg-slate-700 rounded w-full mb-2"></div>
                <div className="h-4 bg-slate-700 rounded w-2/3"></div>
              </div>
              <div className="h-12 w-12 bg-slate-700 rounded-full ml-4"></div>
            </div>
            <div className="flex gap-2 mt-4">
              <div className="h-6 bg-slate-700 rounded w-16"></div>
              <div className="h-6 bg-slate-700 rounded w-20"></div>
              <div className="h-6 bg-slate-700 rounded w-18"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-300">Error loading companies</h3>
            <p className="text-sm text-red-200 mt-1">{error}</p>
          </div>
        </div>
        <div className="mt-4">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (displayedCompanies.length === 0 && !loading) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-12 text-center">
        <div className="mx-auto h-12 w-12 text-slate-400">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0v-3.15M7 13h10v-3.15M7 9.85l2.5-2.5L12 9.85l2.5-2.5L17 9.85" />
          </svg>
        </div>
        <h3 className="mt-2 text-sm font-medium text-slate-300">No companies found</h3>
        <p className="mt-1 text-sm text-slate-400">
          Try adjusting your filters or search terms to find companies.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Results Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">
            {filteredCompanies.length} companies found
          </h3>
          {filters && (
            <div className="flex items-center space-x-2 mt-1">
              {/* Active filters indicator */}
              {(filters.spearfishScore.length > 0 || filters.ycBatch.length > 0 || 
                filters.teamSize.length > 0 || filters.techStack.length > 0 || 
                filters.hiringStatus.length > 0) && (
                <span className="text-xs text-slate-400">
                  {filters.spearfishScore.length + filters.ycBatch.length + 
                   filters.teamSize.length + filters.techStack.length + 
                   filters.hiringStatus.length} filters active
                </span>
              )}
              {searchQuery && (
                <span className="text-xs text-slate-400">
                  • Search: "{searchQuery}"
                </span>
              )}
              {selectedTags && selectedTags.length > 0 && (
                <span className="text-xs text-slate-400">
                  • Tags: {selectedTags.length}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-slate-300">Sort by:</span>
          <select 
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'score' | 'name' | 'batch' | 'team_size')}
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="score">Spearfish Score</option>
            <option value="name">Company Name</option>
            <option value="batch">YC Batch</option>
            <option value="team_size">Team Size</option>
          </select>
        </div>
      </div>

      {/* Company Cards */}
      <div className="space-y-4">
        {displayedCompanies.map((company) => (
          <CompanyCard key={company.id} company={company} />
        ))}
      </div>

      {/* Loading More Indicator */}
      {loadingMore && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          <span className="ml-3 text-slate-400">Loading more companies...</span>
        </div>
      )}

      {/* Load More Button - shown when there are more items but not loading */}
      {hasMore && !loadingMore && displayedCompanies.length > 0 && (
        <div className="text-center pt-8">
          <button 
            onClick={loadMoreCompanies}
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-slate-300 hover:text-white transition-colors"
          >
            Load More Companies
          </button>
        </div>
      )}

      {/* End of Results Indicator */}
      {!hasMore && displayedCompanies.length > 0 && (
        <div className="text-center pt-8">
          <p className="text-slate-400 text-sm">
            You've reached the end of the results
          </p>
        </div>
      )}
    </div>
  );
}