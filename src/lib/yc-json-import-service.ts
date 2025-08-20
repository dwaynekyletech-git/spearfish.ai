/**
 * Y Combinator JSON Import Service
 * 
 * Service for importing YC company data from Apify JSON exports.
 * Handles parsing, validation, and transformation of JSON data into database format.
 * 
 * Features:
 * - Type-safe parsing and validation
 * - Data transformation and enrichment
 * - Batch processing for large datasets
 * - Progress tracking and error handling
 * - Founder and job data extraction
 */

import { z } from 'zod';
import { createServiceClient } from './supabase-server';
import { logInfo, logDebug, logWarn, logError } from './logger';
import { extractIndustry, extractMultipleIndustries } from './industry-extraction-service';

// =============================================================================
// Type Definitions for Apify JSON Structure
// =============================================================================

const ApifyFounderSchema = z.object({
  id: z.number(),
  name: z.string(),
  linkedin: z.string().url().optional().nullable(),
  x: z.string().url().optional().nullable()
});

const ApifyJobSchema = z.object({
  id: z.number().optional().nullable(),
  title: z.string().optional().nullable(),
  description_url: z.string().url().optional().nullable(),
  description: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  salary: z.string().optional().nullable(),
  years_experience: z.string().optional().nullable()
});

const ApifyCompanySchema = z.object({
  url: z.string().url(),
  company_id: z.number(),
  company_name: z.string(),
  short_description: z.string().optional().nullable(),
  long_description: z.string().optional().nullable(),
  company_image: z.string().url().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  status: z.string(),
  batch: z.string(),
  website: z.string().url().optional().nullable(),
  year_founded: z.string().optional().nullable(),
  team_size: z.string().optional().nullable(),
  company_location: z.string().optional().nullable(),
  company_linkedin: z.string().url().optional().nullable(),
  company_x: z.string().url().optional().nullable(),
  primary_partner: z.string().optional().nullable(),
  founders: z.array(ApifyFounderSchema).optional().nullable(),
  is_hiring: z.boolean().optional().nullable(),
  number_of_open_jobs: z.number().optional().nullable(),
  open_jobs: z.array(ApifyJobSchema).optional().nullable()
});

export type ApifyCompany = z.infer<typeof ApifyCompanySchema>;
export type ApifyFounder = z.infer<typeof ApifyFounderSchema>;
export type ApifyJob = z.infer<typeof ApifyJobSchema>;

// =============================================================================
// Import Result Types
// =============================================================================

export interface ImportResult {
  success: boolean;
  companiesProcessed: number;
  companiesImported: number;
  foundersImported: number;
  jobsImported: number;
  errors: string[];
  warnings: string[];
  skipped: string[];
  processingTimeMs: number;
}

export interface ImportOptions {
  clearExisting?: boolean;
  dryRun?: boolean;
  batchSize?: number;
  skipDuplicates?: boolean;
  validateUrls?: boolean;
}

// =============================================================================
// YC JSON Import Service
// =============================================================================

export class YCJSONImportService {
  private supabase;

  constructor() {
    this.supabase = createServiceClient();
  }

  // =============================================================================
  // Main Import Methods
  // =============================================================================

  /**
   * Import companies from JSON file content
   */
  async importFromJSON(
    jsonContent: string,
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    const startTime = Date.now();
    const result: ImportResult = {
      success: false,
      companiesProcessed: 0,
      companiesImported: 0,
      foundersImported: 0,
      jobsImported: 0,
      errors: [],
      warnings: [],
      skipped: [],
      processingTimeMs: 0
    };

    try {
      logInfo('Starting JSON import', { options });

      // Parse and validate JSON
      const companies = await this.parseAndValidateJSON(jsonContent);
      result.companiesProcessed = companies.length;

      logInfo(`Parsed ${companies.length} companies from JSON`);

      // Clear existing data if requested
      if (options.clearExisting) {
        await this.clearExistingData();
        logInfo('Cleared existing company data');
      }

      // Process companies in batches
      const batchSize = options.batchSize || 10;
      for (let i = 0; i < companies.length; i += batchSize) {
        const batch = companies.slice(i, i + batchSize);
        const batchResult = await this.processBatch(batch, options);
        
        result.companiesImported += batchResult.companiesImported;
        result.foundersImported += batchResult.foundersImported;
        result.jobsImported += batchResult.jobsImported;
        result.errors.push(...batchResult.errors);
        result.warnings.push(...batchResult.warnings);
        result.skipped.push(...batchResult.skipped);

        logDebug(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(companies.length / batchSize)}`);
      }

      result.success = result.errors.length === 0;
      result.processingTimeMs = Date.now() - startTime;

      logInfo('JSON import completed', {
        companiesImported: result.companiesImported,
        foundersImported: result.foundersImported,
        jobsImported: result.jobsImported,
        errors: result.errors.length,
        warnings: result.warnings.length,
        processingTimeMs: result.processingTimeMs
      });

      return result;
    } catch (error) {
      result.errors.push(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.processingTimeMs = Date.now() - startTime;
      logError('JSON import failed', error);
      return result;
    }
  }

  /**
   * Import from file path
   */
  async importFromFile(
    filePath: string,
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    try {
      const fs = await import('fs/promises');
      const jsonContent = await fs.readFile(filePath, 'utf-8');
      return this.importFromJSON(jsonContent, options);
    } catch (error) {
      logError('Failed to read JSON file', { filePath, error });
      return {
        success: false,
        companiesProcessed: 0,
        companiesImported: 0,
        foundersImported: 0,
        jobsImported: 0,
        errors: [`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: [],
        skipped: [],
        processingTimeMs: 0
      };
    }
  }

  /**
   * Import from Apify dataset or actor
   */
  async importFromApify(
    options: ImportOptions & {
      datasetId?: string;
      actorId?: string;
      runActor?: boolean;
      apifyOptions?: {
        limit?: number;
        offset?: number;
        clean?: boolean;
      };
    } = {}
  ): Promise<ImportResult> {
    const startTime = Date.now();
    const result: ImportResult = {
      success: false,
      companiesProcessed: 0,
      companiesImported: 0,
      foundersImported: 0,
      jobsImported: 0,
      errors: [],
      warnings: [],
      skipped: [],
      processingTimeMs: 0
    };

    try {
      logInfo('Starting Apify import', { options });

      // Import and create Apify service
      const { createApifyService } = await import('./apify-service');
      const apifyService = createApifyService();

      // Test connection
      const isConnected = await apifyService.testConnection();
      if (!isConnected) {
        throw new Error('Failed to connect to Apify API. Check your APIFY_API_TOKEN.');
      }

      let apifyResult;

      if (options.runActor) {
        // Run actor first to get fresh data
        logInfo('Running Apify actor for fresh data...');
        const runResult = await apifyService.runActor(options.actorId);
        
        if (!runResult.success || !runResult.data) {
          throw new Error(`Actor run failed: ${runResult.error || 'Unknown error'}`);
        }

        // Fetch data from the new dataset
        apifyResult = await apifyService.fetchDataset(runResult.data, options.apifyOptions);
      } else if (options.datasetId) {
        // Fetch from specific dataset
        apifyResult = await apifyService.fetchDataset(options.datasetId, options.apifyOptions);
      } else {
        // Fetch from latest dataset of configured actor
        apifyResult = await apifyService.getLatestDataset(options.apifyOptions);
      }

      if (!apifyResult.success || !apifyResult.data) {
        throw new Error(`Failed to fetch data from Apify: ${apifyResult.error || 'Unknown error'}`);
      }

      const companies = apifyResult.data as ApifyCompany[];
      result.companiesProcessed = companies.length;

      logInfo(`Fetched ${companies.length} companies from Apify`);
      logInfo(`Apify API Usage - Items: ${apifyResult.usage.itemsRetrieved}, Cost: $${apifyResult.usage.costUsd.toFixed(4)}`);

      // Validate the data structure
      const validatedCompanies = companies.map(company => {
        try {
          return ApifyCompanySchema.parse(company);
        } catch (error) {
          result.warnings.push(`Invalid company data: ${company.company_name || 'Unknown'}`);
          return null;
        }
      }).filter((company): company is ApifyCompany => company !== null);

      if (validatedCompanies.length !== companies.length) {
        result.warnings.push(`${companies.length - validatedCompanies.length} companies had validation errors`);
      }

      // Clear existing data if requested
      if (options.clearExisting) {
        await this.clearExistingData();
        logInfo('Cleared existing company data');
      }

      // Process companies in batches
      const batchSize = options.batchSize || 10;
      for (let i = 0; i < validatedCompanies.length; i += batchSize) {
        const batch = validatedCompanies.slice(i, i + batchSize);
        
        if (options.dryRun) {
          logInfo(`[DRY RUN] Would process batch ${Math.floor(i / batchSize) + 1} with ${batch.length} companies`);
          result.companiesImported += batch.length;
          continue;
        }

        const batchResult = await this.processBatch(batch, options);
        result.companiesImported += batchResult.companiesImported;
        result.foundersImported += batchResult.foundersImported;
        result.jobsImported += batchResult.jobsImported;
        result.errors.push(...batchResult.errors);
        result.warnings.push(...batchResult.warnings);
        result.skipped.push(...batchResult.skipped);

        logInfo(`Processed batch ${Math.floor(i / batchSize) + 1}: ${batchResult.companiesImported} companies, ${batchResult.foundersImported} founders`);
      }

      result.processingTimeMs = Date.now() - startTime;
      result.success = true;

      logInfo(`Apify import completed - Companies: ${result.companiesImported}, Founders: ${result.foundersImported}, Time: ${result.processingTimeMs}ms`);

      return result;

    } catch (error) {
      result.processingTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(errorMessage);
      
      logError('Apify import failed', { error, processingTime: result.processingTimeMs });
      
      return result;
    }
  }

  // =============================================================================
  // Data Processing Methods
  // =============================================================================

  /**
   * Parse and validate JSON content
   */
  private async parseAndValidateJSON(jsonContent: string): Promise<ApifyCompany[]> {
    try {
      const data = JSON.parse(jsonContent);
      
      // Handle both array and single object formats
      const companies = Array.isArray(data) ? data : [data];
      
      // Validate each company
      const validatedCompanies: ApifyCompany[] = [];
      for (let i = 0; i < companies.length; i++) {
        try {
          const company = ApifyCompanySchema.parse(companies[i]);
          validatedCompanies.push(company);
        } catch (error) {
          logWarn(`Skipping invalid company at index ${i}`, { error });
        }
      }

      return validatedCompanies;
    } catch (error) {
      throw new Error(`Invalid JSON format: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process a batch of companies
   */
  private async processBatch(
    companies: ApifyCompany[],
    options: ImportOptions
  ): Promise<Omit<ImportResult, 'success' | 'companiesProcessed' | 'processingTimeMs'>> {
    const result = {
      companiesImported: 0,
      foundersImported: 0,
      jobsImported: 0,
      errors: [] as string[],
      warnings: [] as string[],
      skipped: [] as string[]
    };

    for (const company of companies) {
      try {
        const companyResult = await this.importSingleCompany(company, options);
        
        if (companyResult.imported) {
          result.companiesImported++;
          result.foundersImported += companyResult.foundersImported;
          result.jobsImported += companyResult.jobsImported;
        } else if (companyResult.skipped) {
          result.skipped.push(`${company.company_name}: ${companyResult.reason}`);
        }

        if (companyResult.warnings) {
          result.warnings.push(...companyResult.warnings);
        }
      } catch (error) {
        result.errors.push(`${company.company_name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        logError('Failed to import company', { company: company.company_name, error });
      }
    }

    return result;
  }

  /**
   * Import a single company
   */
  private async importSingleCompany(
    company: ApifyCompany,
    options: ImportOptions
  ): Promise<{
    imported: boolean;
    skipped: boolean;
    reason?: string;
    foundersImported: number;
    jobsImported: number;
    warnings?: string[];
  }> {
    // Check for duplicates if skipDuplicates is enabled
    if (options.skipDuplicates) {
      const existing = await this.supabase
        .from('companies')
        .select('id')
        .eq('yc_api_id', company.company_id)
        .single();

      if (existing.data) {
        return {
          imported: false,
          skipped: true,
          reason: 'Company already exists',
          foundersImported: 0,
          jobsImported: 0
        };
      }
    }

    if (options.dryRun) {
      return {
        imported: true,
        skipped: false,
        foundersImported: company.founders?.length || 0,
        jobsImported: company.open_jobs?.filter(job => job.title).length || 0
      };
    }

    // Transform and insert company
    const companyData = this.transformCompanyData(company);
    
    const { data: insertedCompany, error: companyError } = await this.supabase
      .from('companies')
      .upsert([companyData], {
        onConflict: 'yc_api_id',
        ignoreDuplicates: false
      })
      .select('id')
      .single();

    if (companyError) {
      throw new Error(`Failed to insert company: ${companyError.message}`);
    }

    const companyId = insertedCompany.id;
    let foundersImported = 0;
    let jobsImported = 0;
    const warnings: string[] = [];

    // Import founders
    if (company.founders && company.founders.length > 0) {
      try {
        foundersImported = await this.importFounders(companyId, company.founders);
      } catch (error) {
        warnings.push(`Failed to import founders: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Import jobs
    if (company.open_jobs && company.open_jobs.length > 0) {
      try {
        jobsImported = await this.importJobs(companyId, company.open_jobs);
      } catch (error) {
        warnings.push(`Failed to import jobs: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      imported: true,
      skipped: false,
      foundersImported,
      jobsImported,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  // =============================================================================
  // Data Transformation Methods
  // =============================================================================

  /**
   * Transform Apify company data to database format
   */
  private transformCompanyData(company: ApifyCompany): any {
    // Extract industry information using the new service
    const industryResult = extractIndustry(
      company.tags || [],
      company.short_description || company.long_description || undefined,
      company.company_name
    );

    const allIndustries = extractMultipleIndustries(
      company.tags || [],
      company.short_description || company.long_description || undefined,
      company.company_name
    );

    return {
      yc_api_id: company.company_id,
      name: company.company_name,
      slug: this.generateSlug(company.company_name),
      yc_url: company.url,
      website_url: company.website || null,
      one_liner: company.short_description || null,
      long_description: company.long_description || null,
      batch: company.batch,
      status: this.normalizeStatus(company.status),
      team_size: company.team_size ? parseInt(company.team_size) || null : null,
      launched_at: company.year_founded ? parseInt(company.year_founded) || null : null,
      small_logo_thumb_url: company.company_image || null,
      is_hiring: company.is_hiring || false,
      tags: company.tags || [],
      regions: company.company_location ? [company.company_location] : [],
      industry: industryResult.primaryIndustry,
      industries: allIndustries,
      all_locations: company.company_location || null,
      linkedin_url: company.company_linkedin || null,
      twitter_url: company.company_x || null,
      is_ai_related: this.isAIRelated(company),
      ai_confidence_score: this.calculateAIConfidence(company),
      ai_classification_date: new Date().toISOString(),
      sync_status: 'synced',
      last_sync_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Import jobs for a company
   */
  private async importJobs(companyId: string, jobs: ApifyJob[]): Promise<number> {
    // Filter out null/empty jobs
    const validJobs = jobs.filter(job => job.id && job.title && job.title.trim() !== '');
    
    if (validJobs.length === 0) {
      return 0;
    }

    const jobData = validJobs.map(job => ({
      company_id: companyId,
      title: job.title,
      description: job.description || null,
      location: job.location || null,
      apply_url: job.description_url || null,
      salary: job.salary || null,
      years_experience: job.years_experience || null,
      apify_job_id: job.id,
      is_active: true,
      data_source: 'apify',
      posted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    // First, delete existing jobs for this company to avoid duplicates
    await this.supabase
      .from('company_jobs')
      .delete()
      .eq('company_id', companyId)
      .eq('data_source', 'apify');

    const { error } = await this.supabase
      .from('company_jobs')
      .insert(jobData);

    if (error) {
      throw new Error(`Failed to insert jobs: ${error.message}`);
    }

    return validJobs.length;
  }

  /**
   * Import founders for a company
   */
  private async importFounders(companyId: string, founders: ApifyFounder[]): Promise<number> {
    const founderData = founders.map(founder => ({
      company_id: companyId,
      name: founder.name,
      title: 'Founder', // Default title since not provided in JSON
      linkedin_url: founder.linkedin || null,
      twitter_url: founder.x || null,
      apify_founder_id: founder.id,
      data_source: 'apify',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { error } = await this.supabase
      .from('founders')
      .upsert(founderData, {
        onConflict: 'company_id,name',
        ignoreDuplicates: false
      });

    if (error) {
      throw new Error(`Failed to insert founders: ${error.message}`);
    }

    return founderData.length;
  }

  // =============================================================================
  // Utility Methods
  // =============================================================================

  /**
   * Generate slug from company name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Normalize status values
   */
  private normalizeStatus(status: string): 'Active' | 'Acquired' | 'Public' | 'Inactive' {
    const normalized = status.toLowerCase();
    if (normalized === 'active') return 'Active';
    if (normalized === 'acquired') return 'Acquired';
    if (normalized === 'public') return 'Public';
    return 'Inactive';
  }

  /**
   * Determine if company is AI-related
   */
  private isAIRelated(company: ApifyCompany): boolean {
    const aiKeywords = ['ai', 'artificial intelligence', 'machine learning', 'neural', 'llm', 'gpt', 'agent', 'robotics'];
    const searchText = [
      company.company_name,
      company.short_description || '',
      company.long_description || '',
      ...(company.tags || [])
    ].join(' ').toLowerCase();

    return aiKeywords.some(keyword => searchText.includes(keyword));
  }

  /**
   * Calculate AI confidence score
   */
  private calculateAIConfidence(company: ApifyCompany): number {
    if (!this.isAIRelated(company)) return 0;

    let score = 0.5; // Base score for being detected as AI-related

    // Boost score based on explicit AI mentions
    const searchText = [
      company.company_name,
      company.short_description || '',
      company.long_description || ''
    ].join(' ').toLowerCase();

    if (searchText.includes(' ai ') || searchText.includes('artificial intelligence')) score += 0.3;
    if (searchText.includes('machine learning') || searchText.includes('ml ')) score += 0.2;
    if (company.tags?.some(tag => tag.includes('AI') || tag.includes('ARTIFICIAL'))) score += 0.2;

    return Math.min(score, 1.0);
  }

  /**
   * Clear existing data
   */
  private async clearExistingData(): Promise<void> {
    // Delete in proper order (child tables first)
    await this.supabase.from('company_jobs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await this.supabase.from('founders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await this.supabase.from('company_funding_summary').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await this.supabase.from('github_repositories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await this.supabase.from('github_repository_metrics').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await this.supabase.from('score_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await this.supabase.from('research_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await this.supabase.from('companies').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Create a new JSON import service instance
 */
export function createYCJSONImportService(): YCJSONImportService {
  return new YCJSONImportService();
}

/**
 * Quick import from file path
 */
export async function importYCFromFile(
  filePath: string,
  options: ImportOptions = {}
): Promise<ImportResult> {
  const service = createYCJSONImportService();
  return service.importFromFile(filePath, options);
}

/**
 * Quick import from JSON string
 */
export async function importYCFromJSON(
  jsonContent: string,
  options: ImportOptions = {}
): Promise<ImportResult> {
  const service = createYCJSONImportService();
  return service.importFromJSON(jsonContent, options);
}

// Export default instance
export const ycJSONImportService = createYCJSONImportService();