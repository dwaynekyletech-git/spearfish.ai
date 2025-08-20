/**
 * Y Combinator OSS API Import Service
 * 
 * Service for importing YC company data from the free YC OSS API.
 * Handles fetching, parsing, validation, and transformation of company data
 * from https://yc-oss.github.io/api/companies/all.json
 * 
 * Features:
 * - Fetches all 5,402+ YC companies from OSS API
 * - AI company detection and classification
 * - Batch processing for large datasets
 * - Progress tracking and error handling
 * - Database mapping and storage
 */

import { z } from 'zod';
import { createServiceClient } from './supabase-server';
import { logInfo, logDebug, logWarn, logError } from './logger';
import { AIClassificationService } from './ai-classification-service';
import AICompanyDetector from './ai-company-detector';

// =============================================================================
// Type Definitions for YC OSS API Structure
// =============================================================================

const YCOSSCompanySchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  former_names: z.array(z.string()).optional().nullable(),
  small_logo_thumb_url: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  all_locations: z.string().optional().nullable(),
  long_description: z.string().optional().nullable(),
  one_liner: z.string().optional().nullable(),
  team_size: z.number().optional().nullable(),
  industry: z.string().optional().nullable(),
  subindustry: z.string().optional().nullable(),
  launched_at: z.number().optional().nullable(), // Unix timestamp
  tags: z.array(z.string()).optional().nullable(),
  tags_highlighted: z.array(z.string()).optional().nullable(),
  top_company: z.boolean().optional().nullable(),
  isHiring: z.boolean().optional().nullable(),
  nonprofit: z.boolean().optional().nullable(),
  batch: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  industries: z.array(z.string()).optional().nullable(),
  regions: z.array(z.string()).optional().nullable(),
  stage: z.string().optional().nullable(),
  app_video_public: z.boolean().optional().nullable(),
  demo_day_video_public: z.boolean().optional().nullable(),
  app_answers: z.any().optional().nullable(),
  question_answers: z.boolean().optional().nullable(),
  url: z.string().optional().nullable(),
  api: z.string().optional().nullable()
});

export type YCOSSCompany = z.infer<typeof YCOSSCompanySchema>;

// =============================================================================
// Import Result Types
// =============================================================================

export interface YCOSSImportResult {
  success: boolean;
  companiesProcessed: number;
  companiesImported: number;
  aiCompanies: number;
  nonAiCompanies: number;
  errors: string[];
  warnings: string[];
  skipped: string[];
  processingTimeMs: number;
  downloadTimeMs: number;
  classificationTimeMs: number;
}

export interface YCOSSImportOptions {
  clearExisting?: boolean;
  dryRun?: boolean;
  batchSize?: number;
  skipDuplicates?: boolean;
  classifyAI?: boolean;
  aiOnly?: boolean; // Only import AI companies
  confidenceThreshold?: number; // Minimum AI confidence (0-1)
  maxCompanies?: number; // Limit for testing
}

// =============================================================================
// Database Company Mapping Interface
// =============================================================================

interface DatabaseCompany {
  yc_api_id: number;
  name: string;
  slug: string;
  website_url: string | null;
  one_liner: string | null;
  long_description: string | null;
  batch: string | null;
  status: string | null;
  industry: string | null;
  subindustry: string | null;
  tags: string[]; // Will be stored as JSONB
  regions: string[]; // Will be stored as JSONB
  team_size: number | null;
  launched_at: number | null; // Unix timestamp
  small_logo_thumb_url: string | null;
  is_hiring: boolean | null;
  is_ai_related?: boolean;
  ai_confidence_score?: number;
}

// =============================================================================
// YC OSS Import Service Class
// =============================================================================

export class YCOSSImportService {
  private supabase;
  private aiClassifier: AIClassificationService;

  constructor() {
    this.supabase = createServiceClient();
    this.aiClassifier = new AIClassificationService();
  }

  // =============================================================================
  // Main Import Methods
  // =============================================================================

  /**
   * Import all companies from YC OSS API
   */
  async importFromYCOSS(
    options: YCOSSImportOptions = {}
  ): Promise<YCOSSImportResult> {
    const startTime = Date.now();
    const result: YCOSSImportResult = {
      success: false,
      companiesProcessed: 0,
      companiesImported: 0,
      aiCompanies: 0,
      nonAiCompanies: 0,
      errors: [],
      warnings: [],
      skipped: [],
      processingTimeMs: 0,
      downloadTimeMs: 0,
      classificationTimeMs: 0
    };

    try {
      logInfo('Starting YC OSS API import', { options });

      // Download data from YC OSS API
      const downloadStart = Date.now();
      const companies = await this.fetchYCOSSData();
      result.downloadTimeMs = Date.now() - downloadStart;
      result.companiesProcessed = companies.length;

      logInfo(`Downloaded ${companies.length} companies from YC OSS API`);

      // Apply limits for testing
      const limitedCompanies = options.maxCompanies 
        ? companies.slice(0, options.maxCompanies)
        : companies;

      logInfo(`Processing ${limitedCompanies.length} companies`);

      // Clear existing data if requested
      if (options.clearExisting && !options.dryRun) {
        await this.clearExistingData();
        logInfo('Cleared existing company data');
      }

      // Process companies in batches
      const batchSize = options.batchSize || 50; // Larger batches for efficiency
      const classificationStart = Date.now();

      for (let i = 0; i < limitedCompanies.length; i += batchSize) {
        const batch = limitedCompanies.slice(i, i + batchSize);
        const batchResult = await this.processBatch(batch, options);
        
        result.companiesImported += batchResult.companiesImported;
        result.aiCompanies += batchResult.aiCompanies;
        result.nonAiCompanies += batchResult.nonAiCompanies;
        result.errors.push(...batchResult.errors);
        result.warnings.push(...batchResult.warnings);
        result.skipped.push(...batchResult.skipped);

        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(limitedCompanies.length / batchSize);
        logInfo(`Completed batch ${batchNum}/${totalBatches}: ${batchResult.companiesImported} imported, ${batchResult.aiCompanies} AI companies`);
      }

      result.classificationTimeMs = Date.now() - classificationStart;
      result.success = result.errors.length === 0;
      result.processingTimeMs = Date.now() - startTime;

      logInfo('YC OSS import completed', {
        companiesImported: result.companiesImported,
        aiCompanies: result.aiCompanies,
        nonAiCompanies: result.nonAiCompanies,
        errors: result.errors.length,
        warnings: result.warnings.length,
        processingTimeMs: result.processingTimeMs,
        downloadTimeMs: result.downloadTimeMs,
        classificationTimeMs: result.classificationTimeMs
      });

      return result;
    } catch (error) {
      result.errors.push(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.processingTimeMs = Date.now() - startTime;
      logError('YC OSS import failed', error);
      return result;
    }
  }

  // =============================================================================
  // Data Fetching Methods
  // =============================================================================

  /**
   * Fetch all companies from YC OSS API
   */
  private async fetchYCOSSData(): Promise<YCOSSCompany[]> {
    try {
      const response = await fetch('https://yc-oss.github.io/api/companies/all.json');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error('API response is not an array');
      }

      // Validate each company
      const validatedCompanies: YCOSSCompany[] = [];
      for (let i = 0; i < data.length; i++) {
        try {
          const company = YCOSSCompanySchema.parse(data[i]);
          validatedCompanies.push(company);
        } catch (error) {
          logWarn(`Skipping invalid company at index ${i}`, { error });
        }
      }

      logInfo(`Validated ${validatedCompanies.length}/${data.length} companies`);
      return validatedCompanies;
    } catch (error) {
      throw new Error(`Failed to fetch YC OSS data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================================================
  // Data Processing Methods
  // =============================================================================

  /**
   * Process a batch of companies
   */
  private async processBatch(
    companies: YCOSSCompany[],
    options: YCOSSImportOptions
  ): Promise<{
    companiesImported: number;
    aiCompanies: number;
    nonAiCompanies: number;
    errors: string[];
    warnings: string[];
    skipped: string[];
  }> {
    const result = {
      companiesImported: 0,
      aiCompanies: 0,
      nonAiCompanies: 0,
      errors: [] as string[],
      warnings: [] as string[],
      skipped: [] as string[]
    };

    for (const company of companies) {
      try {
        const companyResult = await this.processSingleCompany(company, options);
        
        if (companyResult.imported) {
          result.companiesImported++;
          if (companyResult.isAI) {
            result.aiCompanies++;
          } else {
            result.nonAiCompanies++;
          }
        } else if (companyResult.skipped) {
          result.skipped.push(`${company.name}: ${companyResult.reason}`);
        }

        if (companyResult.warnings) {
          result.warnings.push(...companyResult.warnings);
        }
      } catch (error) {
        const errorMsg = `Failed to process ${company.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(errorMsg);
        logError('Company processing failed', { company: company.name, error });
      }
    }

    return result;
  }

  /**
   * Process a single company with AI classification
   */
  private async processSingleCompany(
    company: YCOSSCompany,
    options: YCOSSImportOptions
  ): Promise<{
    imported: boolean;
    skipped: boolean;
    isAI: boolean;
    reason?: string;
    warnings?: string[];
  }> {
    const warnings: string[] = [];

    // Skip if duplicate and skipDuplicates is enabled
    if (options.skipDuplicates) {
      const existing = await this.findExistingCompany(company);
      if (existing) {
        return {
          imported: false,
          skipped: true,
          isAI: false,
          reason: 'Already exists'
        };
      }
    }

    // Map to database format
    const dbCompany = this.mapToDatabase(company);

    // Perform AI classification if requested
    let isAI = false;
    let aiConfidence = 0;

    if (options.classifyAI) {
      try {
        // Convert YC OSS company to format expected by detector
        const companyForDetection = {
          id: crypto.randomUUID(), // Generate temporary UUID for detection
          name: company.name,
          one_liner: company.one_liner || '',
          long_description: company.long_description || '',
          industry: company.industry || '',
          tags: company.tags || [],
          batch: company.batch || '',
          team_size: company.team_size || 0,
          status: 'Active' as const,
          regions: [],
          is_hiring: false,
          github_repos: [],
          huggingface_models: []
        };

        const detection = AICompanyDetector.detectAICompany(companyForDetection);
        isAI = detection.isAI;
        aiConfidence = detection.confidence;

        // Apply confidence threshold
        if (options.confidenceThreshold && aiConfidence < options.confidenceThreshold) {
          isAI = false;
        }

        dbCompany.is_ai_related = isAI;
        dbCompany.ai_confidence_score = aiConfidence;

        logDebug(`AI classification for ${company.name}`, {
          isAI,
          confidence: aiConfidence,
          tier: detection.tier
        });
      } catch (error) {
        warnings.push(`AI classification failed for ${company.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        logWarn('AI classification failed', { company: company.name, error });
      }
    }

    // Skip non-AI companies if aiOnly is enabled
    if (options.aiOnly && !isAI) {
      return {
        imported: false,
        skipped: true,
        isAI: false,
        reason: 'Not classified as AI company'
      };
    }

    // Insert/update in database
    if (!options.dryRun) {
      await this.insertCompany(dbCompany);
    }

    return {
      imported: true,
      skipped: false,
      isAI,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  // =============================================================================
  // Database Operations
  // =============================================================================

  /**
   * Map YC OSS company to database format
   */
  private mapToDatabase(company: YCOSSCompany): DatabaseCompany {
    // Helper function to validate URLs
    const validateUrl = (url: string | null | undefined): string | null => {
      if (!url || url.trim() === '') return null;
      try {
        new URL(url);
        return url;
      } catch {
        return null;
      }
    };

    return {
      yc_api_id: company.id,
      name: company.name,
      slug: company.slug,
      website_url: validateUrl(company.website),
      one_liner: company.one_liner || null,
      long_description: company.long_description || null,
      batch: company.batch || null,
      status: company.status || 'Active',
      industry: company.industry || null,
      subindustry: company.subindustry || null,
      tags: company.tags || [],
      regions: company.regions || [],
      team_size: company.team_size || null,
      launched_at: company.launched_at || null,
      small_logo_thumb_url: validateUrl(company.small_logo_thumb_url),
      is_hiring: company.isHiring || false
    };
  }

  /**
   * Find existing company by various identifiers
   */
  private async findExistingCompany(company: YCOSSCompany): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('companies')
      .select('id')
      .or(`yc_api_id.eq.${company.id},slug.eq.${company.slug},name.eq.${company.name}`)
      .limit(1);

    if (error) {
      logWarn('Error checking for existing company', { company: company.name, error });
      return false;
    }

    return data && data.length > 0;
  }

  /**
   * Insert company into database using direct upsert
   */
  private async insertCompany(dbCompany: DatabaseCompany): Promise<void> {
    // Try direct upsert first
    const { data, error } = await this.supabase
      .from('companies')
      .upsert({
        yc_api_id: dbCompany.yc_api_id,
        name: dbCompany.name,
        slug: dbCompany.slug,
        website_url: dbCompany.website_url,
        one_liner: dbCompany.one_liner,
        long_description: dbCompany.long_description,
        batch: dbCompany.batch,
        status: dbCompany.status,
        industry: dbCompany.industry,
        subindustry: dbCompany.subindustry,
        tags: dbCompany.tags, // Pass array directly for JSONB
        regions: dbCompany.regions, // Pass array directly for JSONB
        team_size: dbCompany.team_size,
        launched_at: dbCompany.launched_at,
        small_logo_thumb_url: dbCompany.small_logo_thumb_url,
        is_hiring: dbCompany.is_hiring,
        is_ai_related: dbCompany.is_ai_related || false,
        ai_confidence_score: dbCompany.ai_confidence_score || null,
        ai_classification_date: dbCompany.is_ai_related ? new Date().toISOString() : null,
        last_sync_date: new Date().toISOString(),
        sync_status: 'synced'
      }, {
        onConflict: 'yc_api_id',
        ignoreDuplicates: false
      })
      .select('id');

    if (error) {
      throw new Error(`Database insert failed: ${error.message}`);
    }
  }

  /**
   * Clear existing data
   */
  private async clearExistingData(): Promise<void> {
    const { error } = await this.supabase
      .from('companies')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) {
      throw new Error(`Failed to clear existing data: ${error.message}`);
    }
  }

  // =============================================================================
  // Utility Methods
  // =============================================================================

  /**
   * Test connection to YC OSS API
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch('https://yc-oss.github.io/api/meta.json');
      return response.ok;
    } catch (error) {
      logError('YC OSS API connection test failed', error);
      return false;
    }
  }

  /**
   * Get API metadata
   */
  async getMetadata(): Promise<any> {
    try {
      const response = await fetch('https://yc-oss.github.io/api/meta.json');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      throw new Error(`Failed to fetch metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create YC OSS Import Service instance
 */
export function createYCOSSImportService(): YCOSSImportService {
  return new YCOSSImportService();
}

// =============================================================================
// Export Types
// =============================================================================

// All types are already exported above where they are defined