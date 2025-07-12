/**
 * Y Combinator API Client
 * 
 * This module provides a TypeScript client for the unofficial Y Combinator Companies API
 * Documentation: https://github.com/yc-oss/api
 * 
 * Features:
 * - Fetch all companies or filter by batch, industry, tags
 * - Type-safe interfaces for company data
 * - Built-in error handling and retry logic
 * - Rate limiting and caching support
 */

// =============================================================================
// Type Definitions
// =============================================================================

export interface YCCompany {
  id: number;
  name: string;
  slug: string;
  website: string;
  one_liner: string;
  long_description: string;
  batch: string;
  status: 'Active' | 'Acquired' | 'Public' | 'Inactive';
  industry: string;
  subindustry?: string;
  tags: string[];
  regions: string[];
  team_size: number;
  launched_at: number;
  small_logo_thumb_url?: string;
  isHiring?: boolean;
  stage?: string;
}

export interface YCMeta {
  last_updated: string;
  total_companies: number;
  readme: string;
  companies: {
    [key: string]: number;
  };
  tags: {
    [key: string]: number;
  };
  industries: {
    [key: string]: number;
  };
  batches: {
    [key: string]: number;
  };
}

export interface YCApiOptions {
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface FetchOptions {
  batch?: string | string[];
  industry?: string | string[];
  tags?: string | string[];
  status?: string | string[];
  isHiring?: boolean;
  limit?: number;
}

// =============================================================================
// Y Combinator API Client Class
// =============================================================================

export class YCApiClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly retryAttempts: number;
  private readonly retryDelay: number;
  private metaCache: YCMeta | null = null;
  private companiesCache: YCCompany[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly cacheExpiry: number = 1000 * 60 * 60; // 1 hour

  constructor(options: YCApiOptions = {}) {
    this.baseUrl = options.baseUrl || 'https://yc-oss.github.io/api';
    this.timeout = options.timeout || 30000; // 30 seconds
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000; // 1 second
  }

  // =============================================================================
  // Core API Methods
  // =============================================================================

  /**
   * Fetch API metadata including counts and available endpoints
   */
  async getMeta(): Promise<YCMeta> {
    if (this.metaCache && this.isCacheValid()) {
      return this.metaCache;
    }

    const data = await this.fetchWithRetry<YCMeta>('/meta.json');
    this.metaCache = data;
    this.cacheTimestamp = Date.now();
    return data;
  }

  /**
   * Fetch all companies with optional filtering
   */
  async getCompanies(options: FetchOptions = {}): Promise<YCCompany[]> {
    // Use cache if no filters and cache is valid
    if (Object.keys(options).length === 0 && this.companiesCache && this.isCacheValid()) {
      return this.companiesCache;
    }

    const companies = await this.fetchWithRetry<YCCompany[]>('/companies/all.json');
    
    // Cache unfiltered results
    if (Object.keys(options).length === 0) {
      this.companiesCache = companies;
      this.cacheTimestamp = Date.now();
    }

    return this.filterCompanies(companies, options);
  }

  /**
   * Fetch companies from specific batches (W22, S22, W23)
   */
  async getCompaniesByBatch(batches: string | string[]): Promise<YCCompany[]> {
    const batchArray = Array.isArray(batches) ? batches : [batches];
    return this.getCompanies({ batch: batchArray });
  }

  /**
   * Fetch companies that might be AI-related based on tags and industry
   */
  async getAIPotentialCompanies(batches?: string[]): Promise<YCCompany[]> {
    const aiRelatedTags = [
      'AI', 'Machine Learning', 'Artificial Intelligence', 'ML', 'Computer Vision',
      'Natural Language Processing', 'NLP', 'Deep Learning', 'Data Science',
      'Robotics', 'Automation', 'Analytics', 'Big Data'
    ];

    const aiRelatedIndustries = [
      'Artificial Intelligence', 'Machine Learning', 'Data Science',
      'Computer Vision', 'Natural Language Processing'
    ];

    // Get all companies first, then filter
    const allCompanies = await this.getCompanies();
    
    // Filter by batches if specified
    let companiesInBatches = allCompanies;
    if (batches) {
      const normalizedBatches = this.normalizeBatchNames(batches);
      companiesInBatches = allCompanies.filter(company => 
        normalizedBatches.some(batch => 
          company.batch.toLowerCase() === batch.toLowerCase()
        )
      );
    }

    // Filter for AI-related companies using multiple criteria
    const aiCompanies = companiesInBatches.filter(company => {
      // Check tags
      const hasAITags = aiRelatedTags.some(tag =>
        company.tags.some(companyTag => 
          companyTag.toLowerCase().includes(tag.toLowerCase())
        )
      );

      // Check industry
      const hasAIIndustry = aiRelatedIndustries.some(industry =>
        company.industry.toLowerCase().includes(industry.toLowerCase()) ||
        (company.subindustry && company.subindustry.toLowerCase().includes(industry.toLowerCase()))
      );

      // Check descriptions for AI keywords
      const text = `${company.one_liner} ${company.long_description}`.toLowerCase();
      const aiKeywords = [
        'artificial intelligence', 'machine learning', 'ai', 'ml', 'neural',
        'computer vision', 'nlp', 'natural language', 'deep learning',
        'automation', 'predictive', 'algorithm', 'data science', 'llm',
        'generative ai', 'chatbot', 'autonomous', 'recommendation engine'
      ];
      const hasAIKeywords = aiKeywords.some(keyword => text.includes(keyword));

      return hasAITags || hasAIIndustry || hasAIKeywords;
    });

    return aiCompanies;
  }

  /**
   * Normalize batch names to handle different formats (W22 -> Winter 2022)
   */
  private normalizeBatchNames(batches: string[]): string[] {
    return batches.map(batch => {
      // Convert short format to long format
      if (batch.match(/^[WS]\d{2}$/)) {
        const season = batch.startsWith('W') ? 'Winter' : 'Summer';
        const year = '20' + batch.slice(1);
        return `${season} ${year}`;
      }
      return batch;
    });
  }

  /**
   * Get top companies (if endpoint is available)
   */
  async getTopCompanies(): Promise<YCCompany[]> {
    try {
      return await this.fetchWithRetry<YCCompany[]>('/companies/top.json');
    } catch (error) {
      console.warn('Top companies endpoint not available, falling back to all companies');
      const companies = await this.getCompanies();
      // Sort by a simple heuristic (team size and launched date)
      return companies
        .sort((a, b) => (b.team_size || 0) - (a.team_size || 0))
        .slice(0, 100);
    }
  }

  // =============================================================================
  // Utility Methods
  // =============================================================================

  /**
   * Filter companies based on provided criteria
   */
  private filterCompanies(companies: YCCompany[], options: FetchOptions): YCCompany[] {
    let filtered = companies;

    if (options.batch) {
      const batches = Array.isArray(options.batch) ? options.batch : [options.batch];
      const normalizedBatches = this.normalizeBatchNames(batches);
      filtered = filtered.filter(company => 
        normalizedBatches.some(batch => 
          company.batch.toLowerCase() === batch.toLowerCase()
        )
      );
    }

    if (options.industry) {
      const industries = Array.isArray(options.industry) ? options.industry : [options.industry];
      filtered = filtered.filter(company => 
        industries.some(industry => 
          company.industry.toLowerCase().includes(industry.toLowerCase()) ||
          (company.subindustry && company.subindustry.toLowerCase().includes(industry.toLowerCase()))
        )
      );
    }

    if (options.tags) {
      const tags = Array.isArray(options.tags) ? options.tags : [options.tags];
      filtered = filtered.filter(company => 
        tags.some(tag => 
          company.tags.some(companyTag => 
            companyTag.toLowerCase().includes(tag.toLowerCase())
          )
        )
      );
    }

    if (options.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status];
      filtered = filtered.filter(company => 
        statuses.includes(company.status)
      );
    }

    if (options.isHiring !== undefined) {
      filtered = filtered.filter(company => company.isHiring === options.isHiring);
    }

    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Fetch data with retry logic and error handling
   */
  private async fetchWithRetry<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    let lastError: Error;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'SpearfishAI/1.0'
          }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data as T;

      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.retryAttempts) {
          console.warn(`YC API request failed (attempt ${attempt}/${this.retryAttempts}):`, error);
          await this.delay(this.retryDelay * attempt); // Exponential backoff
        }
      }
    }

    throw new Error(`YC API request failed after ${this.retryAttempts} attempts: ${lastError!.message}`);
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    return Date.now() - this.cacheTimestamp < this.cacheExpiry;
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.metaCache = null;
    this.companiesCache = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Get cache statistics
   */
  getCacheInfo() {
    return {
      hasMetaCache: !!this.metaCache,
      hasCompaniesCache: !!this.companiesCache,
      cacheAge: Date.now() - this.cacheTimestamp,
      isValid: this.isCacheValid()
    };
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Create a pre-configured YC API client
 */
export function createYCClient(options?: YCApiOptions): YCApiClient {
  return new YCApiClient(options);
}

/**
 * Quick function to get companies from target batches
 */
export async function getTargetBatchCompanies(): Promise<YCCompany[]> {
  const client = createYCClient();
  return client.getCompaniesByBatch(['W22', 'S22', 'W23']);
}

/**
 * Quick function to get AI-related companies from target batches
 */
export async function getTargetAICompanies(): Promise<YCCompany[]> {
  const client = createYCClient();
  return client.getAIPotentialCompanies(['W22', 'S22', 'W23']);
}

// =============================================================================
// Export Default Instance
// =============================================================================

export const ycApi = createYCClient();