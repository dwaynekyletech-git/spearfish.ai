/**
 * Automatic GitHub Repository Discovery Script
 * 
 * This script automatically finds GitHub repositories for companies by:
 * 1. Searching GitHub by company name
 * 2. Checking company websites for GitHub links
 * 3. Using various heuristics to match repos to companies
 */

import { GitHubService } from '../lib/github-service.js';
import { createServerClient } from '../lib/supabase-server.js';
import { githubStorageService } from '../lib/github-storage-service.js';

interface DiscoveryResult {
  companyId: string;
  companyName: string;
  repositories: Array<{
    owner: string;
    name: string;
    full_name: string;
    stars: number;
    confidence: number;
    discoveryMethod: string;
    reason: string;
  }>;
}

export class GitHubAutoDiscovery {
  private githubService: GitHubService;
  
  constructor() {
    this.githubService = new GitHubService();
  }

  /**
   * Discover GitHub repositories for a company
   */
  async discoverRepositoriesForCompany(
    companyId: string, 
    companyName: string, 
    companyWebsite?: string
  ): Promise<DiscoveryResult> {
    console.log(`🔍 Discovering GitHub repos for ${companyName}...`);
    
    const discoveredRepos: DiscoveryResult['repositories'] = [];
    
    // Strategy 1: Direct organization search
    const orgSearchResults = await this.searchByOrganization(companyName);
    discoveredRepos.push(...orgSearchResults);
    
    // Strategy 2: Repository name search
    const repoSearchResults = await this.searchByRepositoryName(companyName);
    discoveredRepos.push(...repoSearchResults);
    
    // Strategy 3: Website parsing (if website provided)
    if (companyWebsite) {
      const websiteRepos = await this.searchByWebsite(companyWebsite);
      discoveredRepos.push(...websiteRepos);
    }
    
    // Strategy 4: Common variations
    const variationResults = await this.searchByNameVariations(companyName);
    discoveredRepos.push(...variationResults);
    
    // Remove duplicates and sort by confidence
    const uniqueRepos = this.deduplicateAndRank(discoveredRepos);
    
    return {
      companyId,
      companyName,
      repositories: uniqueRepos
    };
  }

  /**
   * Search for organizations matching the company name
   */
  private async searchByOrganization(companyName: string): Promise<DiscoveryResult['repositories']> {
    try {
      const results = await this.githubService.searchOrganizations(companyName);
      
      return results.map(org => ({
        owner: org.login,
        name: '', // Will be filled when we get org repos
        full_name: org.login,
        stars: 0,
        confidence: this.calculateNameSimilarity(companyName, org.login),
        discoveryMethod: 'org_search',
        reason: `Organization name matches "${companyName}"`
      }));
    } catch (error) {
      console.error('Error searching organizations:', error);
      return [];
    }
  }

  /**
   * Search repositories by name
   */
  private async searchByRepositoryName(companyName: string): Promise<DiscoveryResult['repositories']> {
    try {
      const searchQueries = [
        companyName,
        companyName.toLowerCase(),
        companyName.replace(/\s+/g, '-'),
        companyName.replace(/\s+/g, '_'),
        companyName.replace(/\s+/g, '')
      ];
      
      const allResults = [];
      
      for (const query of searchQueries) {
        const results = await this.githubService.searchRepositories(query, {
          sort: 'stars',
          order: 'desc',
          per_page: 10
        });
        
        const processed = results.repositories.map(repo => ({
          owner: repo.owner,
          name: repo.name,
          full_name: repo.full_name,
          stars: repo.stars_count,
          confidence: this.calculateConfidence(companyName, repo),
          discoveryMethod: 'repo_search',
          reason: `Repository name contains "${query}"`
        }));
        
        allResults.push(...processed);
      }
      
      return allResults;
    } catch (error) {
      console.error('Error searching repositories:', error);
      return [];
    }
  }

  /**
   * Parse website for GitHub links
   */
  private async searchByWebsite(website: string): Promise<DiscoveryResult['repositories']> {
    try {
      // Extract domain for searching
      const domain = new URL(website).hostname.replace('www.', '');
      
      // Search for repos mentioning the website
      const results = await this.githubService.searchRepositories(`${domain} in:readme OR ${domain} in:description`, {
        sort: 'stars',
        order: 'desc',
        per_page: 10
      });
      
      return results.repositories.map(repo => ({
        owner: repo.owner,
        name: repo.name,
        full_name: repo.full_name,
        stars: repo.stars_count,
        confidence: 0.7, // Lower confidence for website matches
        discoveryMethod: 'website_search',
        reason: `Repository mentions website ${domain}`
      }));
    } catch (error) {
      console.error('Error searching by website:', error);
      return [];
    }
  }

  /**
   * Search using common name variations
   */
  private async searchByNameVariations(companyName: string): Promise<DiscoveryResult['repositories']> {
    const variations = this.generateNameVariations(companyName);
    const allResults = [];
    
    for (const variation of variations) {
      try {
        const results = await this.githubService.searchRepositories(`org:${variation}`, {
          sort: 'stars',
          order: 'desc',
          per_page: 5
        });
        
        const processed = results.repositories.map(repo => ({
          owner: repo.owner,
          name: repo.name,
          full_name: repo.full_name,
          stars: repo.stars_count,
          confidence: 0.6, // Lower confidence for variations
          discoveryMethod: 'variation_search',
          reason: `Found using variation "${variation}"`
        }));
        
        allResults.push(...processed);
      } catch (error) {
        // Continue with other variations
      }
    }
    
    return allResults;
  }

  /**
   * Generate common variations of company name
   */
  private generateNameVariations(companyName: string): string[] {
    const base = companyName.toLowerCase();
    const variations = [
      base,
      base.replace(/\s+/g, ''),
      base.replace(/\s+/g, '-'),
      base.replace(/\s+/g, '_'),
      base.replace(/\s+(inc|corp|llc|ltd|co)\.?$/i, ''),
      base.split(' ')[0], // First word only
    ];
    
    // Add variations without common suffixes
    if (base.includes('labs')) {
      variations.push(base.replace('labs', ''));
      variations.push(base.replace('labs', 'lab'));
    }
    
    if (base.includes('technologies')) {
      variations.push(base.replace('technologies', 'tech'));
      variations.push(base.replace('technologies', ''));
    }
    
    return Array.from(new Set(variations)); // Remove duplicates
  }

  /**
   * Calculate confidence score for a repository match
   */
  private calculateConfidence(companyName: string, repo: any): number {
    let confidence = 0;
    
    // Check owner name similarity
    const ownerSimilarity = this.calculateNameSimilarity(companyName, repo.owner);
    confidence += ownerSimilarity * 0.4;
    
    // Check repo name similarity
    const repoSimilarity = this.calculateNameSimilarity(companyName, repo.name);
    confidence += repoSimilarity * 0.3;
    
    // Boost for high star count
    if (repo.stars_count > 1000) confidence += 0.1;
    if (repo.stars_count > 10000) confidence += 0.1;
    
    // Boost for recent activity
    const pushedAt = new Date(repo.pushed_at);
    const daysSinceUpdate = (Date.now() - pushedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < 30) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Calculate name similarity (0-1)
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    const clean1 = name1.toLowerCase().replace(/[^a-z0-9]/g, '');
    const clean2 = name2.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Exact match
    if (clean1 === clean2) return 1.0;
    
    // One contains the other
    if (clean1.includes(clean2) || clean2.includes(clean1)) return 0.8;
    
    // Calculate Levenshtein distance
    const distance = this.levenshteinDistance(clean1, clean2);
    const maxLength = Math.max(clean1.length, clean2.length);
    const similarity = 1 - (distance / maxLength);
    
    return Math.max(0, similarity);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Remove duplicates and rank by confidence
   */
  private deduplicateAndRank(repos: DiscoveryResult['repositories']): DiscoveryResult['repositories'] {
    const seen = new Map<string, typeof repos[0]>();
    
    for (const repo of repos) {
      const key = repo.full_name || `${repo.owner}/${repo.name}`;
      const existing = seen.get(key);
      
      if (!existing || repo.confidence > existing.confidence) {
        seen.set(key, repo);
      }
    }
    
    return Array.from(seen.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10); // Top 10 results
  }
}

/**
 * Run discovery for all companies without GitHub repos
 */
export async function discoverAllCompanyRepos() {
  const supabase = await createServerClient();
  const discovery = new GitHubAutoDiscovery();
  
  // Get companies without GitHub repos
  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, name, website')
    .eq('status', 'Active')
    .order('created_at', { ascending: false });
    
  if (error || !companies) {
    console.error('Error fetching companies:', error);
    return;
  }
  
  console.log(`Found ${companies.length} companies to process`);
  
  for (const company of companies) {
    // Check if company already has repos
    const { count } = await supabase
      .from('company_github_repositories')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', company.id);
      
    if (count && count > 0) {
      console.log(`⏭️  Skipping ${company.name} (already has repos)`);
      continue;
    }
    
    // Discover repositories
    const results = await discovery.discoverRepositoriesForCompany(
      company.id,
      company.name,
      company.website
    );
    
    console.log(`📊 Found ${results.repositories.length} potential repos for ${company.name}`);
    
    // Auto-approve high confidence matches
    for (const repo of results.repositories) {
      if (repo.confidence >= 0.8) {
        console.log(`✅ Auto-approving ${repo.full_name} (confidence: ${repo.confidence})`);
        
        // Fetch and store the repository
        await githubStorageService.fetchAndStoreRepository(repo.owner, repo.name);
        
        // First get the repository ID from the database
        const supabase = await createServerClient();
        const { data: repoData } = await supabase
          .from('github_repositories')
          .select('id')
          .eq('full_name', repo.full_name)
          .single();
          
        if (repoData) {
          // Associate with company
          await githubStorageService.associateRepositoryWithCompany({
            company_id: company.id,
            repository_id: repoData.id,
            is_primary: repo.confidence >= 0.9,
            confidence_score: repo.confidence,
            discovery_method: repo.discoveryMethod as 'manual' | 'search' | 'api' | 'website',
          });
        }
      } else {
        console.log(`🤔 Manual review needed for ${repo.full_name} (confidence: ${repo.confidence})`);
        // TODO: Store in review queue
      }
    }
    
    // Rate limit pause
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Allow running as a script
if (typeof require !== 'undefined' && require.main === module) {
  discoverAllCompanyRepos()
    .then(() => console.log('✅ Discovery complete'))
    .catch(error => console.error('❌ Discovery failed:', error));
}