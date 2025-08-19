/**
 * GitHub Repository Discovery Service
 * 
 * Automatically discovers GitHub repositories for companies by:
 * 1. Searching by company name
 * 2. Looking for organization accounts
 * 3. Analyzing website URLs for GitHub links
 * 4. Using founder names to find personal repos
 */

import { createServiceClient } from './supabase-server';
import { safeFetch, getSSRFConfig } from './security/url-validator';
import { logInfo, logDebug, logWarn, logError } from './logger';

// =============================================================================
// Type Definitions
// =============================================================================

export interface GitHubRepo {
  id: number;
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
  created_at: string;
  updated_at: string;
  pushed_at: string | null;
}

export interface DiscoveryResult {
  companyId: string;
  companyName: string;
  searchMethods: string[];
  reposFound: GitHubRepo[];
  reposAssociated: number;
  confidence: 'high' | 'medium' | 'low';
  issues: string[];
}

export interface BatchDiscoveryResult {
  success: boolean;
  companiesProcessed: number;
  totalReposFound: number;
  totalReposStored: number;
  results: DiscoveryResult[];
  processingTime: number;
  rateLimitRemaining: number | null;
}

// =============================================================================
// GitHub Discovery Service Class
// =============================================================================

export class GitHubDiscoveryService {
  private supabase = createServiceClient();
  private githubToken = process.env.GITHUB_TOKEN;
  private rateLimitRemaining: number | null = null;

  constructor() {
    if (!this.githubToken) {
      logWarn('⚠️ GitHub token not found - discovery will be limited');
    }
  }

  /**
   * Discover GitHub repositories for companies that don't have any yet
   */
  async discoverRepositoriesForCompanies(limit: number = 10): Promise<BatchDiscoveryResult> {
    const startTime = Date.now();
    const result: BatchDiscoveryResult = {
      success: false,
      companiesProcessed: 0,
      totalReposFound: 0,
      totalReposStored: 0,
      results: [],
      processingTime: 0,
      rateLimitRemaining: null
    };

    try {
      logInfo('🔍 Starting GitHub repository discovery');

      // Get companies without GitHub data
      const { data: companies, error } = await this.supabase
        .from('companies')
        .select('id, name, slug, website_url, one_liner')
        .eq('github_repos', JSON.stringify([]))
        .limit(limit);

      if (error) {
        throw new Error(`Failed to fetch companies: ${error.message}`);
      }

      if (!companies || companies.length === 0) {
        logInfo('✅ No companies need GitHub discovery');
        result.success = true;
        return result;
      }

      logInfo(`📊 Found ${companies.length} companies needing GitHub discovery`);
      result.companiesProcessed = companies.length;

      // Process each company
      for (const company of companies) {
        if (this.rateLimitRemaining !== null && this.rateLimitRemaining < 10) {
          logWarn(`⏸️ GitHub rate limit low (${this.rateLimitRemaining}), stopping discovery`);
          break;
        }

        try {
          const discoveryResult = await this.discoverRepositoriesForCompany(company);
          result.results.push(discoveryResult);
          result.totalReposFound += discoveryResult.reposFound.length;
          result.totalReposStored += discoveryResult.reposAssociated;

          // Small delay to respect rate limits
          await this.delay(1000);

        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          logError(`Error discovering repos for ${company.name}`, { error: errorMsg });
          
          result.results.push({
            companyId: company.id,
            companyName: company.name,
            searchMethods: [],
            reposFound: [],
            reposAssociated: 0,
            confidence: 'low',
            issues: [errorMsg]
          });
        }
      }

      result.success = true;
      result.processingTime = Date.now() - startTime;
      result.rateLimitRemaining = this.rateLimitRemaining;

      logInfo('🎉 GitHub discovery complete', {
        companiesProcessed: result.companiesProcessed,
        totalReposFound: result.totalReposFound,
        totalReposStored: result.totalReposStored
      });

      return result;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logError('❌ GitHub discovery failed', { error: errorMsg });
      
      result.processingTime = Date.now() - startTime;
      throw error;
    }
  }

  /**
   * Discover repositories for a single company
   */
  async discoverRepositoriesForCompany(company: any): Promise<DiscoveryResult> {
    const result: DiscoveryResult = {
      companyId: company.id,
      companyName: company.name,
      searchMethods: [],
      reposFound: [],
      reposAssociated: 0,
      confidence: 'low',
      issues: []
    };

    logDebug(`🔍 Discovering repos for ${company.name}`);

    try {
      // Method 1: Search by exact organization name
      const orgRepos = await this.searchByOrganization(company.name);
      if (orgRepos.length > 0) {
        result.searchMethods.push('organization');
        result.reposFound.push(...orgRepos);
        result.confidence = 'high';
      }

      // Method 2: Search by company slug (if different from name)
      if (company.slug && company.slug !== company.name.toLowerCase().replace(/\s+/g, '')) {
        const slugRepos = await this.searchByOrganization(company.slug);
        if (slugRepos.length > 0) {
          result.searchMethods.push('slug');
          result.reposFound.push(...this.deduplicateRepos(result.reposFound, slugRepos));
        }
      }

      // Method 3: Search repositories by company name
      if (result.reposFound.length === 0) {
        const searchRepos = await this.searchRepositories(company.name);
        if (searchRepos.length > 0) {
          result.searchMethods.push('search');
          result.reposFound.push(...searchRepos);
          result.confidence = result.confidence === 'low' ? 'medium' : result.confidence;
        }
      }

      // Method 4: Extract from website URL (if it's a GitHub page)
      if (company.website_url && company.website_url.includes('github.io')) {
        const websiteRepos = await this.extractFromWebsiteURL(company.website_url, company.name);
        if (websiteRepos.length > 0) {
          result.searchMethods.push('website');
          result.reposFound.push(...this.deduplicateRepos(result.reposFound, websiteRepos));
        }
      }

      // Filter and validate repos with STRICT ownership validation
      const discoveryMethod = result.searchMethods[0] || 'search';
      result.reposFound = await this.filterRelevantRepos(result.reposFound, company, discoveryMethod);

      // Store discovered repositories (only if they passed validation)
      if (result.reposFound.length > 0) {
        logInfo(`✅ Found ${result.reposFound.length} validated repos for ${company.name}`);
        result.reposAssociated = await this.storeDiscoveredRepos(company.id, result.reposFound, discoveryMethod);
        result.confidence = result.reposFound.length > 2 ? 'high' : result.confidence === 'low' ? 'medium' : result.confidence;
      } else {
        logInfo(`❌ No valid GitHub repos found for ${company.name} - repos didn't pass ownership validation`);
        result.confidence = 'low';
        result.issues.push('No repositories passed strict ownership validation');
      }

      logDebug(`✅ ${company.name}: Found ${result.reposFound.length} repos, stored ${result.reposAssociated}`);

      return result;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      result.issues.push(errorMsg);
      logError(`Error in discovery for ${company.name}`, { error: errorMsg });
      return result;
    }
  }

  /**
   * Search for repositories by organization name
   */
  private async searchByOrganization(orgName: string): Promise<GitHubRepo[]> {
    if (!this.githubToken) {
      return [];
    }

    try {
      const cleanOrgName = this.cleanOrganizationName(orgName);
      const url = `https://api.github.com/orgs/${encodeURIComponent(cleanOrgName)}/repos`;
      
      const response = await safeFetch(url, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `Bearer ${this.githubToken}`,
          'User-Agent': 'SpearfishAI/1.0'
        }
      }, getSSRFConfig('github'));

      this.updateRateLimit(response.headers);

      if (response.status === 404) {
        // Organization doesn't exist
        return [];
      }

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const repos = await response.json();
      return this.transformGitHubRepos(repos);

    } catch (error) {
      logDebug(`No organization found for ${orgName}`, { error: error instanceof Error ? error.message : error });
      return [];
    }
  }

  /**
   * Search repositories by name/keywords
   */
  private async searchRepositories(companyName: string): Promise<GitHubRepo[]> {
    if (!this.githubToken) {
      return [];
    }

    try {
      const query = encodeURIComponent(`${companyName} in:name,description`);
      const url = `https://api.github.com/search/repositories?q=${query}&sort=stars&per_page=10`;
      
      const response = await safeFetch(url, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `Bearer ${this.githubToken}`,
          'User-Agent': 'SpearfishAI/1.0'
        }
      }, getSSRFConfig('github'));

      this.updateRateLimit(response.headers);

      if (!response.ok) {
        throw new Error(`GitHub search API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return this.transformGitHubRepos(data.items || []);

    } catch (error) {
      logDebug(`Search failed for ${companyName}`, { error: error instanceof Error ? error.message : error });
      return [];
    }
  }

  /**
   * Extract repository from GitHub Pages URL
   */
  private async extractFromWebsiteURL(websiteUrl: string, companyName: string): Promise<GitHubRepo[]> {
    try {
      // Extract username from github.io URL
      const match = websiteUrl.match(/https?:\/\/([^.]+)\.github\.io/);
      if (!match) return [];

      const username = match[1];
      return await this.searchByOrganization(username);

    } catch (error) {
      logDebug(`Failed to extract from website URL ${websiteUrl}`, { error });
      return [];
    }
  }

  /**
   * Filter repositories to only include ones that actually belong to the company
   * This is the CRITICAL method that prevents false positives
   */
  private async filterRelevantRepos(repos: GitHubRepo[], company: any, discoveryMethod: string): Promise<GitHubRepo[]> {
    // Generate valid company name variations for matching
    const companyVariations = this.generateCompanyVariations(company.name, company.slug);
    
    logDebug(`🔍 Validating ${repos.length} repos for ${company.name} (method: ${discoveryMethod})`, {
      companyVariations,
      repoOwners: repos.map(r => r.owner)
    });

    const validatedRepos = repos.filter(repo => {
      // STEP 1: STRICT OWNERSHIP VALIDATION
      const ownerMatches = this.doesOwnerMatchCompany(repo.owner, companyVariations);
      
      logDebug(`Validating ${repo.full_name}`, {
        owner: repo.owner,
        ownerMatches,
        method: discoveryMethod
      });

      // If discovered via organization search, trust it more (they searched for the org directly)
      if (discoveryMethod === 'organization' || discoveryMethod === 'slug') {
        if (ownerMatches) {
          logDebug(`✅ ACCEPTED: ${repo.full_name} - org search with owner match`);
          return true;
        } else {
          logDebug(`❌ REJECTED: ${repo.full_name} - org search but owner doesn't match`);
          return false;
        }
      }
      
      // For search results or website extraction, be VERY strict
      if (discoveryMethod === 'search' || discoveryMethod === 'website') {
        // Must have owner match for search results
        if (!ownerMatches) {
          logDebug(`❌ REJECTED: ${repo.full_name} - ${discoveryMethod} but owner '${repo.owner}' doesn't match company`);
          return false;
        }
        
        // Additional validation: check if repo name also suggests it belongs to company
        const repoNameMatches = this.doesRepoNameMatchCompany(repo.name, companyVariations);
        
        if (ownerMatches || repoNameMatches) {
          logDebug(`✅ ACCEPTED: ${repo.full_name} - ${discoveryMethod} with strong match`);
        } else {
          logDebug(`❌ REJECTED: ${repo.full_name} - ${discoveryMethod} but weak match`);
          return false;
        }
      }
      
      // STEP 2: SECONDARY QUALITY FILTERS (only for repos that passed ownership validation)
      
      // Skip archived/disabled repos unless they have significant stars
      if ((repo.archived || repo.disabled) && repo.stars_count < 10) {
        logDebug(`❌ REJECTED: ${repo.full_name} - archived/disabled with low stars`);
        return false;
      }

      // Skip very old repos without recent activity (unless popular)
      const lastActivity = new Date(repo.pushed_at || repo.updated_at);
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      
      if (lastActivity < twoYearsAgo && repo.stars_count < 5) {
        logDebug(`❌ REJECTED: ${repo.full_name} - too old with low stars`);
        return false;
      }

      // Skip forks with no original content (low stars and forks)
      if (repo.forks_count === 0 && repo.stars_count === 0 && repo.size < 100) {
        logDebug(`❌ REJECTED: ${repo.full_name} - empty fork`);
        return false;
      }

      logDebug(`✅ ACCEPTED: ${repo.full_name} - passed all validation`);
      return true;
    }).sort((a, b) => b.stars_count - a.stars_count); // Sort by popularity
    
    logInfo(`🎯 Validation complete for ${company.name}: ${validatedRepos.length}/${repos.length} repos passed`, {
      accepted: validatedRepos.map(r => r.full_name),
      method: discoveryMethod
    });
    
    return validatedRepos;
  }

  /**
   * Store discovered repositories in the database
   */
  private async storeDiscoveredRepos(companyId: string, repos: GitHubRepo[], discoveryMethod: string): Promise<number> {
    let storedCount = 0;

    for (const repo of repos) {
      try {
        // First, store/update the repository
        const { data: storedRepo, error: repoError } = await this.supabase
          .from('github_repositories')
          .upsert({
            github_id: repo.id,
            full_name: repo.full_name,
            name: repo.name,
            owner: repo.owner,
            description: repo.description,
            html_url: repo.html_url,
            language: repo.language,
            stars_count: repo.stars_count,
            forks_count: repo.forks_count,
            open_issues_count: repo.open_issues_count,
            size: repo.size,
            archived: repo.archived,
            disabled: repo.disabled,
            private: repo.private,
            created_at_github: repo.created_at,
            updated_at_github: repo.updated_at,
            pushed_at_github: repo.pushed_at,
            last_synced_at: new Date().toISOString()
          }, {
            onConflict: 'github_id',
            ignoreDuplicates: false
          })
          .select()
          .single();

        if (repoError) {
          logError(`Failed to store repository ${repo.full_name}`, { error: repoError.message });
          continue;
        }

        // Then, create the company-repository association
        const { error: assocError } = await this.supabase
          .from('company_github_repositories')
          .upsert({
            company_id: companyId,
            repository_id: storedRepo.id,
            is_primary: storedCount === 0, // First repo is primary
            discovery_method: discoveryMethod,
            confidence_score: this.calculateConfidence(repo, discoveryMethod),
            notes: `Discovered via ${discoveryMethod} search`
          }, {
            onConflict: 'company_id,repository_id',
            ignoreDuplicates: true
          });

        if (assocError) {
          logError(`Failed to create association for ${repo.full_name}`, { error: assocError.message });
          continue;
        }

        storedCount++;

      } catch (error) {
        logError(`Exception storing ${repo.full_name}`, { error: error instanceof Error ? error.message : error });
      }
    }

    return storedCount;
  }

  // =============================================================================
  // Helper Methods
  // =============================================================================

  private cleanOrganizationName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private deduplicateRepos(existing: GitHubRepo[], newRepos: GitHubRepo[]): GitHubRepo[] {
    const existingIds = new Set(existing.map(r => r.id));
    return newRepos.filter(r => !existingIds.has(r.id));
  }

  private transformGitHubRepos(repos: any[]): GitHubRepo[] {
    return repos.map(repo => ({
      id: repo.id,
      full_name: repo.full_name,
      name: repo.name,
      owner: repo.owner?.login || repo.owner,
      description: repo.description,
      html_url: repo.html_url,
      language: repo.language,
      stars_count: repo.stargazers_count || repo.stars_count || 0,
      forks_count: repo.forks_count || 0,
      open_issues_count: repo.open_issues_count || 0,
      size: repo.size || 0,
      archived: repo.archived || false,
      disabled: repo.disabled || false,
      private: repo.private || false,
      created_at: repo.created_at,
      updated_at: repo.updated_at,
      pushed_at: repo.pushed_at
    }));
  }

  /**
   * Generate company name variations for matching
   * This creates different possible GitHub org names for a company
   */
  private generateCompanyVariations(name: string, slug?: string): string[] {
    const variations = new Set<string>();
    
    // Add original name (lowercased)
    variations.add(name.toLowerCase());
    
    // Add slug if provided and different from name
    if (slug && slug.toLowerCase() !== name.toLowerCase()) {
      variations.add(slug.toLowerCase());
    }
    
    // Remove common company suffixes and add variations
    const cleanName = name
      .toLowerCase()
      .replace(/\s+(ai|inc|labs|technologies|tech|io|hq|co|corp|corporation|ltd|llc)$/i, '')
      .trim();
    
    if (cleanName !== name.toLowerCase()) {
      variations.add(cleanName);
    }
    
    // Add hyphenated version (spaces → hyphens)
    const hyphenated = cleanName.replace(/\s+/g, '-');
    if (hyphenated !== cleanName) {
      variations.add(hyphenated);
    }
    
    // Add no-space version (spaces → nothing)
    const nospace = cleanName.replace(/\s+/g, '');
    if (nospace !== cleanName && nospace.length > 2) {
      variations.add(nospace);
    }
    
    // Add underscored version (spaces → underscores)
    const underscored = cleanName.replace(/\s+/g, '_');
    if (underscored !== cleanName) {
      variations.add(underscored);
    }
    
    logDebug(`Generated company variations for "${name}":`, Array.from(variations));
    return Array.from(variations).filter(v => v.length > 1); // Remove single chars
  }

  /**
   * Check if repository owner matches the company
   * This is the core validation logic
   */
  private doesOwnerMatchCompany(owner: string, companyVariations: string[]): boolean {
    const ownerLower = owner.toLowerCase();
    
    for (const variation of companyVariations) {
      // Exact match (best case)
      if (ownerLower === variation) {
        return true;
      }
      
      // Owner contains variation (e.g., "replicate-labs" contains "replicate")
      if (variation.length > 3 && ownerLower.includes(variation)) {
        return true;
      }
      
      // Variation contains owner (e.g., "modal labs" contains "modal")  
      if (ownerLower.length > 3 && variation.includes(ownerLower)) {
        return true;
      }
      
      // High similarity match (80%+ similar)
      if (this.calculateSimilarity(ownerLower, variation) > 0.8) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check if repository name suggests it belongs to the company
   * Used as additional evidence for search results
   */
  private doesRepoNameMatchCompany(repoName: string, companyVariations: string[]): boolean {
    const repoLower = repoName.toLowerCase();
    
    return companyVariations.some(variation => {
      // Repo name starts with company name
      if (repoLower.startsWith(variation) && variation.length > 2) {
        return true;
      }
      
      // Repo name ends with company name  
      if (repoLower.endsWith(variation) && variation.length > 2) {
        return true;
      }
      
      // Repo name contains company name
      if (variation.length > 3 && repoLower.includes(variation)) {
        return true;
      }
      
      return false;
    });
  }

  /**
   * Calculate similarity between two strings (0-1 scale)
   * Uses simple Levenshtein distance for fuzzy matching
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1;
    
    const distance = this.levenshteinDistance(str1, str2);
    return 1 - (distance / maxLen);
  }

  /**
   * Calculate Levenshtein distance between two strings
   * Returns the number of character edits needed to transform one string into another
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion  
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private calculateConfidence(repo: GitHubRepo, method: string): number {
    let confidence = 0.5; // Base confidence

    // Method-based confidence
    switch (method) {
      case 'organization':
        confidence = 0.95;
        break;
      case 'slug':
        confidence = 0.90;
        break;
      case 'website':
        confidence = 0.85;
        break;
      case 'search':
        confidence = 0.70;
        break;
    }

    // Adjust based on repository characteristics
    if (repo.stars_count > 100) confidence += 0.05;
    if (repo.forks_count > 10) confidence += 0.05;
    if (repo.language) confidence += 0.05;
    if (!repo.archived && !repo.disabled) confidence += 0.05;

    return Math.min(confidence, 1.0);
  }

  private updateRateLimit(headers: Headers): void {
    const remaining = headers.get('x-ratelimit-remaining');
    if (remaining) {
      this.rateLimitRemaining = parseInt(remaining, 10);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Create a new GitHub discovery service instance
 */
export function createGitHubDiscoveryService(): GitHubDiscoveryService {
  return new GitHubDiscoveryService();
}

/**
 * Quick function to discover repos for companies without GitHub data
 */
export async function discoverMissingGitHubRepos(limit: number = 10): Promise<BatchDiscoveryResult> {
  const service = createGitHubDiscoveryService();
  return service.discoverRepositoriesForCompanies(limit);
}

// Export default instance
export const githubDiscoveryService = createGitHubDiscoveryService();