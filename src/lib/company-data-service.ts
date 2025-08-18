/**
 * Company Data Service
 * 
 * Enhanced service for fetching, validating, and processing Y Combinator company data
 * with robust error handling, data validation, and batch processing capabilities.
 */

import { YCApiClient, YCCompany, createYCClient } from './yc-api';
import { logInfo, logDebug, logWarn, logError } from './logger';

// Re-export types for use in other modules
export type { YCCompany } from './yc-api';

// =============================================================================
// Enhanced Types and Interfaces
// =============================================================================

export interface CompanyDataValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  company?: ValidatedCompany;
}

export interface ValidatedCompany extends YCCompany {
  // Additional computed fields
  isAIRelated?: boolean;
  aiConfidence?: number;
  normalizedBatch: string;
  hasValidWebsite: boolean;
  descriptionLength: number;
  tagCount: number;
}

export interface BatchFetchOptions {
  batches: string[];
  validateData?: boolean;
  includeAIClassification?: boolean;
  maxRetries?: number;
  batchSize?: number;
  delayBetweenRequests?: number;
}

export interface BatchFetchResult {
  success: boolean;
  totalFetched: number;
  validCompanies: ValidatedCompany[];
  invalidCompanies: { company: any; errors: string[] }[];
  errors: string[];
  metadata: {
    batchBreakdown: Record<string, number>;
    processingTime: number;
    aiRelatedCount: number;
  };
}

// =============================================================================
// Company Data Validation
// =============================================================================

export class CompanyDataValidator {
  private static readonly REQUIRED_FIELDS = ['id', 'name', 'batch'] as const;
  private static readonly VALID_STATUSES = ['Active', 'Acquired', 'Public', 'Inactive'] as const;
  private static readonly URL_REGEX = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;

  static validate(company: any): CompanyDataValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    for (const field of this.REQUIRED_FIELDS) {
      if (!company[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Validate data types and formats
    if (company.id && typeof company.id !== 'number') {
      errors.push('ID must be a number');
    }

    if (company.name && typeof company.name !== 'string') {
      errors.push('Name must be a string');
    } else if (company.name && company.name.trim().length === 0) {
      errors.push('Name cannot be empty');
    }

    if (company.batch && typeof company.batch !== 'string') {
      errors.push('Batch must be a string');
    }

    // Validate optional fields
    if (company.website && !this.URL_REGEX.test(company.website)) {
      warnings.push('Invalid website URL format');
    }

    if (company.status && !this.VALID_STATUSES.includes(company.status)) {
      warnings.push(`Invalid status: ${company.status}`);
    }

    if (company.team_size && (typeof company.team_size !== 'number' || company.team_size < 0)) {
      warnings.push('Invalid team size');
    }

    if (company.launched_at && (typeof company.launched_at !== 'number' || company.launched_at < 0)) {
      warnings.push('Invalid launch timestamp');
    }

    if (company.tags && !Array.isArray(company.tags)) {
      warnings.push('Tags should be an array');
    }

    if (company.regions && !Array.isArray(company.regions)) {
      warnings.push('Regions should be an array');
    }

    // Additional validation checks
    if (company.one_liner && company.one_liner.length > 500) {
      warnings.push('One-liner is unusually long');
    }

    if (company.long_description && company.long_description.length < 10) {
      warnings.push('Description is very short');
    }

    const isValid = errors.length === 0;
    
    // Create validated company object if valid
    let validatedCompany: ValidatedCompany | undefined;
    if (isValid) {
      validatedCompany = {
        ...company,
        normalizedBatch: this.normalizeBatch(company.batch),
        hasValidWebsite: company.website ? this.URL_REGEX.test(company.website) : false,
        descriptionLength: (company.long_description || '').length,
        tagCount: Array.isArray(company.tags) ? company.tags.length : 0
      };
    }

    return {
      isValid,
      errors,
      warnings,
      company: validatedCompany
    };
  }

  private static normalizeBatch(batch: string): string {
    // Normalize batch names (e.g., "Winter 2022" -> "W22")
    const match = batch.match(/^(Winter|Summer)\s+(\d{4})$/);
    if (match) {
      const [, season, year] = match;
      const shortSeason = season === 'Winter' ? 'W' : 'S';
      const shortYear = year.slice(-2);
      return `${shortSeason}${shortYear}`;
    }
    return batch;
  }
}

// =============================================================================
// Enhanced Company Data Service
// =============================================================================

export class CompanyDataService {
  private ycClient: YCApiClient;
  private validator: typeof CompanyDataValidator;

  constructor() {
    this.ycClient = createYCClient({
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000
    });
    this.validator = CompanyDataValidator;
  }

  /**
   * Fetch and validate companies from target batches with enhanced processing
   */
  async fetchTargetBatchCompanies(options: BatchFetchOptions): Promise<BatchFetchResult> {
    const startTime = Date.now();
    const result: BatchFetchResult = {
      success: false,
      totalFetched: 0,
      validCompanies: [],
      invalidCompanies: [],
      errors: [],
      metadata: {
        batchBreakdown: {},
        processingTime: 0,
        aiRelatedCount: 0
      }
    };

    try {
      logInfo('Fetching companies from batches', { batches: options.batches.join(', ') });
      
      // Fetch companies using the YC API client
      const companies = await this.ycClient.getCompaniesByBatch(options.batches);
      result.totalFetched = companies.length;

      logDebug('Fetched companies, starting validation', { companiesCount: companies.length });

      // Process companies with validation
      for (const company of companies) {
        // Add delay between requests if specified
        if (options.delayBetweenRequests) {
          await this.delay(options.delayBetweenRequests);
        }

        const validationResult = this.validator.validate(company);
        
        if (validationResult.isValid && validationResult.company) {
          let enhancedCompany = validationResult.company;
          
          // Add AI classification if requested
          if (options.includeAIClassification) {
            const aiClassification = this.classifyAsAIRelated(enhancedCompany);
            enhancedCompany = {
              ...enhancedCompany,
              ...aiClassification
            };
            
            if (aiClassification.isAIRelated) {
              result.metadata.aiRelatedCount++;
            }
          }

          result.validCompanies.push(enhancedCompany);
          
          // Update batch breakdown
          const batch = enhancedCompany.normalizedBatch;
          result.metadata.batchBreakdown[batch] = (result.metadata.batchBreakdown[batch] || 0) + 1;
        } else {
          result.invalidCompanies.push({
            company,
            errors: validationResult.errors
          });
        }
      }

      result.success = true;
      logInfo('Processing complete', { validCompanies: result.validCompanies.length, invalidCompanies: result.invalidCompanies.length });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      result.errors.push(errorMessage);
      console.error('Error fetching company data:', error);
    }

    result.metadata.processingTime = Date.now() - startTime;
    return result;
  }

  /**
   * Fetch only AI-related companies from target batches
   */
  async fetchAICompaniesFromTargetBatches(): Promise<ValidatedCompany[]> {
    try {
      const aiCompanies = await this.ycClient.getAIPotentialCompanies(['W22', 'S22', 'W23']);
      const validatedCompanies: ValidatedCompany[] = [];

      for (const company of aiCompanies) {
        const validationResult = this.validator.validate(company);
        if (validationResult.isValid && validationResult.company) {
          const aiClassification = this.classifyAsAIRelated(validationResult.company);
          validatedCompanies.push({
            ...validationResult.company,
            ...aiClassification
          });
        }
      }

      return validatedCompanies;
    } catch (error) {
      console.error('Error fetching AI companies:', error);
      throw error;
    }
  }

  /**
   * Get company statistics for analysis
   */
  async getCompanyStatistics(batches: string[] = ['W22', 'S22', 'W23']) {
    try {
      const companies = await this.ycClient.getCompaniesByBatch(batches);
      const aiCompanies = await this.ycClient.getAIPotentialCompanies(batches);

      const stats = {
        total: companies.length,
        aiRelated: aiCompanies.length,
        aiPercentage: ((aiCompanies.length / companies.length) * 100).toFixed(1),
        byBatch: {} as Record<string, any>,
        industries: {} as Record<string, number>,
        statuses: {} as Record<string, number>,
        averageTeamSize: 0
      };

      // Calculate statistics
      let totalTeamSize = 0;
      let companiesWithTeamSize = 0;

      for (const company of companies) {
        // Batch breakdown
        if (!stats.byBatch[company.batch]) {
          stats.byBatch[company.batch] = { total: 0, ai: 0 };
        }
        stats.byBatch[company.batch].total++;

        // Industry breakdown
        stats.industries[company.industry] = (stats.industries[company.industry] || 0) + 1;

        // Status breakdown
        stats.statuses[company.status] = (stats.statuses[company.status] || 0) + 1;

        // Team size calculation
        if (company.team_size && company.team_size > 0) {
          totalTeamSize += company.team_size;
          companiesWithTeamSize++;
        }
      }

      // AI companies by batch
      for (const aiCompany of aiCompanies) {
        if (stats.byBatch[aiCompany.batch]) {
          stats.byBatch[aiCompany.batch].ai++;
        }
      }

      stats.averageTeamSize = companiesWithTeamSize > 0 ? 
        Math.round(totalTeamSize / companiesWithTeamSize) : 0;

      return stats;
    } catch (error) {
      console.error('Error calculating statistics:', error);
      throw error;
    }
  }

  /**
   * Simple AI classification based on tags and descriptions
   */
  private classifyAsAIRelated(company: ValidatedCompany): { isAIRelated: boolean; aiConfidence: number } {
    let score = 0;
    const maxScore = 10;

    // Check tags
    const aiTags = ['AI', 'Machine Learning', 'ML', 'Artificial Intelligence', 'Computer Vision', 'NLP', 'Natural Language Processing', 'Deep Learning'];
    for (const tag of company.tags) {
      if (aiTags.some(aiTag => tag.toLowerCase().includes(aiTag.toLowerCase()))) {
        score += 3; // High weight for explicit AI tags
        break;
      }
    }

    // Check industry
    if (company.industry.toLowerCase().includes('artificial intelligence') || 
        company.industry.toLowerCase().includes('machine learning')) {
      score += 2;
    }

    // Check descriptions for AI keywords
    const text = `${company.one_liner || ''} ${company.long_description || ''}`.toLowerCase();
    const aiKeywords = ['artificial intelligence', 'machine learning', 'ai', 'ml', 'neural', 'algorithm', 'predictive', 'automation', 'chatbot', 'llm', 'generative'];
    
    let keywordMatches = 0;
    for (const keyword of aiKeywords) {
      if (text.includes(keyword)) {
        keywordMatches++;
      }
    }

    if (keywordMatches > 0) {
      score += Math.min(keywordMatches, 3); // Cap at 3 points for keywords
    }

    // Additional signals
    if (text.includes('api') && (text.includes('ai') || text.includes('ml'))) {
      score += 1; // AI/ML API companies
    }

    if (text.includes('analytics') || text.includes('data science')) {
      score += 1; // Data-related companies
    }

    const confidence = Math.min(score / maxScore, 1);
    const isAIRelated = confidence >= 0.3; // Threshold for AI classification

    return {
      isAIRelated,
      aiConfidence: Math.round(confidence * 100) / 100
    };
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get cache information from the underlying YC client
   */
  getCacheInfo() {
    return this.ycClient.getCacheInfo();
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.ycClient.clearCache();
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Create a new company data service instance
 */
export function createCompanyDataService(): CompanyDataService {
  return new CompanyDataService();
}

/**
 * Quick function to get validated target batch companies
 */
export async function getValidatedTargetCompanies(): Promise<ValidatedCompany[]> {
  const service = createCompanyDataService();
  const result = await service.fetchTargetBatchCompanies({
    batches: ['W22', 'S22', 'W23'],
    validateData: true,
    includeAIClassification: true
  });
  
  if (!result.success) {
    throw new Error(`Failed to fetch companies: ${result.errors.join(', ')}`);
  }
  
  return result.validCompanies;
}

// Export default instance
export const companyDataService = createCompanyDataService();