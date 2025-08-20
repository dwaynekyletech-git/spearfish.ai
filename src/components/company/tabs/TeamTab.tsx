/**
 * Team Tab Component
 * 
 * Enhanced team member information, job postings, and enrichment data.
 * Supports Apify-enriched data with comprehensive founder profiles and job listings.
 */

import { useState, useEffect } from 'react';

interface FounderProfile {
  id: string;
  name: string;
  title: string;
  bio?: string;
  linkedin_url?: string;
  twitter_url?: string;
  email?: string;
  image_url?: string;
  source_url?: string;
  data_source?: string;
  apify_scraped_at?: string;
  apify_founder_id?: number; // NEW
}

interface JobPosting {
  id: string;
  title: string;
  description?: string;
  location?: string;
  remote_ok: boolean;
  apply_url?: string;
  job_type?: string;
  experience_level?: string;
  department?: string;
  posted_at?: string;
  data_source: string;
  // NEW: Enhanced job fields
  salary?: string;
  years_experience?: string;
  description_url?: string;
  apify_job_id?: number;
}

interface EnrichmentInfo {
  needs_enrichment: boolean;
  data_freshness: string;
  apify_available: boolean;
  last_enriched?: string;
  data_source: string;
}

interface TeamDataStats {
  founders_count: number;
  jobs_count: number;
  founders_with_linkedin: number;
  founders_with_bios: number;
  remote_jobs_count: number;
}

interface FundingSummary {
  total_funding?: string;
  key_investors: string[];
  sources: string[];
  last_updated: string;
}

interface TeamTabProps {
  company: any;
}

export function TeamTab({ company }: TeamTabProps) {
  const [founders, setFounders] = useState<FounderProfile[]>([]);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [funding, setFunding] = useState<FundingSummary | null>(null);
  const [enrichment, setEnrichment] = useState<EnrichmentInfo | null>(null);
  const [stats, setStats] = useState<TeamDataStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getTeamSizeCategory = (size: number) => {
    if (size <= 2) return 'Early Stage';
    if (size <= 10) return 'Startup';
    if (size <= 50) return 'Growing Company';
    if (size <= 200) return 'Established Company';
    return 'Large Company';
  };

  // Fetch enhanced team data
  useEffect(() => {
    const fetchTeamData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/companies/${company.id}/team`);
        if (!response.ok) {
          throw new Error('Failed to fetch team data');
        }

        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to load team data');
        }

        // Handle enhanced API response structure
        if (result.data) {
          setFounders(result.data.founders || []);
          setJobs(result.data.jobs || []);
          setFunding(result.data.funding);
          setEnrichment(result.data.enrichment);
          setStats(result.data.stats);
        } else {
          // Fallback for legacy API response
          setFounders(result.founders || []);
          setFunding(result.funding);
          setJobs([]);
          setEnrichment(null);
          setStats(null);
        }
      } catch (err) {
        console.error('Error fetching team data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load team data');
      } finally {
        setLoading(false);
      }
    };

    if (company?.id) {
      fetchTeamData();
    }
  }, [company?.id]);

  // Helper function to trigger enrichment
  const triggerEnrichment = async (force = false) => {
    try {
      setEnriching(true);
      setError(null);
      
      const response = await fetch(`/api/companies/${company.id}/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enrich', force })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Refresh data after successful enrichment
        if (result.data) {
          setFounders(result.data.founders || []);
          setJobs(result.data.jobs || []);
          setFunding(result.data.funding);
          setEnrichment(result.data.enrichment);
          setStats(result.data.stats);
        } else {
          // Fallback
          setFounders(result.founders || []);
          setFunding(result.funding);
        }
      } else {
        setError(result.error || 'Failed to enrich team data');
      }
    } catch (err) {
      console.error('Error enriching team data:', err);
      setError(err instanceof Error ? err.message : 'Network error while enriching data');
    } finally {
      setEnriching(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Team Overview */}
      <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Team Overview</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Team Size */}
          <div className="bg-slate-900/50 rounded-lg p-4">
            <h4 className="text-lg font-medium text-white mb-2">Team Size</h4>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold text-purple-400">
                {company.team_size || 'Unknown'}
              </span>
              {company.team_size && (
                <div>
                  <span className="text-slate-300">employees</span>
                  <p className="text-slate-400 text-sm">
                    {getTeamSizeCategory(company.team_size)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Hiring Status */}
          <div className="bg-slate-900/50 rounded-lg p-4">
            <h4 className="text-lg font-medium text-white mb-2">Hiring Status</h4>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${company.is_hiring ? 'bg-green-400' : 'bg-slate-500'}`} />
              <span className={`font-medium ${company.is_hiring ? 'text-green-400' : 'text-slate-400'}`}>
                {company.is_hiring ? 'Currently Hiring' : 'Not Hiring'}
              </span>
            </div>
            {company.is_hiring && (
              <p className="text-slate-400 text-sm mt-1">
                Check their website for open positions
              </p>
            )}
          </div>
        </div>

        {/* Company Growth Insights */}
        <div className="mt-6 bg-slate-900/50 rounded-lg p-4">
          <h4 className="text-lg font-medium text-white mb-4">Company Growth Insights</h4>
          
          {/* Company Age & Stage Analysis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <h5 className="text-slate-300 font-medium mb-2">Company Maturity</h5>
              {company.launched_at ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Age</span>
                    <span className="text-slate-200 font-medium">
                      {(() => {
                        const founded = new Date(company.launched_at * 1000);
                        const now = new Date();
                        const years = Math.floor((now.getTime() - founded.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
                        const months = Math.floor(((now.getTime() - founded.getTime()) % (365.25 * 24 * 60 * 60 * 1000)) / (30 * 24 * 60 * 60 * 1000));
                        return years > 0 ? `${years}y ${months}m` : `${months} months`;
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Founded</span>
                    <span className="text-slate-200 font-medium">
                      {new Date(company.launched_at * 1000).getFullYear()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Stage</span>
                    <span className="text-purple-400 font-medium">
                      {(() => {
                        const age = (new Date().getTime() - new Date(company.launched_at * 1000).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
                        if (age < 1) return 'Very Early';
                        if (age < 2) return 'Early Stage';
                        if (age < 4) return 'Growth Stage';
                        return 'Mature';
                      })()}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-slate-400 text-sm">Founded date not available</p>
              )}
            </div>

            <div>
              <h5 className="text-slate-300 font-medium mb-2">YC Information</h5>
              <div className="space-y-2">
                {company.batch && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">YC Batch</span>
                    <span className="text-orange-400 font-medium">{company.batch}</span>
                  </div>
                )}
                {company.primary_partner && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">YC Partner</span>
                    <span className="text-yellow-400 font-medium">{company.primary_partner}</span>
                  </div>
                )}
                {company.year_founded && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Year Founded</span>
                    <span className="text-blue-400 font-medium">{company.year_founded}</span>
                  </div>
                )}
                {company.status && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Status</span>
                    <span className={`font-medium ${
                      company.status === 'Active' ? 'text-green-400' : 
                      company.status === 'Acquired' ? 'text-blue-400' : 
                      'text-slate-300'
                    }`}>
                      {company.status}
                    </span>
                  </div>
                )}
                {company.batch && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Batch Age</span>
                    <span className="text-slate-200 font-medium">
                      {(() => {
                        const year = parseInt(company.batch.slice(1));
                        const season = company.batch.charAt(0);
                        const batchYear = season === 'W' ? year : year;
                        const currentYear = new Date().getFullYear();
                        const age = currentYear - batchYear;
                        return `${age} years`;
                      })()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Team Growth Projection */}
          {company.team_size && (
            <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
              <h5 className="text-slate-300 font-medium mb-2">Team Growth Analysis</h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-slate-400">Current Size</div>
                  <div className="text-2xl font-bold text-purple-400">{company.team_size}</div>
                </div>
                <div className="text-center">
                  <div className="text-slate-400">Stage Typical</div>
                  <div className="text-lg font-medium text-slate-300">
                    {(() => {
                      if (company.team_size <= 2) return '1-5';
                      if (company.team_size <= 10) return '2-15';
                      if (company.team_size <= 50) return '10-100';
                      return '50-500+';
                    })()}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-slate-400">Growth Phase</div>
                  <div className={`text-lg font-medium ${
                    company.is_hiring ? 'text-green-400' : 'text-slate-400'
                  }`}>
                    {company.is_hiring ? 'Expanding' : 'Stable'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Technical Team Insights */}
      {company.github_repos && Array.isArray(company.github_repos) && company.github_repos.length > 0 && (
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Technical Team Insights</h3>
          
          {/* Technical Skills Analysis */}
          <div className="mb-6">
            <h4 className="text-lg font-medium text-white mb-3">Technical Expertise</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Programming Languages */}
              <div className="bg-slate-900/50 rounded-lg p-4">
                <h5 className="text-slate-200 font-medium mb-2">Programming Languages</h5>
                <div className="space-y-2">
                  {(() => {
                    const languages = company.github_repos
                      .map((repo: any) => repo.language)
                      .filter(Boolean)
                      .reduce((acc: any, lang: string) => {
                        acc[lang] = (acc[lang] || 0) + 1;
                        return acc;
                      }, {});
                    
                    const topLanguages = Object.entries(languages)
                      .sort(([,a]: any, [,b]: any) => b - a)
                      .slice(0, 4);

                    return topLanguages.length > 0 ? (
                      topLanguages.map(([lang, count]: any) => (
                        <div key={lang} className="flex justify-between items-center">
                          <span className="text-slate-300 text-sm">{lang}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-slate-700 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className="bg-blue-400 h-full"
                                style={{ width: `${(count / Math.max(...Object.values(languages).map(Number))) * 100}%` }}
                              />
                            </div>
                            <span className="text-slate-400 text-xs w-8">{count}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-400 text-sm">No language data available</p>
                    );
                  })()}
                </div>
              </div>

              {/* Repository Activity */}
              <div className="bg-slate-900/50 rounded-lg p-4">
                <h5 className="text-slate-200 font-medium mb-2">Development Activity</h5>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300 text-sm">Total Repositories</span>
                    <span className="text-purple-400 font-medium">{company.github_repos.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300 text-sm">Total Stars</span>
                    <span className="text-yellow-400 font-medium">
                      {company.github_repos.reduce((sum: number, repo: any) => sum + (repo.stars || 0), 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300 text-sm">Active Projects</span>
                    <span className="text-green-400 font-medium">
                      {company.github_repos.filter((repo: any) => !repo.archived).length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300 text-sm">Recent Updates</span>
                    <span className="text-blue-400 font-medium">
                      {company.github_repos.filter((repo: any) => {
                        const updated = new Date(repo.updated_at);
                        const sixMonthsAgo = new Date();
                        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                        return updated > sixMonthsAgo;
                      }).length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Most Active Repositories */}
          <div className="mb-6">
            <h4 className="text-lg font-medium text-white mb-3">Most Active Projects</h4>
            <div className="space-y-3">
              {company.github_repos
                .sort((a: any, b: any) => (b.stars || 0) + (b.forks || 0) - ((a.stars || 0) + (a.forks || 0)))
                .slice(0, 3)
                .map((repo: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h5 className="text-slate-200 font-medium text-sm">{repo.name}</h5>
                        {repo.language && (
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full">
                            {repo.language}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        {repo.stars && <span>⭐ {repo.stars}</span>}
                        {repo.forks && <span>🍴 {repo.forks}</span>}
                        {repo.updated_at && (
                          <span>Updated: {new Date(repo.updated_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    {repo.url && (
                      <a
                        href={repo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-3 px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded hover:bg-purple-500/30 transition-colors"
                      >
                        View
                      </a>
                    )}
                  </div>
                ))}
            </div>
          </div>

          {/* GitHub Organization Link */}
          {company.github_repos.length > 0 && (
            <div className="text-center pt-4 border-t border-slate-700/50">
              <p className="text-slate-400 text-sm mb-3">
                Technical team members may be visible as contributors in public repositories
              </p>
              <div className="flex justify-center gap-3">
                {company.website_url && (
                  <a
                    href={company.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-slate-700/50 text-slate-300 text-sm rounded-md hover:bg-slate-600/50 transition-colors"
                  >
                    Visit Website
                  </a>
                )}
                <a
                  href={`https://github.com/search?q=${encodeURIComponent(company.name)}&type=users`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-purple-500/20 text-purple-300 text-sm rounded-md hover:bg-purple-500/30 transition-colors"
                >
                  Search GitHub
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Team Member Profiles */}
      <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-semibold text-white">Team & Jobs</h3>
            {/* Enhanced Data Quality Indicators */}
            {!loading && !error && (
              <div className="flex items-center gap-2">
                {/* Founders Status */}
                {founders.length > 0 ? (
                  <div className="flex items-center gap-1 px-2 py-1 bg-green-600/20 text-green-300 border border-green-500/30 rounded-full text-xs">
                    <span>✓</span>
                    <span>{founders.length} founder{founders.length !== 1 ? 's' : ''}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 px-2 py-1 bg-amber-600/20 text-amber-300 border border-amber-500/30 rounded-full text-xs">
                    <span>⚠️</span>
                    <span>No founders yet</span>
                  </div>
                )}

                {/* Jobs Status */}
                {jobs.length > 0 ? (
                  <div className="flex items-center gap-1 px-2 py-1 bg-blue-600/20 text-blue-300 border border-blue-500/30 rounded-full text-xs">
                    <span>💼</span>
                    <span>{jobs.length} job{jobs.length !== 1 ? 's' : ''}</span>
                  </div>
                ) : company.is_hiring ? (
                  <div className="flex items-center gap-1 px-2 py-1 bg-purple-600/20 text-purple-300 border border-purple-500/30 rounded-full text-xs">
                    <span>🔍</span>
                    <span>Check website</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 px-2 py-1 bg-slate-600/20 text-slate-300 border border-slate-500/30 rounded-full text-xs">
                    <span>💼</span>
                    <span>No jobs</span>
                  </div>
                )}

                {/* Data Freshness Indicator */}
                {enrichment && (
                  <div className={`flex items-center gap-1 px-2 py-1 border rounded-full text-xs ${
                    enrichment.data_freshness === 'very_fresh' ? 'bg-green-600/20 text-green-300 border-green-500/30' :
                    enrichment.data_freshness === 'fresh' ? 'bg-blue-600/20 text-blue-300 border-blue-500/30' :
                    enrichment.data_freshness === 'stale' ? 'bg-amber-600/20 text-amber-300 border-amber-500/30' :
                    enrichment.data_freshness === 'very_stale' ? 'bg-red-600/20 text-red-300 border-red-500/30' :
                    'bg-slate-600/20 text-slate-300 border-slate-500/30'
                  }`}>
                    <span>{
                      enrichment.data_source === 'apify' ? '🚀' : 
                      enrichment.data_source === 'yc-oss' ? '📊' : '🔍'
                    }</span>
                    <span>{
                      enrichment.data_freshness === 'very_fresh' ? 'Fresh data' :
                      enrichment.data_freshness === 'fresh' ? 'Recent data' :
                      enrichment.data_freshness === 'stale' ? 'Stale data' :
                      enrichment.data_freshness === 'very_stale' ? 'Old data' :
                      'No enrichment'
                    }</span>
                  </div>
                )}
              </div>
            )}
            {loading && (
              <div className="flex items-center gap-1 px-2 py-1 bg-blue-600/20 text-blue-300 border border-blue-500/30 rounded-full text-xs">
                <div className="w-3 h-3 border border-blue-300 border-t-transparent rounded-full animate-spin"></div>
                <span>Loading team data...</span>
              </div>
            )}
            {enriching && (
              <div className="flex items-center gap-1 px-2 py-1 bg-purple-600/20 text-purple-300 border border-purple-500/30 rounded-full text-xs">
                <div className="w-3 h-3 border border-purple-300 border-t-transparent rounded-full animate-spin"></div>
                <span>Enriching data...</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {/* Enrich Data Button */}
            {!loading && !enriching && enrichment?.needs_enrichment && (
              <button
                onClick={() => triggerEnrichment(false)}
                disabled={enriching}
                className="px-3 py-1 bg-purple-600/20 text-purple-300 border border-purple-500/30 rounded-md hover:bg-purple-600/30 transition-colors text-sm font-medium disabled:opacity-50"
              >
                🚀 Enrich Data
              </button>
            )}

            {/* Force Refresh Button */}
            {!loading && !enriching && enrichment?.apify_available && (
              <button
                onClick={() => triggerEnrichment(true)}
                disabled={enriching}
                className="px-3 py-1 bg-slate-600/20 text-slate-300 border border-slate-500/30 rounded-md hover:bg-slate-600/30 transition-colors text-sm font-medium disabled:opacity-50"
              >
                ↻ Force Refresh
              </button>
            )}

            {/* Apify Not Available */}
            {!loading && enrichment && !enrichment.apify_available && (
              <span className="text-xs text-slate-400 px-2 py-1 bg-slate-700/50 rounded-md">
                Enrichment unavailable
              </span>
            )}
            
            {/* Data Source and Freshness Info */}
            {enrichment?.last_enriched && (
              <span className="text-xs text-slate-400">
                Enriched {new Date(enrichment.last_enriched).toLocaleDateString()}
                {enrichment.data_source && (
                  <span className="ml-1 px-1 bg-slate-700/50 rounded text-xxs">
                    {enrichment.data_source === 'apify' ? '🚀 Apify' : '📊 YC-OSS'}
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-400">Loading team data...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h4 className="text-lg font-medium text-white mb-2">Unable to Load Team Data</h4>
            <p className="text-slate-400 mb-4">{error}</p>
          </div>
        ) : founders.length > 0 ? (
          <div className="space-y-6">
            {/* Founders Section */}
            <div>
              <h4 className="text-lg font-medium text-white mb-4">Founders & Leadership</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {founders.map((founder) => (
                  <div key={founder.id} className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/30">
                    <div className="flex items-start gap-4">
                      {/* Enhanced Avatar */}
                      <div className="flex-shrink-0">
                        {founder.image_url ? (
                          <img
                            src={founder.image_url}
                            alt={founder.name}
                            className="w-14 h-14 rounded-full object-cover border-2 border-slate-600/50"
                            onError={(e) => {
                              // Fallback to initials if image fails to load
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const fallback = target.nextElementSibling as HTMLElement;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div className={`w-14 h-14 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center ${founder.image_url ? 'hidden' : 'flex'}`}>
                          <span className="text-white font-medium text-lg">
                            {founder.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </span>
                        </div>
                      </div>
                      
                      {/* Enhanced Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h5 className="text-slate-200 font-medium text-lg mb-1">{founder.name}</h5>
                            <p className="text-purple-400 text-sm font-medium">{founder.title}</p>
                          </div>
                          
                          {/* Data Source Indicator */}
                          {founder.data_source && (
                            <span className={`px-2 py-1 text-xs rounded-full border ${
                              founder.data_source === 'apify' 
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' 
                                : 'bg-slate-500/20 text-slate-300 border-slate-500/30'
                            }`}>
                              {founder.data_source === 'apify' ? '🚀 Apify' : '📊 Manual'}
                            </span>
                          )}
                        </div>
                        
                        {founder.bio && (
                          <p className="text-slate-300 text-sm mb-3 leading-relaxed">
                            {founder.bio.length > 120 ? `${founder.bio.substring(0, 120)}...` : founder.bio}
                          </p>
                        )}
                        
                        {/* Enhanced Social Links */}
                        <div className="flex flex-wrap gap-2">
                          {founder.linkedin_url && (
                            <a
                              href={founder.linkedin_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded hover:bg-blue-500/30 transition-colors border border-blue-500/30"
                            >
                              <span>💼</span>
                              LinkedIn
                            </a>
                          )}
                          {founder.twitter_url && (
                            <a
                              href={founder.twitter_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2 py-1 bg-sky-500/20 text-sky-300 text-xs rounded hover:bg-sky-500/30 transition-colors border border-sky-500/30"
                            >
                              <span>🐦</span>
                              Twitter
                            </a>
                          )}
                          {founder.email && (
                            <a
                              href={`mailto:${founder.email}`}
                              className="flex items-center gap-1 px-2 py-1 bg-slate-500/20 text-slate-300 text-xs rounded hover:bg-slate-500/30 transition-colors border border-slate-500/30"
                            >
                              <span>✉️</span>
                              Email
                            </a>
                          )}
                          {founder.source_url && (
                            <a
                              href={founder.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded hover:bg-green-500/30 transition-colors border border-green-500/30"
                            >
                              <span>🔗</span>
                              Profile
                            </a>
                          )}
                        </div>

                        {/* Data Freshness for Apify founders */}
                        {founder.data_source === 'apify' && founder.apify_scraped_at && (
                          <p className="text-xs text-slate-500 mt-2">
                            Enriched {new Date(founder.apify_scraped_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Job Postings Section */}
            {jobs.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-medium text-white">Open Positions</h4>
                  <span className="text-xs text-slate-400">
                    {jobs.filter(job => job.remote_ok).length > 0 && 
                      `${jobs.filter(job => job.remote_ok).length} remote-friendly`
                    }
                  </span>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  {jobs.map((job) => (
                    <div key={job.id} className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/30">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h5 className="text-slate-200 font-medium">{job.title}</h5>
                            {job.remote_ok && (
                              <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded-full border border-green-500/30">
                                Remote OK
                              </span>
                            )}
                            {job.job_type && (
                              <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full border border-blue-500/30">
                                {job.job_type}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-slate-400 mb-2">
                            {job.department && (
                              <span className="flex items-center gap-1">
                                <span>🏢</span>
                                {job.department}
                              </span>
                            )}
                            {job.experience_level && (
                              <span className="flex items-center gap-1">
                                <span>📊</span>
                                {job.experience_level}
                              </span>
                            )}
                            {job.years_experience && (
                              <span className="flex items-center gap-1">
                                <span>⏳</span>
                                {job.years_experience}
                              </span>
                            )}
                            {job.location && (
                              <span className="flex items-center gap-1">
                                <span>📍</span>
                                {job.location}
                              </span>
                            )}
                            {job.salary && (
                              <span className="flex items-center gap-1 text-green-400">
                                <span>💰</span>
                                {job.salary}
                              </span>
                            )}
                          </div>
                          
                          {job.description && (
                            <p className="text-slate-300 text-sm mb-3 line-clamp-2">
                              {job.description}
                            </p>
                          )}
                          
                          {job.posted_at && (
                            <p className="text-xs text-slate-500">
                              Posted {new Date(job.posted_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        
                        <div className="ml-4 flex gap-2 flex-shrink-0">
                          {job.description_url && (
                            <a
                              href={job.description_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-2 bg-blue-500/20 text-blue-300 text-sm rounded-md hover:bg-blue-500/30 transition-colors border border-blue-500/30"
                            >
                              Details
                            </a>
                          )}
                          {job.apply_url && job.apply_url !== job.description_url && (
                            <a
                              href={job.apply_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-2 bg-purple-500/20 text-purple-300 text-sm rounded-md hover:bg-purple-500/30 transition-colors border border-purple-500/30"
                            >
                              Apply
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Jobs Summary */}
                <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center text-sm">
                    <div>
                      <div className="text-slate-400">Total Positions</div>
                      <div className="text-lg font-medium text-purple-400">{jobs.length}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Remote-Friendly</div>
                      <div className="text-lg font-medium text-green-400">
                        {jobs.filter(job => job.remote_ok).length}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">With Salary</div>
                      <div className="text-lg font-medium text-emerald-400">
                        {jobs.filter(job => job.salary).length}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">Departments</div>
                      <div className="text-lg font-medium text-blue-400">
                        {new Set(jobs.map(job => job.department).filter(Boolean)).size}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">Entry Level</div>
                      <div className="text-lg font-medium text-orange-400">
                        {jobs.filter(job => job.experience_level === 'Junior' || job.experience_level === 'Internship').length}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Data Sources and Research Actions */}
            <div className="pt-4 border-t border-slate-700/50">
              {funding?.sources && funding.sources.length > 0 && (
                <p className="text-slate-400 text-xs mb-4 text-center">
                  Team data sourced from: {funding.sources.map(source => {
                    if (source.includes('ycombinator.com')) return 'Y Combinator';
                    if (source.includes('linkedin.com')) return 'LinkedIn';
                    return 'Company Website';
                  }).join(', ')}
                </p>
              )}
              
              {/* Research Actions */}
              <div className="flex justify-center gap-3">
                {company.website_url && (
                  <a
                    href={company.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-purple-500/20 text-purple-300 text-sm rounded-md hover:bg-purple-500/30 transition-colors"
                  >
                    Company Website
                  </a>
                )}
                <a
                  href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(company.name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-500/20 text-blue-300 text-sm rounded-md hover:bg-blue-500/30 transition-colors"
                >
                  LinkedIn Search
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m3 5.197V9a3 3 0 00-6 0v11.5a2.5 2.5 0 005 0z" />
              </svg>
            </div>
            <h4 className="text-lg font-medium text-white mb-2">No Founder Data Available</h4>
            <p className="text-slate-400 max-w-md mx-auto mb-4">
              Founder information hasn&apos;t been collected yet. Click &quot;Fetch Team Data&quot; above to automatically scrape founder profiles from Y Combinator.
            </p>
            
            {/* What We'll Collect */}
            <div className="bg-slate-900/30 rounded-lg p-4 max-w-lg mx-auto mb-6">
              <h5 className="text-slate-300 font-medium mb-2">What We&apos;ll Find</h5>
              <div className="text-slate-400 text-sm space-y-1">
                <p>• Founder names and titles from Y Combinator profiles</p>
                <p>• Professional bios and background information</p>
                <p>• LinkedIn and Twitter social profiles</p>
                <p>• Educational and work history when available</p>
              </div>
            </div>
            
            {/* Manual Research Options */}
            <div className="bg-blue-900/20 rounded-lg p-4 max-w-lg mx-auto mb-6">
              <h5 className="text-blue-300 font-medium mb-2">Manual Research Options</h5>
              <div className="text-blue-200 text-sm space-y-1">
                <p>• Check LinkedIn for company employees and founders</p>
                <p>• Visit company website &quot;About&quot; or &quot;Team&quot; pages</p>
                <p>• Search AngelList/Wellfound for detailed founder profiles</p>
                <p>• Look at GitHub contributors for technical co-founders</p>
              </div>
            </div>

            <div className="flex justify-center gap-3">
              {company.website_url && (
                <a
                  href={company.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-purple-500/20 text-purple-300 text-sm rounded-md hover:bg-purple-500/30 transition-colors"
                >
                  Company Website
                </a>
              )}
              <a
                href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(company.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-500/20 text-blue-300 text-sm rounded-md hover:bg-blue-500/30 transition-colors"
              >
                LinkedIn Search
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}