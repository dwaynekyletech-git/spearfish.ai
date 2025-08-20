#!/usr/bin/env tsx

/**
 * AI Company Discovery and Enrichment Script
 * 
 * DEPRECATED: This script used Apify integration which has been removed.
 * Company data is now imported via manual JSON files using the import-yc-json CLI.
 * 
 * NEW APPROACH: Use npm run import:yc -- --file your-dataset.json
 * 
 * OLD Usage (no longer works):
 *   npm run script:discover-ai-companies [options]
 * 
 * Options:
 *   --tier <1|2|3>          Only process specific tier of AI companies
 *   --batch <batch>         Only process companies from specific YC batch
 *   --limit <number>        Limit number of companies to process
 *   --dry-run              Show what would be processed without executing
 *   --force                Force re-enrichment of already processed companies
 *   --cost-limit <number>   Maximum cost to spend in USD (default: 15)
 * 
 * Examples:
 *   npm run script:discover-ai-companies --tier 1 --limit 50
 *   npm run script:discover-ai-companies --batch W24 --dry-run
 *   npm run script:discover-ai-companies --cost-limit 10
 */

// DEPRECATED: All imports below are for deleted services
// import { createServiceClient } from '../src/lib/supabase-server';
// import { createYCClient, YCCompany } from '../src/lib/yc-api';
// import { createApifyYCService, ApifyCompanyData } from '../src/lib/apify-yc-service';
// import { AICompanyDetector, AIDetectionResult } from '../src/lib/ai-company-detector';
// import { ApifyDataMapper } from '../src/lib/apify-data-mapper';
// import { logInfo, logWarn, logError, logDebug } from '../src/lib/logger';

console.log('DEPRECATED: This script has been deprecated. Use npm run import:yc -- --file your-dataset.json instead.');
process.exit(1);

// =============================================================================
// Types and Interfaces
// =============================================================================

interface ScriptOptions {
  tier?: '1' | '2' | '3';
  batch?: string;
  limit?: number;
  dryRun?: boolean;
  force?: boolean;
  costLimit?: number;
}

interface DiscoveryResult {
  totalCompanies: number;
  aiCompaniesFound: number;
  companiesEnriched: number;
  companiesSkipped: number;
  totalCost: number;
  errors: string[];
  stats: {
    tier1: number;
    tier2: number;
    tier3: number;
    averageConfidence: number;
  };
}

interface EnrichmentCandidate {
  company: YCCompany;
  detection: AIDetectionResult;
  databaseId?: string;
  needsEnrichment: boolean;
  reason: string;
}

// =============================================================================
// Script Configuration
// =============================================================================

const DEFAULT_OPTIONS: Required<ScriptOptions> = {
  tier: undefined as any,
  batch: undefined as any,
  limit: 1000,
  dryRun: false,
  force: false,
  costLimit: 15
};

// =============================================================================
// Main Discovery Class
// =============================================================================

class AICompanyDiscovery {
  private supabase: any;
  private ycClient: any;
  private apifyService: any;
  private options: Required<ScriptOptions>;

  constructor(options: ScriptOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.supabase = createServiceClient();
    this.ycClient = createYCClient();
    this.apifyService = createApifyYCService();
  }

  /**
   * Main discovery and enrichment process
   */
  async run(): Promise<DiscoveryResult> {
    const startTime = Date.now();
    
    try {
      logInfo('Starting AI company discovery and enrichment', { options: this.options });

      // Step 1: Get companies from YC API
      const ycCompanies = await this.fetchYCCompanies();
      logInfo(`Fetched ${ycCompanies.length} companies from Y Combinator`);

      // Step 2: Detect AI companies
      const { aiCompanies, stats } = AICompanyDetector.analyzeCompanies(ycCompanies);
      logInfo(`Detected ${aiCompanies.length} AI companies`, { stats });

      // Step 3: Filter by tier if specified
      const filteredCompanies = this.filterByTier(aiCompanies);
      logInfo(`After tier filtering: ${filteredCompanies.length} companies`);

      // Step 4: Check which companies need enrichment
      const candidates = await this.identifyEnrichmentCandidates(filteredCompanies);
      logInfo(`Identified ${candidates.filter(c => c.needsEnrichment).length} companies needing enrichment`);

      // Step 5: Cost estimation and budget check
      const needEnrichment = candidates.filter(c => c.needsEnrichment);
      const estimatedCost = this.apifyService.estimateCost(needEnrichment.length);
      
      if (estimatedCost > this.options.costLimit) {
        logWarn(`Estimated cost $${estimatedCost} exceeds limit $${this.options.costLimit}`);
        // Trim candidates to fit budget
        const maxCompanies = Math.floor(this.options.costLimit / 0.015);
        needEnrichment.splice(maxCompanies);
        logInfo(`Reduced to ${needEnrichment.length} companies to stay within budget`);
      }

      if (this.options.dryRun) {
        return this.generateDryRunResult(candidates, stats);
      }

      // Step 6: Perform enrichment
      const enrichmentResults = await this.enrichCompanies(needEnrichment);

      // Step 7: Generate final results
      const result: DiscoveryResult = {
        totalCompanies: ycCompanies.length,
        aiCompaniesFound: aiCompanies.length,
        companiesEnriched: enrichmentResults.successful,
        companiesSkipped: candidates.filter(c => !c.needsEnrichment).length,
        totalCost: enrichmentResults.totalCost,
        errors: enrichmentResults.errors,
        stats
      };

      const duration = Date.now() - startTime;
      logInfo('AI company discovery completed', { 
        ...result, 
        durationMs: duration,
        costPerCompany: result.totalCost / Math.max(1, result.companiesEnriched)
      });

      return result;

    } catch (error) {
      logError('AI company discovery failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Fetch companies from Y Combinator API
   */
  private async fetchYCCompanies(): Promise<YCCompany[]> {
    try {
      if (this.options.batch) {
        logInfo(`Fetching companies from batch: ${this.options.batch}`);
        return await this.ycClient.getCompaniesByBatch(this.options.batch);
      } else {
        logInfo('Fetching AI potential companies from all batches');
        return await this.ycClient.getAIPotentialCompanies();
      }
    } catch (error) {
      logError('Failed to fetch YC companies', { error });
      throw new Error(`Failed to fetch companies: ${error}`);
    }
  }

  /**
   * Filter companies by specified tier
   */
  private filterByTier(aiCompanies: (YCCompany & { aiDetection: AIDetectionResult })[]): typeof aiCompanies {
    if (!this.options.tier) {
      return aiCompanies.slice(0, this.options.limit);
    }

    const tierKey = `TIER_${this.options.tier}` as const;
    const filtered = aiCompanies
      .filter(company => company.aiDetection.tier === tierKey)
      .slice(0, this.options.limit);

    logInfo(`Filtered to ${filtered.length} companies in tier ${this.options.tier}`);
    return filtered;
  }

  /**
   * Identify which companies need enrichment
   */
  private async identifyEnrichmentCandidates(
    aiCompanies: (YCCompany & { aiDetection: AIDetectionResult })[]
  ): Promise<EnrichmentCandidate[]> {
    const candidates: EnrichmentCandidate[] = [];

    for (const aiCompany of aiCompanies) {
      try {
        // Check if company exists in database
        const { data: existingCompany } = await this.supabase
          .from('companies')
          .select('id, name, apify_scraped_at, enrichment_status')
          .or(`name.eq.${aiCompany.name},yc_id.eq.${aiCompany.id}`)
          .single();

        let needsEnrichment = false;
        let reason = '';

        if (!existingCompany) {
          needsEnrichment = true;
          reason = 'Company not in database';
        } else if (this.options.force) {
          needsEnrichment = true;
          reason = 'Force enrichment requested';
        } else if (!existingCompany.apify_scraped_at) {
          needsEnrichment = true;
          reason = 'Never enriched with Apify';
        } else if (existingCompany.enrichment_status === 'failed') {
          const failedAt = new Date(existingCompany.apify_scraped_at);
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          if (failedAt < oneDayAgo) {
            needsEnrichment = true;
            reason = 'Previous enrichment failed, retrying';
          }
        } else if (existingCompany.apify_scraped_at) {
          const scrapedAt = new Date(existingCompany.apify_scraped_at);
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          if (scrapedAt < thirtyDaysAgo) {
            needsEnrichment = true;
            reason = 'Data is stale (>30 days old)';
          }
        }

        if (!needsEnrichment) {
          reason = 'Already enriched and fresh';
        }

        candidates.push({
          company: aiCompany,
          detection: aiCompany.aiDetection,
          databaseId: existingCompany?.id,
          needsEnrichment,
          reason
        });

      } catch (error) {
        logWarn(`Error checking enrichment status for ${aiCompany.name}`, { error });
        // Default to needing enrichment if we can't check status
        candidates.push({
          company: aiCompany,
          detection: aiCompany.aiDetection,
          needsEnrichment: true,
          reason: 'Error checking status, defaulting to enrich'
        });
      }
    }

    return candidates;
  }

  /**
   * Enrich companies with Apify data
   */
  private async enrichCompanies(candidates: EnrichmentCandidate[]): Promise<{
    successful: number;
    failed: number;
    totalCost: number;
    errors: string[];
  }> {
    let successful = 0;
    let failed = 0;
    let totalCost = 0;
    const errors: string[] = [];

    // Sort by priority for optimal processing order
    const sortedCandidates = candidates
      .sort((a, b) => b.detection.priority - a.detection.priority);

    logInfo(`Starting enrichment of ${sortedCandidates.length} companies`);

    // Process in batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < sortedCandidates.length; i += batchSize) {
      const batch = sortedCandidates.slice(i, i + batchSize);
      
      logInfo(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(sortedCandidates.length / batchSize)}`);

      // Create YC URLs for this batch
      const companyUrls = batch.map(candidate => 
        candidate.company.url || `https://www.ycombinator.com/companies/${candidate.company.slug}`
      );

      try {
        // Enrich via Apify
        const result = await this.apifyService.scrapeCompaniesByUrls(companyUrls);
        totalCost += result.totalCost;

        // Process successful results
        for (let j = 0; j < result.success.length; j++) {
          const apifyData = result.success[j];
          const candidate = batch[j];

          try {
            await this.saveEnrichedData(apifyData, candidate);
            successful++;
            logInfo(`Enriched ${apifyData.name}`, { 
              founders: apifyData.founders?.length || 0,
              jobs: apifyData.jobs?.length || 0
            });
          } catch (saveError) {
            failed++;
            const errorMsg = `Failed to save ${apifyData.name}: ${saveError}`;
            errors.push(errorMsg);
            logError(errorMsg);
          }
        }

        // Track failed results
        for (const error of result.errors) {
          failed++;
          errors.push(error.error);
          logError('Apify enrichment error', { error: error.error });
        }

        // Rate limiting delay between batches
        if (i + batchSize < sortedCandidates.length) {
          logDebug('Waiting between batches to respect rate limits');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }

      } catch (batchError) {
        failed += batch.length;
        const errorMsg = `Batch enrichment failed: ${batchError}`;
        errors.push(errorMsg);
        logError(errorMsg);
      }
    }

    return { successful, failed, totalCost, errors };
  }

  /**
   * Save enriched data to database
   */
  private async saveEnrichedData(apifyData: ApifyCompanyData, candidate: EnrichmentCandidate): Promise<void> {
    try {
      // Map Apify data to database format
      const mapped = ApifyDataMapper.mapCompleteResponse(apifyData, candidate.databaseId);

      // Upsert company data
      const { data: savedCompany, error: companyError } = await this.supabase
        .from('companies')
        .upsert({
          ...mapped.company,
          // Preserve existing ID if available
          ...(candidate.databaseId && { id: candidate.databaseId })
        }, {
          onConflict: candidate.databaseId ? 'id' : 'yc_id',
          ignoreDuplicates: false
        })
        .select('id')
        .single();

      if (companyError) {
        throw new Error(`Company upsert failed: ${companyError.message}`);
      }

      const companyId = savedCompany.id;

      // Save founders
      if (mapped.founders.length > 0) {
        // Delete existing Apify founders to avoid duplicates
        await this.supabase
          .from('founders')
          .delete()
          .eq('company_id', companyId)
          .eq('data_source', 'apify');

        // Insert new founders
        const { error: foundersError } = await this.supabase
          .from('founders')
          .insert(mapped.founders.map(f => ({ ...f, company_id: companyId })));

        if (foundersError) {
          logWarn(`Failed to save founders for ${apifyData.name}`, { error: foundersError });
        }
      }

      // Save jobs
      if (mapped.jobs.length > 0) {
        // Delete existing jobs to avoid duplicates
        await this.supabase
          .from('company_jobs')
          .delete()
          .eq('company_id', companyId)
          .eq('data_source', 'apify');

        // Insert new jobs
        const { error: jobsError } = await this.supabase
          .from('company_jobs')
          .insert(mapped.jobs.map(j => ({ ...j, company_id: companyId })));

        if (jobsError) {
          logWarn(`Failed to save jobs for ${apifyData.name}`, { error: jobsError });
        }
      }

    } catch (error) {
      logError(`Failed to save enriched data for ${apifyData.name}`, { error });
      throw error;
    }
  }

  /**
   * Generate dry run results without executing enrichment
   */
  private generateDryRunResult(candidates: EnrichmentCandidate[], stats: any): DiscoveryResult {
    const needEnrichment = candidates.filter(c => c.needsEnrichment);
    const estimatedCost = this.apifyService.estimateCost(needEnrichment.length);

    logInfo('DRY RUN RESULTS', {
      totalCandidates: candidates.length,
      needEnrichment: needEnrichment.length,
      estimatedCost,
      candidatesByReason: this.groupCandidatesByReason(candidates)
    });

    return {
      totalCompanies: candidates.length,
      aiCompaniesFound: candidates.length,
      companiesEnriched: 0, // Dry run, no actual enrichment
      companiesSkipped: candidates.filter(c => !c.needsEnrichment).length,
      totalCost: 0, // Dry run, no actual cost
      errors: [],
      stats
    };
  }

  /**
   * Group candidates by enrichment reason for reporting
   */
  private groupCandidatesByReason(candidates: EnrichmentCandidate[]): Record<string, number> {
    return candidates.reduce((acc, candidate) => {
      acc[candidate.reason] = (acc[candidate.reason] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}

// =============================================================================
// CLI Argument Parsing
// =============================================================================

function parseArguments(): ScriptOptions {
  const args = process.argv.slice(2);
  const options: ScriptOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--tier':
        if (nextArg && ['1', '2', '3'].includes(nextArg)) {
          options.tier = nextArg as '1' | '2' | '3';
          i++;
        }
        break;
      case '--batch':
        if (nextArg) {
          options.batch = nextArg;
          i++;
        }
        break;
      case '--limit':
        if (nextArg && !isNaN(parseInt(nextArg))) {
          options.limit = parseInt(nextArg);
          i++;
        }
        break;
      case '--cost-limit':
        if (nextArg && !isNaN(parseFloat(nextArg))) {
          options.costLimit = parseFloat(nextArg);
          i++;
        }
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--force':
        options.force = true;
        break;
      case '--help':
        console.log(`
AI Company Discovery and Enrichment Script

Usage: npm run script:discover-ai-companies [options]

Options:
  --tier <1|2|3>          Only process specific tier of AI companies
  --batch <batch>         Only process companies from specific YC batch  
  --limit <number>        Limit number of companies to process
  --dry-run              Show what would be processed without executing
  --force                Force re-enrichment of already processed companies
  --cost-limit <number>   Maximum cost to spend in USD (default: 15)
  --help                 Show this help message

Examples:
  npm run script:discover-ai-companies --tier 1 --limit 50
  npm run script:discover-ai-companies --batch W24 --dry-run
  npm run script:discover-ai-companies --cost-limit 10
        `);
        process.exit(0);
    }
  }

  return options;
}

// =============================================================================
// Main Execution
// =============================================================================

async function main() {
  try {
    const options = parseArguments();
    const discovery = new AICompanyDiscovery(options);
    const result = await discovery.run();

    console.log('\n=== DISCOVERY RESULTS ===');
    console.log(`Total YC companies analyzed: ${result.totalCompanies}`);
    console.log(`AI companies found: ${result.aiCompaniesFound}`);
    console.log(`Companies enriched: ${result.companiesEnriched}`);
    console.log(`Companies skipped: ${result.companiesSkipped}`);
    console.log(`Total cost: $${result.totalCost.toFixed(2)}`);
    
    if (result.errors.length > 0) {
      console.log(`\nErrors (${result.errors.length}):`);
      result.errors.forEach(error => console.log(`  - ${error}`));
    }

    console.log(`\nAI Company Distribution:`);
    console.log(`  Tier 1 (Core AI): ${result.stats.tier1}`);
    console.log(`  Tier 2 (AI Infrastructure): ${result.stats.tier2}`);
    console.log(`  Tier 3 (AI-enabled): ${result.stats.tier3}`);
    console.log(`  Average confidence: ${result.stats.averageConfidence.toFixed(2)}`);

    process.exit(0);

  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  main();
}

export { AICompanyDiscovery, type ScriptOptions, type DiscoveryResult };