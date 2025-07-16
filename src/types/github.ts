/**
 * TypeScript types for GitHub data models
 * 
 * Matches the database schema for GitHub integration
 */

export interface GitHubRepository {
  id: string;
  github_id: number;
  full_name: string;
  name: string;
  owner: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stars_count: number;
  forks_count: number;
  open_issues_count: number;
  size: number;
  archived: boolean;
  disabled: boolean;
  private: boolean;
  created_at_github: string;
  updated_at_github: string;
  pushed_at_github: string | null;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface GitHubRepositoryMetrics {
  id: string;
  repository_id: string;
  stars_count: number;
  forks_count: number;
  open_issues_count: number;
  size: number;
  contributors_count: number;
  commit_count_last_year: number;
  releases_count: number;
  recorded_at: string;
  created_at: string;
}

export interface GitHubRepositoryLanguage {
  id: string;
  repository_id: string;
  language: string;
  bytes_count: number;
  percentage: number;
  recorded_at: string;
  created_at: string;
}

export interface CompanyGitHubRepository {
  id: string;
  company_id: string;
  repository_id: string;
  is_primary: boolean;
  discovery_method: 'manual' | 'search' | 'api' | 'website';
  confidence_score: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GitHubSyncLog {
  id: string;
  sync_type: 'full' | 'incremental' | 'repository' | 'metrics';
  repository_id: string | null;
  company_id: string | null;
  status: 'running' | 'completed' | 'failed' | 'partial';
  repositories_processed: number;
  repositories_total: number;
  error_message: string | null;
  rate_limit_remaining: number | null;
  duration_seconds: number | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

// Enhanced types with computed fields
export interface GitHubRepositoryWithMetrics extends GitHubRepository {
  latest_metrics?: GitHubRepositoryMetrics;
  languages?: GitHubRepositoryLanguage[];
  star_growth?: StarGrowthMetrics;
  company_association?: CompanyGitHubRepository;
}

export interface StarGrowthMetrics {
  repository_id: string;
  start_stars: number;
  end_stars: number;
  star_growth: number;
  growth_percentage: number | null;
  period_days: number;
  monthly_growth_rate: number | null;
}

export interface CompanyRepositorySummary {
  repository_id: string;
  full_name: string;
  description: string | null;
  stars_count: number;
  forks_count: number;
  language: string | null;
  is_primary: boolean;
  confidence_score: number;
  monthly_star_growth: number | null;
}

// API Response types
export interface GitHubRepositoryResponse {
  success: boolean;
  data: GitHubRepositoryWithMetrics[];
  metadata: {
    total: number;
    page: number;
    limit: number;
    last_sync: string;
  };
  error?: string;
}

export interface GitHubMetricsResponse {
  success: boolean;
  data: {
    repository: GitHubRepository;
    metrics_history: GitHubRepositoryMetrics[];
    languages: GitHubRepositoryLanguage[];
    star_growth: StarGrowthMetrics;
  };
  error?: string;
}

export interface GitHubSyncResponse {
  success: boolean;
  data: {
    sync_log: GitHubSyncLog;
    repositories_synced: number;
    rate_limit_remaining: number;
  };
  error?: string;
}

// Database function result types
export interface CalculateStarGrowthResult {
  repository_id: string;
  start_stars: number;
  end_stars: number;
  star_growth: number;
  growth_percentage: number | null;
  period_days: number;
  monthly_growth_rate: number | null;
}

export interface GetCompanyTopRepositoriesResult {
  repository_id: string;
  full_name: string;
  description: string | null;
  stars_count: number;
  forks_count: number;
  language: string | null;
  is_primary: boolean;
  confidence_score: number;
  monthly_star_growth: number | null;
}

// Input types for API endpoints
export interface CreateGitHubRepositoryInput {
  github_id: number;
  full_name: string;
  name: string;
  owner: string;
  description?: string | null;
  html_url: string;
  language?: string | null;
  stars_count: number;
  forks_count: number;
  open_issues_count: number;
  size: number;
  archived: boolean;
  disabled: boolean;
  private: boolean;
  created_at_github: string;
  updated_at_github: string;
  pushed_at_github?: string | null;
}

export interface CreateRepositoryMetricsInput {
  repository_id: string;
  stars_count: number;
  forks_count: number;
  open_issues_count: number;
  size: number;
  contributors_count?: number;
  commit_count_last_year?: number;
  releases_count?: number;
}

export interface CreateCompanyRepositoryAssociationInput {
  company_id: string;
  repository_id: string;
  is_primary?: boolean;
  discovery_method?: 'manual' | 'search' | 'api' | 'website';
  confidence_score?: number;
  notes?: string;
}

export interface GitHubSyncOptions {
  company_id?: string;
  repository_id?: string;
  sync_type: 'full' | 'incremental' | 'repository' | 'metrics';
  force_refresh?: boolean;
  batch_size?: number;
}

// Constants
export const GITHUB_SYNC_TYPES = ['full', 'incremental', 'repository', 'metrics'] as const;
export const GITHUB_SYNC_STATUSES = ['running', 'completed', 'failed', 'partial'] as const;
export const DISCOVERY_METHODS = ['manual', 'search', 'api', 'website'] as const;

export const DEFAULT_PAGINATION = {
  page: 1,
  limit: 20,
  max_limit: 100,
} as const;

export const STAR_GROWTH_THRESHOLDS = {
  monthly_significant: 1000, // >1K/month is significant
  monthly_high: 500,         // 500-1K/month is high
  monthly_moderate: 100,     // 100-500/month is moderate
} as const;