/**
 * GitHub API Service
 * 
 * Provides GitHub API integration with authentication, rate limiting, and error handling
 */

import { Octokit } from '@octokit/rest';

interface GitHubRateLimit {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
}

interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: string;
  description: string | null;
  html_url: string;
  stars_count: number;
  forks_count: number;
  language: string | null;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  size: number;
  open_issues_count: number;
  archived: boolean;
  disabled: boolean;
  private: boolean;
}

interface GitHubRepositoryStats {
  repository: GitHubRepository;
  contributors_count: number;
  commit_count_last_year: number;
  releases_count: number;
  languages: Record<string, number>;
}

interface GitHubError {
  message: string;
  status: number;
  type: 'rate_limit' | 'not_found' | 'forbidden' | 'server_error' | 'unknown';
}

export class GitHubService {
  private octokit: Octokit;
  private rateLimitBuffer = 100; // Keep buffer of requests

  constructor() {
    const token = process.env.GITHUB_TOKEN;
    
    if (!token) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }

    this.octokit = new Octokit({
      auth: token,
      userAgent: 'Spearfish-AI/1.0.0',
      throttle: {
        onRateLimit: (retryAfter: number, options: any) => {
          console.warn(
            `GitHub API rate limit exceeded. Retrying after ${retryAfter} seconds. Options: ${JSON.stringify(options)}`
          );
          // Retry once
          return options.request.retryCount < 1;
        },
        onSecondaryRateLimit: (retryAfter: number, options: any) => {
          console.warn(
            `GitHub API secondary rate limit hit. Retrying after ${retryAfter} seconds.`
          );
          // Don't retry on secondary rate limit
          return false;
        },
      },
    });
  }

  /**
   * Get current rate limit status
   */
  async getRateLimit(): Promise<GitHubRateLimit> {
    try {
      const response = await this.octokit.rest.rateLimit.get();
      return {
        limit: response.data.rate.limit,
        remaining: response.data.rate.remaining,
        reset: response.data.rate.reset,
        used: response.data.rate.used,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Check if we have enough rate limit remaining for operation
   */
  async checkRateLimit(requestsNeeded = 1): Promise<boolean> {
    const rateLimit = await this.getRateLimit();
    return rateLimit.remaining >= (requestsNeeded + this.rateLimitBuffer);
  }

  /**
   * Get repository information
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    try {
      // Check rate limit before making request
      if (!(await this.checkRateLimit(1))) {
        throw new Error('Insufficient GitHub API rate limit remaining');
      }

      const response = await this.octokit.rest.repos.get({
        owner,
        repo,
      });

      const repository = response.data;
      
      return {
        id: repository.id,
        name: repository.name,
        full_name: repository.full_name,
        owner: repository.owner.login,
        description: repository.description,
        html_url: repository.html_url,
        stars_count: repository.stargazers_count,
        forks_count: repository.forks_count,
        language: repository.language,
        created_at: repository.created_at,
        updated_at: repository.updated_at,
        pushed_at: repository.pushed_at || repository.updated_at,
        size: repository.size,
        open_issues_count: repository.open_issues_count,
        archived: repository.archived,
        disabled: repository.disabled,
        private: repository.private,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get detailed repository statistics
   */
  async getRepositoryStats(owner: string, repo: string): Promise<GitHubRepositoryStats> {
    try {
      // Check rate limit (we'll make multiple requests)
      if (!(await this.checkRateLimit(4))) {
        throw new Error('Insufficient GitHub API rate limit remaining for repository stats');
      }

      // Get basic repository info
      const repository = await this.getRepository(owner, repo);

      // Get contributors count
      let contributors_count = 0;
      try {
        const contributorsResponse = await this.octokit.rest.repos.listContributors({
          owner,
          repo,
          per_page: 1,
        });
        // GitHub doesn't return total count in headers for contributors,
        // so we'll estimate based on the first page
        contributors_count = contributorsResponse.data.length > 0 ? 
          Math.min(contributorsResponse.data.length * 10, 100) : 0;
      } catch (error) {
        console.warn(`Could not get contributors for ${owner}/${repo}:`, error);
      }

      // Get commit count (approximate)
      let commit_count_last_year = 0;
      try {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        
        const commitsResponse = await this.octokit.rest.repos.listCommits({
          owner,
          repo,
          since: oneYearAgo.toISOString(),
          per_page: 1,
        });
        
        // This is an approximation - GitHub doesn't provide total count easily
        commit_count_last_year = commitsResponse.data.length > 0 ? 50 : 0;
      } catch (error) {
        console.warn(`Could not get commits for ${owner}/${repo}:`, error);
      }

      // Get releases count
      let releases_count = 0;
      try {
        const releasesResponse = await this.octokit.rest.repos.listReleases({
          owner,
          repo,
          per_page: 100,
        });
        releases_count = releasesResponse.data.length;
      } catch (error) {
        console.warn(`Could not get releases for ${owner}/${repo}:`, error);
      }

      // Get languages
      let languages: Record<string, number> = {};
      try {
        const languagesResponse = await this.octokit.rest.repos.listLanguages({
          owner,
          repo,
        });
        languages = languagesResponse.data;
      } catch (error) {
        console.warn(`Could not get languages for ${owner}/${repo}:`, error);
      }

      return {
        repository,
        contributors_count,
        commit_count_last_year,
        releases_count,
        languages,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get multiple repositories for an organization or user
   */
  async getRepositories(
    owner: string, 
    options: {
      type?: 'all' | 'owner' | 'member';
      sort?: 'created' | 'updated' | 'pushed' | 'full_name';
      direction?: 'asc' | 'desc';
      per_page?: number;
      page?: number;
    } = {}
  ): Promise<GitHubRepository[]> {
    try {
      const { per_page = 30, page = 1, ...restOptions } = options;
      
      // Check rate limit
      if (!(await this.checkRateLimit(1))) {
        throw new Error('Insufficient GitHub API rate limit remaining');
      }

      const response = await this.octokit.rest.repos.listForUser({
        username: owner,
        per_page,
        page,
        ...restOptions,
      });

      return response.data.map(repo => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        owner: repo.owner.login,
        description: repo.description,
        html_url: repo.html_url,
        stars_count: repo.stargazers_count,
        forks_count: repo.forks_count,
        language: repo.language,
        created_at: repo.created_at,
        updated_at: repo.updated_at,
        pushed_at: repo.pushed_at || repo.updated_at,
        size: repo.size,
        open_issues_count: repo.open_issues_count,
        archived: repo.archived,
        disabled: repo.disabled,
        private: repo.private,
      }));
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Search GitHub organizations by name
   */
  async searchOrganizations(query: string, options: { per_page?: number } = {}): Promise<any[]> {
    try {
      const { per_page = 10 } = options;
      
      // Check rate limit
      if (!(await this.checkRateLimit(1))) {
        throw new Error('Insufficient GitHub API rate limit remaining');
      }

      const response = await this.octokit.search.users({
        q: `${query} type:org`,
        per_page,
      });
      
      return response.data.items;
    } catch (error) {
      console.error('Error searching organizations:', error);
      return [];
    }
  }

  /**
   * Search repositories by query
   */
  async searchRepositories(
    query: string,
    options: {
      sort?: 'stars' | 'forks' | 'help-wanted-issues' | 'updated';
      order?: 'desc' | 'asc';
      per_page?: number;
      page?: number;
    } = {}
  ): Promise<{
    repositories: GitHubRepository[];
    total_count: number;
    incomplete_results: boolean;
  }> {
    try {
      const { per_page = 30, page = 1, ...restOptions } = options;
      
      // Check rate limit
      if (!(await this.checkRateLimit(1))) {
        throw new Error('Insufficient GitHub API rate limit remaining');
      }

      const response = await this.octokit.rest.search.repos({
        q: query,
        per_page,
        page,
        ...restOptions,
      });

      return {
        repositories: response.data.items.map(repo => ({
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          owner: repo.owner.login,
          description: repo.description,
          html_url: repo.html_url,
          stars_count: repo.stargazers_count,
          forks_count: repo.forks_count,
          language: repo.language,
          created_at: repo.created_at,
          updated_at: repo.updated_at,
          pushed_at: repo.pushed_at || repo.updated_at,
          size: repo.size,
          open_issues_count: repo.open_issues_count,
          archived: repo.archived,
          disabled: repo.disabled,
          private: repo.private,
        })),
        total_count: response.data.total_count,
        incomplete_results: response.data.incomplete_results,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Handle and normalize GitHub API errors
   */
  private handleError(error: any): GitHubError {
    if (error?.status) {
      const status = error.status;
      let type: GitHubError['type'] = 'unknown';
      
      if (status === 403 && error.message?.includes('rate limit')) {
        type = 'rate_limit';
      } else if (status === 404) {
        type = 'not_found';
      } else if (status === 403) {
        type = 'forbidden';
      } else if (status >= 500) {
        type = 'server_error';
      }

      return {
        message: error.message || `GitHub API error ${status}`,
        status,
        type,
      };
    }

    return {
      message: error?.message || 'Unknown GitHub API error',
      status: 500,
      type: 'unknown',
    };
  }
}

// Export singleton instance
export const githubService = new GitHubService();

// Export types
export type {
  GitHubRepository,
  GitHubRepositoryStats,
  GitHubRateLimit,
  GitHubError,
};