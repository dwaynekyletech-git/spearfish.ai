/**
 * Company Card Component
 * 
 * Individual company card displaying key metrics and spearfish score
 */

'use client';

import { ChevronRightIcon, MapPinIcon, UsersIcon, StarIcon, ArrowTrendingUpIcon, BuildingOfficeIcon, CodeBracketIcon, CheckCircleIcon, UserGroupIcon, BriefcaseIcon } from '@heroicons/react/24/outline';
import { CompanyData } from '@/lib/spearfish-scoring-service';
import { useRouter } from 'next/navigation';
import { useCompanyGitHubSummary } from '@/hooks/useCompanyGitHubData';
import { prefetchCompanyData, seedCompanyCache } from '@/lib/client-cache';
import { useEffect, useCallback, useRef } from 'react';

interface CompanyCardProps {
  company: CompanyData & {
    spearfish_score?: number;
    updated_at?: string;
    // Enrichment fields from Apify
    enrichment_complete?: boolean;
    enrichment_date?: string;
    founder_count?: number;
    active_job_count?: number;
    total_job_count?: number;
    company_image?: string;
    year_founded?: number;
    primary_partner?: string;
    data_source?: string;
    apify_scraped_at?: string;
  };
}

export function CompanyCard({ company }: CompanyCardProps) {
  const router = useRouter();
  const { summary: githubSummary, isLoading: githubLoading } = useCompanyGitHubSummary(company.id);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Seed cache with basic company data immediately
  useEffect(() => {
    seedCompanyCache(company.id, company);
  }, [company]);

  const handleClick = () => {
    // Store company data in sessionStorage for instant loading
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`company-${company.id}-initial`, JSON.stringify(company));
    }
    
    // Navigate to company page
    router.push(`/company/${company.id}`);
  };

  // Debounced hover handler for pre-fetching
  const handleMouseEnter = useCallback(() => {
    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    // Set a timeout to pre-fetch after 300ms hover
    hoverTimeoutRef.current = setTimeout(() => {
      prefetchCompanyData(company.id).catch(() => {
        // Silently handle pre-fetch failures
      });
    }, 300);
  }, [company.id]);

  const handleMouseLeave = useCallback(() => {
    // Cancel pre-fetch if user leaves quickly
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const getScoreColor = (score: number | undefined) => {
    if (!score) return 'text-slate-400';
    if (score >= 8) return 'text-green-400';
    if (score >= 6) return 'text-yellow-400';
    if (score >= 4) return 'text-orange-400';
    return 'text-red-400';
  };

  const getScoreLabel = (score: number | undefined) => {
    if (!score) return 'Not Scored';
    if (score >= 8) return 'Excellent';
    if (score >= 6) return 'Good';
    if (score >= 4) return 'Average';
    return 'Below Average';
  };

  const formatTeamSize = (teamSize: number | null | undefined) => {
    if (!teamSize) return 'Unknown';
    if (teamSize === 1) return '1 person';
    return `${teamSize} people`;
  };

  const getTechTags = (company: CompanyData) => {
    // Use real company tags from API if available
    if (company.tags && Array.isArray(company.tags) && company.tags.length > 0) {
      return company.tags.slice(0, 4); // Limit to 4 tags
    }
    
    // Fallback: extract basic tags from description if no tags in database
    const fallbackTags: string[] = [];
    const description = company.one_liner?.toLowerCase() || '';
    
    if (description.includes('ai') || description.includes('artificial intelligence')) fallbackTags.push('AI');
    if (description.includes('ml') || description.includes('machine learning')) fallbackTags.push('ML');
    if (description.includes('nlp')) fallbackTags.push('NLP');
    if (description.includes('api')) fallbackTags.push('API');
    
    // Final fallback if no tags found
    if (fallbackTags.length === 0) {
      fallbackTags.push('Tech');
    }
    
    return fallbackTags.slice(0, 4);
  };

  return (
    <div 
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6 hover:bg-slate-800/70 transition-all duration-200 cursor-pointer group"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Company Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="h-12 w-12 rounded-lg flex items-center justify-center overflow-hidden bg-slate-700">
                {company.small_logo_thumb_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img 
                    src={company.small_logo_thumb_url} 
                    alt={`${company.name} logo`}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      // Fallback to letter avatar if logo fails to load
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <span className={`text-white font-bold text-lg ${company.small_logo_thumb_url ? 'hidden' : ''}`}>
                  {company.name?.charAt(0).toUpperCase() || '?'}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white group-hover:text-purple-300 transition-colors">
                  {company.name}
                </h3>
                <div className="flex items-center space-x-2 text-sm text-slate-400">
                  <span className="px-2 py-1 bg-slate-700 rounded text-xs">
                    {company.batch || 'Unknown Batch'}
                  </span>
                  {company.status && (
                    <span className={`px-2 py-1 rounded text-xs ${
                      company.status === 'Active' 
                        ? 'bg-green-900/30 text-green-300' 
                        : 'bg-slate-700 text-slate-300'
                    }`}>
                      {company.status}
                    </span>
                  )}
                  {/* Growth Indicator */}
                  {(company.spearfish_score ?? 0) >= 8 && (
                    <div className="flex items-center space-x-1 text-green-400">
                      <ArrowTrendingUpIcon className="h-3 w-3" />
                      <span className="text-xs">High Growth</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Spearfish Score */}
            <div className="text-right min-w-[80px]">
              <div className="flex items-center justify-end space-x-1">
                <StarIcon className="h-4 w-4 text-yellow-400" />
                <span className={`text-lg font-bold ${getScoreColor(company.spearfish_score)}`}>
                  {company.spearfish_score?.toFixed(1) || '0.0'}
                </span>
              </div>
              <div className="text-xs text-slate-400">
                {getScoreLabel(company.spearfish_score)}
              </div>
            </div>
          </div>

          {/* Company Description */}
          <p className="text-slate-300 mb-4 text-sm leading-relaxed">
            {company.one_liner || company.long_description || 'No description available'}
          </p>

          {/* Company Details */}
          <div className="flex items-center flex-wrap gap-4 mb-4 text-sm text-slate-400">
            {company.industry && (
              <div className="flex items-center space-x-1">
                <BuildingOfficeIcon className="h-4 w-4" />
                <span>{company.industry}</span>
              </div>
            )}
            
            <div className="flex items-center space-x-1">
              <UsersIcon className="h-4 w-4" />
              <span>{formatTeamSize(company.team_size)}</span>
            </div>
            
            {company.regions && Array.isArray(company.regions) && company.regions.length > 0 && company.regions[0] && (
              <div className="flex items-center space-x-1">
                <MapPinIcon className="h-4 w-4" />
                <span>{company.regions[0]}</span>
              </div>
            )}
            
            {/* GitHub Stats */}
            {githubSummary && !githubLoading && (
              <>
                {githubSummary.total_stars > 0 && (
                  <div className="flex items-center space-x-1">
                    <StarIcon className="h-4 w-4 text-yellow-400" />
                    <span>{githubSummary.total_stars.toLocaleString()} stars</span>
                  </div>
                )}
                
                {githubSummary.monthly_star_growth > 100 && (
                  <div className="flex items-center space-x-1 text-green-400">
                    <ArrowTrendingUpIcon className="h-4 w-4" />
                    <span>+{Math.round(githubSummary.monthly_star_growth)}/mo</span>
                  </div>
                )}
                
                {githubSummary.primary_repository?.language && (
                  <div className="flex items-center space-x-1">
                    <CodeBracketIcon className="h-4 w-4" />
                    <span>{githubSummary.primary_repository.language}</span>
                  </div>
                )}
              </>
            )}
            
            {company.is_hiring && (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-green-400 font-medium">Hiring</span>
              </div>
            )}
          </div>

          {/* Enrichment Status Indicators */}
          {company.enrichment_complete && (
            <div className="flex flex-wrap gap-3 mb-3 text-xs">
              {/* Full Profile Indicator */}
              <div className="flex items-center gap-1 px-2 py-1 bg-green-900/20 text-green-400 rounded border border-green-500/30">
                <CheckCircleIcon className="h-3 w-3" />
                <span>Full Profile</span>
              </div>
              
              {/* Founder Count */}
              {company.founder_count && company.founder_count > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 bg-blue-900/20 text-blue-400 rounded border border-blue-500/30">
                  <UserGroupIcon className="h-3 w-3" />
                  <span>{company.founder_count} founder{company.founder_count !== 1 ? 's' : ''}</span>
                </div>
              )}
              
              {/* Active Jobs Count */}
              {company.active_job_count && company.active_job_count > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 bg-purple-900/20 text-purple-400 rounded border border-purple-500/30">
                  <BriefcaseIcon className="h-3 w-3" />
                  <span>{company.active_job_count} open position{company.active_job_count !== 1 ? 's' : ''}</span>
                </div>
              )}
              
              {/* Year Founded (if available) */}
              {company.year_founded && (
                <div className="flex items-center gap-1 px-2 py-1 bg-slate-700/50 text-slate-300 rounded">
                  <span>Founded {company.year_founded}</span>
                </div>
              )}
              
              {/* Primary Partner (if available) */}
              {company.primary_partner && (
                <div className="flex items-center gap-1 px-2 py-1 bg-orange-900/20 text-orange-400 rounded border border-orange-500/30">
                  <span>Partner: {company.primary_partner}</span>
                </div>
              )}
            </div>
          )}

          {/* Tech Tags */}
          <div className="flex flex-wrap gap-2">
            {getTechTags(company).map((tag, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-slate-700/50 text-slate-300 rounded-full text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Arrow Icon */}
        <div className="ml-4 flex-shrink-0">
          <ChevronRightIcon className="h-5 w-5 text-slate-400 group-hover:text-purple-300 transition-colors" />
        </div>
      </div>
    </div>
  );
}