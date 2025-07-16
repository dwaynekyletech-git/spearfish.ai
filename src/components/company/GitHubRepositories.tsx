/**
 * GitHub Repositories Component
 * 
 * Displays real GitHub repository data with metrics and star growth
 */

'use client';

import { 
  StarIcon, 
  CodeBracketIcon, 
  EyeIcon, 
  ArrowTrendingUpIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  UsersIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

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

interface GitHubRepositoriesProps {
  githubData: CompanyGitHubData | null;
  isLoading: boolean;
  error: string | null;
}

export function GitHubRepositories({ githubData, isLoading, error }: GitHubRepositoriesProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
        <div className="flex items-center space-x-2 mb-4">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-400"></div>
          <h3 className="text-xl font-semibold text-white">Loading GitHub Data...</h3>
        </div>
        
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-slate-900/50 rounded-lg p-3">
                <div className="h-6 bg-slate-700 rounded mb-2"></div>
                <div className="h-4 bg-slate-700 rounded w-16"></div>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-slate-900/30 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
        <div className="flex items-center space-x-2 mb-4 text-orange-400">
          <ExclamationTriangleIcon className="h-5 w-5" />
          <h3 className="text-xl font-semibold">GitHub Data Unavailable</h3>
        </div>
        <p className="text-slate-400 text-sm">{error}</p>
      </div>
    );
  }

  // No data state
  if (!githubData || githubData.repositories.length === 0) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4">GitHub Activity</h3>
        <div className="text-center py-8">
          <CodeBracketIcon className="h-12 w-12 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">No GitHub repositories found for this company.</p>
          <p className="text-slate-500 text-sm mt-1">
            Repositories may not be linked yet or the company may not have public repositories.
          </p>
        </div>
      </div>
    );
  }

  const { repositories, summary } = githubData;

  const formatLastSynced = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return `${Math.floor(diffMinutes / 1440)}d ago`;
  };

  const getGrowthColor = (growth: number) => {
    if (growth > 1000) return 'text-green-400';
    if (growth > 100) return 'text-yellow-400';
    if (growth > 0) return 'text-blue-400';
    return 'text-slate-400';
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-white">GitHub Activity</h3>
        {summary.last_synced && (
          <div className="flex items-center space-x-1 text-slate-400 text-sm">
            <ClockIcon className="h-4 w-4" />
            <span>Updated {formatLastSynced(summary.last_synced)}</span>
          </div>
        )}
      </div>
      
      {/* GitHub Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-900/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-purple-400">{summary.total_repositories}</div>
          <div className="text-slate-400 text-sm">Repositories</div>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-yellow-400">
            {summary.total_stars.toLocaleString()}
          </div>
          <div className="text-slate-400 text-sm">Total Stars</div>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-cyan-400">
            {summary.total_contributors.toLocaleString()}
          </div>
          <div className="text-slate-400 text-sm">Total Contributors</div>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-emerald-400">
            {summary.total_commits_last_year.toLocaleString()}
          </div>
          <div className="text-slate-400 text-sm">Commits (Last Year)</div>
        </div>
      </div>

      {/* Top Languages */}
      {summary.top_languages.length > 0 && (
        <div className="mb-6">
          <h4 className="text-lg font-medium text-white mb-3">Top Languages</h4>
          <div className="flex flex-wrap gap-2">
            {summary.top_languages.map((lang, index) => (
              <div
                key={index}
                className="flex items-center space-x-2 bg-slate-900/50 rounded-lg px-3 py-2"
              >
                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-purple-400 to-pink-400"></div>
                <span className="text-slate-300 text-sm font-medium">{lang.language}</span>
                <span className="text-slate-400 text-xs">{lang.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Repository List */}
      <div className="space-y-4">
        <h4 className="text-lg font-medium text-white">Repositories</h4>
        {repositories.map((repo) => (
          <div
            key={repo.id}
            className="bg-slate-900/30 border border-slate-700/30 rounded-lg p-4 hover:bg-slate-900/50 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <a
                    href={repo.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
                  >
                    {repo.full_name}
                  </a>
                  {repo.association.is_primary && (
                    <span className="px-2 py-1 bg-purple-600/20 text-purple-300 rounded text-xs">
                      Primary
                    </span>
                  )}
                  {repo.language && (
                    <span className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs">
                      {repo.language}
                    </span>
                  )}
                </div>
                
                {repo.description && (
                  <p className="text-slate-400 text-sm mb-3 leading-relaxed">
                    {repo.description}
                  </p>
                )}
                
                <div className="flex items-center flex-wrap gap-4 text-sm text-slate-400">
                  <div className="flex items-center space-x-1">
                    <StarIcon className="h-4 w-4 text-yellow-400" />
                    <span>{repo.stars_count.toLocaleString()}</span>
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    <CodeBracketIcon className="h-4 w-4" />
                    <span>{repo.forks_count.toLocaleString()} forks</span>
                  </div>
                  
                  {repo.open_issues_count > 0 && (
                    <div className="flex items-center space-x-1">
                      <EyeIcon className="h-4 w-4" />
                      <span>{repo.open_issues_count} issues</span>
                    </div>
                  )}
                  
                  {repo.metrics.contributors_count > 0 && (
                    <div className="flex items-center space-x-1">
                      <span>{repo.metrics.contributors_count} contributors</span>
                    </div>
                  )}
                  
                  {repo.metrics.releases_count > 0 && (
                    <div className="flex items-center space-x-1">
                      <span>{repo.metrics.releases_count} releases</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Star Growth Indicator */}
              {repo.star_growth.monthly_growth > 0 && (
                <div className="ml-4 text-right">
                  <div className={`flex items-center space-x-1 ${getGrowthColor(repo.star_growth.monthly_growth)}`}>
                    <ArrowTrendingUpIcon className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      +{Math.round(repo.star_growth.monthly_growth)}/mo
                    </span>
                  </div>
                  {repo.star_growth.growth_percentage !== null && (
                    <div className="text-xs text-slate-500 mt-1">
                      {repo.star_growth.growth_percentage > 0 ? '+' : ''}
                      {repo.star_growth.growth_percentage.toFixed(1)}% (30d)
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Languages for this repository */}
            {repo.top_languages.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-700/30">
                <div className="flex flex-wrap gap-1">
                  {repo.top_languages.map((lang, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-slate-800/50 text-slate-400 rounded text-xs"
                    >
                      {lang.language} {lang.percentage}%
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}