/**
 * Opportunities Tab Component
 * 
 * Job opportunities and "Why Spearfish This Company" section
 */

'use client';

import { useState, useEffect } from 'react';

interface Job {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  apply_url?: string | null;
  salary?: string | null;
  years_experience?: string | null;
  job_type?: string | null;
  experience_level?: string | null;
  department?: string | null;
  remote_ok: boolean;
  posted_at?: string | null;
  created_at: string;
}

interface OpportunitiesTabProps {
  company: any;
}

export function OpportunitiesTab({ company }: OpportunitiesTabProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);

  // Fetch jobs when component mounts
  useEffect(() => {
    const fetchJobs = async () => {
      if (!company?.id) return;

      try {
        setJobsLoading(true);
        setJobsError(null);
        
        const response = await fetch(`/api/companies/${company.id}/jobs`);
        const data = await response.json();

        if (data.success) {
          setJobs(data.data || []);
        } else {
          setJobsError(data.error || 'Failed to fetch jobs');
        }
      } catch (error) {
        setJobsError('Failed to load job listings');
        console.error('Error fetching jobs:', error);
      } finally {
        setJobsLoading(false);
      }
    };

    fetchJobs();
  }, [company?.id]);

  // Generate spearfish reasons based on actual company data
  const getSpearfishReasons = () => {
    const reasons = [];
    
    // Score-based insights
    if (company.spearfish_score && company.spearfish_score >= 8) {
      reasons.push({
        icon: '🎯',
        title: 'High Spearfish Score',
        description: `Strong score of ${company.spearfish_score}/10 indicates excellent market positioning and growth potential.`,
        confidence: 'high'
      });
    }
    
    // Score breakdown insights (if available)
    if (company.scoreBreakdown) {
      const breakdown = company.scoreBreakdown.breakdown;
      
      if (breakdown.batchFocus >= 8) {
        reasons.push({
          icon: '🚀',
          title: 'Target Batch Company',
          description: `From ${company.batch} batch, which is highly valued by our algorithm.`,
          confidence: 'high'
        });
      }
      
      if (breakdown.companyAge >= 7) {
        reasons.push({
          icon: '⏰',
          title: 'Optimal Company Age',
          description: 'Company age is in the sweet spot for growth and market traction.',
          confidence: 'medium'
        });
      }
      
      if (breakdown.fundingStage >= 7) {
        reasons.push({
          icon: '💰',
          title: 'Strong Funding Position',
          description: 'Company is in an optimal funding stage for growth and expansion.',
          confidence: 'medium'
        });
      }
      
      if (breakdown.githubActivity >= 6) {
        reasons.push({
          icon: '💻',
          title: 'Active Technical Development',
          description: 'Strong GitHub activity indicates robust technical team and product development.',
          confidence: 'medium'
        });
      }
    }
    
    if (company.batch && ['W24', 'S24', 'W23', 'S23'].includes(company.batch)) {
      reasons.push({
        icon: '🚀',
        title: 'Recent YC Graduate',
        description: `${company.batch} batch company with fresh momentum and Y Combinator backing.`
      });
    }
    
    if (company.is_hiring) {
      reasons.push({
        icon: '📈',
        title: 'Actively Hiring',
        description: 'Currently expanding team, indicating growth phase and new opportunities.'
      });
    }
    
    if (company.tags && Array.isArray(company.tags) && company.tags.some((tag: string) => ['AI', 'ML', 'Machine Learning', 'Artificial Intelligence'].includes(tag))) {
      reasons.push({
        icon: '🤖',
        title: 'AI-First Company',
        description: 'Building in the AI space with strong technical fundamentals and market demand.'
      });
    }
    
    if (company.team_size && company.team_size >= 10 && company.team_size <= 50) {
      reasons.push({
        icon: '⚡',
        title: 'Optimal Team Size',
        description: `Team of ${company.team_size} is at the sweet spot for rapid execution and meaningful impact.`
      });
    }
    
    if (company.github_repos && Array.isArray(company.github_repos) && company.github_repos.length > 0) {
      reasons.push({
        icon: '💻',
        title: 'Strong Engineering',
        description: `Active GitHub presence with ${company.github_repos.length} repositories showing technical depth.`
      });
    }
    
    // Add industry-specific reasons
    if (company.industry && ['Artificial Intelligence', 'Machine Learning', 'Developer Tools'].includes(company.industry)) {
      reasons.push({
        icon: '🔧',
        title: 'High-Growth Industry',
        description: `Operating in ${company.industry}, a rapidly expanding market with significant opportunities.`
      });
    }
    
    return reasons;
  };

  const spearfishReasons = getSpearfishReasons();

  return (
    <div className="space-y-6">
      {/* Why Spearfish This Company */}
      <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Why Spearfish This Company</h3>
        
        {spearfishReasons.length > 0 ? (
          <div className="space-y-4">
            {spearfishReasons.map((reason, index) => (
              <div key={index} className="flex items-start gap-3 p-4 bg-slate-900/50 rounded-lg">
                <span className="text-2xl">{reason.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-slate-200 font-medium">{reason.title}</h4>
                    {reason.confidence && (
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        reason.confidence === 'high' 
                          ? 'bg-green-500/20 text-green-300' 
                          : reason.confidence === 'medium'
                          ? 'bg-yellow-500/20 text-yellow-300'
                          : 'bg-slate-500/20 text-slate-300'
                      }`}>
                        {reason.confidence} confidence
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-sm">{reason.description}</p>
                </div>
              </div>
            ))}
            
            {/* Overall Assessment */}
            <div className="mt-6 p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <h4 className="text-purple-300 font-medium mb-2">Overall Assessment</h4>
              <p className="text-slate-300 text-sm">
                {company.spearfish_score >= 8 
                  ? "This company shows exceptional promise with strong fundamentals and growth indicators."
                  : company.spearfish_score >= 6 
                  ? "This company demonstrates solid potential with several positive indicators."
                  : "This company has interesting aspects worth monitoring for future opportunities."
                }
              </p>
            </div>
          </div>
        ) : (
          <div className="text-slate-400">
            <p>No specific signals identified yet.</p>
            <p className="text-sm mt-2">Analysis will improve as more company data becomes available.</p>
          </div>
        )}
      </div>

      {/* Current Opportunities */}
      <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Current Opportunities</h3>
        
        {company.is_hiring ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              <div className="flex-1">
                <h4 className="text-green-300 font-medium">Currently Hiring</h4>
                <p className="text-slate-400 text-sm">This company is actively expanding their team.</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {company.website_url && (
                <a
                  href={`${company.website_url}/careers`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 bg-slate-900/50 rounded-lg hover:bg-slate-700/50 transition-colors"
                >
                  <span>🌐</span>
                  <div>
                    <div className="text-slate-200 text-sm font-medium">Company Careers</div>
                    <div className="text-slate-400 text-xs">Visit careers page</div>
                  </div>
                </a>
              )}
              
              <a
                href={`https://www.ycombinator.com/companies/${company.name.toLowerCase().replace(/\s+/g, '-')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 bg-slate-900/50 rounded-lg hover:bg-slate-700/50 transition-colors"
              >
                <span>🚀</span>
                <div>
                  <div className="text-slate-200 text-sm font-medium">YC Company Page</div>
                  <div className="text-slate-400 text-xs">View on Y Combinator</div>
                </div>
              </a>
            </div>
            
            <div className="text-slate-400 text-sm p-3 bg-slate-900/30 rounded-lg">
              <p><strong>Pro tip:</strong> Research the company thoroughly before reaching out. Check their recent updates, team members on LinkedIn, and recent GitHub activity.</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6.5" />
              </svg>
            </div>
            <h4 className="text-lg font-medium text-white mb-2">Not Currently Hiring</h4>
            <p className="text-slate-400 max-w-md mx-auto mb-4">
              This company isn&apos;t actively hiring right now, but that could change quickly in the startup world.
            </p>
            <div className="text-slate-400 text-sm">
              <p><strong>Stay connected:</strong> Follow their progress and be ready when opportunities arise.</p>
            </div>
          </div>
        )}
      </div>

      {/* Open Positions */}
      <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">Open Positions</h3>
          {jobs.length > 0 && (
            <span className="px-3 py-1 bg-blue-500/20 text-blue-300 text-sm rounded-full">
              {jobs.length} {jobs.length === 1 ? 'position' : 'positions'}
            </span>
          )}
        </div>

        {jobsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
            <span className="ml-3 text-slate-400">Loading positions...</span>
          </div>
        ) : jobsError ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h4 className="text-lg font-medium text-white mb-2">Error Loading Positions</h4>
            <p className="text-slate-400 text-sm">{jobsError}</p>
          </div>
        ) : jobs.length > 0 ? (
          <div className="space-y-4">
            {jobs.map((job) => (
              <div key={job.id} className="bg-slate-900/50 rounded-lg p-4 hover:bg-slate-700/30 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="text-white font-medium text-lg mb-1">{job.title}</h4>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
                      {job.location && (
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {job.location}
                        </span>
                      )}
                      {job.remote_ok && (
                        <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded-full">
                          Remote OK
                        </span>
                      )}
                      {job.salary && (
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                          </svg>
                          {job.salary}
                        </span>
                      )}
                      {job.years_experience && (
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6.5" />
                          </svg>
                          {job.years_experience}
                        </span>
                      )}
                    </div>
                  </div>
                  {job.apply_url && (
                    <a
                      href={job.apply_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                      View Details
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                </div>
                
                {job.description && (
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    <p className="text-slate-300 text-sm line-clamp-3">
                      {job.description.substring(0, 200)}{job.description.length > 200 ? '...' : ''}
                    </p>
                  </div>
                )}
              </div>
            ))}

            <div className="text-slate-400 text-sm p-3 bg-slate-900/30 rounded-lg">
              <p><strong>Spearfishing tip:</strong> Study the job requirements carefully and create a targeted project or demo that addresses their specific needs before applying.</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6.5" />
              </svg>
            </div>
            <h4 className="text-lg font-medium text-white mb-2">No Open Positions</h4>
            <p className="text-slate-400 max-w-md mx-auto mb-4">
              There are no current job listings for this company. Check back later or reach out directly to express interest.
            </p>
            <div className="text-slate-400 text-sm">
              <p><strong>Pro tip:</strong> Sometimes the best opportunities aren&apos;t posted publicly. Consider reaching out with a compelling project proposal.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}