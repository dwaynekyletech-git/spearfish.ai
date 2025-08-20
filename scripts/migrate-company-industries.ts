#!/usr/bin/env ts-node

/**
 * Industry Migration Script
 * 
 * Updates existing companies in the database with industry information
 * extracted from their tags and descriptions using the new industry
 * extraction service.
 * 
 * Features:
 * - Batch processing for large datasets
 * - Progress tracking and error handling
 * - Dry-run mode for testing
 * - Statistics and reporting
 */

const { createServiceClient } = require('../src/lib/supabase-server');
const { extractIndustry, extractMultipleIndustries } = require('../src/lib/industry-extraction-service');

interface MigrationOptions {
  dryRun?: boolean;
  batchSize?: number;
  onlyMissingIndustries?: boolean;
  filterBatches?: string[];
  limit?: number;
}

interface MigrationStats {
  totalCompanies: number;
  processedCompanies: number;
  updatedCompanies: number;
  skippedCompanies: number;
  errors: string[];
  industryDistribution: Record<string, number>;
  processingTimeMs: number;
}

class IndustryMigrationService {
  private supabase;

  constructor() {
    this.supabase = createServiceClient();
  }

  /**
   * Run the industry migration
   */
  async migrate(options: MigrationOptions = {}): Promise<MigrationStats> {
    const startTime = Date.now();
    const stats: MigrationStats = {
      totalCompanies: 0,
      processedCompanies: 0,
      updatedCompanies: 0,
      skippedCompanies: 0,
      errors: [],
      industryDistribution: {},
      processingTimeMs: 0
    };

    console.log('🚀 Starting Industry Migration');
    console.log('Options:', options);
    console.log('='.repeat(60));

    try {
      // Get companies that need industry updates
      const companies = await this.getCompaniesToUpdate(options);
      stats.totalCompanies = companies.length;

      console.log(`Found ${companies.length} companies to process\n`);

      if (companies.length === 0) {
        console.log('✅ No companies need industry updates');
        return stats;
      }

      // Process companies in batches
      const batchSize = options.batchSize || 50;
      for (let i = 0; i < companies.length; i += batchSize) {
        const batch = companies.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(companies.length / batchSize)} (${batch.length} companies)`);

        const batchStats = await this.processBatch(batch, options);
        
        stats.processedCompanies += batchStats.processed;
        stats.updatedCompanies += batchStats.updated;
        stats.skippedCompanies += batchStats.skipped;
        stats.errors.push(...batchStats.errors);

        // Update industry distribution
        Object.entries(batchStats.industryDistribution).forEach(([industry, count]) => {
          stats.industryDistribution[industry] = (stats.industryDistribution[industry] || 0) + count;
        });

        // Progress update
        const progress = Math.round((stats.processedCompanies / stats.totalCompanies) * 100);
        console.log(`Progress: ${progress}% (${stats.processedCompanies}/${stats.totalCompanies})\n`);
      }

      stats.processingTimeMs = Date.now() - startTime;
      this.printResults(stats, options);

    } catch (error) {
      stats.errors.push(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('❌ Migration failed:', error);
    }

    return stats;
  }

  /**
   * Get companies that need industry updates
   */
  private async getCompaniesToUpdate(options: MigrationOptions): Promise<any[]> {
    let query = this.supabase
      .from('companies')
      .select('id, name, tags, one_liner, long_description, industry, industries, batch');

    // Filter conditions
    if (options.onlyMissingIndustries) {
      query = query.or('industry.is.null,industry.eq.,industries.is.null');
    }

    if (options.filterBatches && options.filterBatches.length > 0) {
      query = query.in('batch', options.filterBatches);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch companies: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Process a batch of companies
   */
  private async processBatch(companies: any[], options: MigrationOptions): Promise<{
    processed: number;
    updated: number;
    skipped: number;
    errors: string[];
    industryDistribution: Record<string, number>;
  }> {
    const result = {
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
      industryDistribution: {} as Record<string, number>
    };

    for (const company of companies) {
      try {
        result.processed++;

        // Parse tags if they're JSON string
        let tags: string[] = [];
        if (company.tags) {
          if (Array.isArray(company.tags)) {
            tags = company.tags;
          } else if (typeof company.tags === 'string') {
            try {
              tags = JSON.parse(company.tags);
            } catch (e) {
              tags = [];
            }
          }
        }

        // Skip if no tags and no description
        if (tags.length === 0 && !company.one_liner && !company.long_description) {
          result.skipped++;
          continue;
        }

        // Extract industry information
        const industryResult = extractIndustry(
          tags,
          company.one_liner || company.long_description,
          company.name
        );

        const allIndustries = extractMultipleIndustries(
          tags,
          company.one_liner || company.long_description,
          company.name
        );

        // Check if update is needed
        const needsUpdate = !company.industry || 
          company.industry !== industryResult.primaryIndustry ||
          !company.industries ||
          JSON.stringify(company.industries) !== JSON.stringify(allIndustries);

        if (!needsUpdate) {
          result.skipped++;
          continue;
        }

        console.log(`  📝 ${company.name}: ${company.industry || 'N/A'} → ${industryResult.primaryIndustry} (${(industryResult.confidence * 100).toFixed(0)}%)`);

        // Update industry distribution
        result.industryDistribution[industryResult.primaryIndustry] = 
          (result.industryDistribution[industryResult.primaryIndustry] || 0) + 1;

        // Update database (if not dry run)
        if (!options.dryRun) {
          const { error } = await this.supabase
            .from('companies')
            .update({
              industry: industryResult.primaryIndustry,
              industries: allIndustries,
              updated_at: new Date().toISOString()
            })
            .eq('id', company.id);

          if (error) {
            result.errors.push(`Failed to update ${company.name}: ${error.message}`);
            continue;
          }
        }

        result.updated++;

      } catch (error) {
        result.errors.push(`Error processing ${company.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return result;
  }

  /**
   * Print migration results
   */
  private printResults(stats: MigrationStats, options: MigrationOptions) {
    console.log('='.repeat(60));
    console.log('📊 Migration Results');
    console.log('='.repeat(60));
    
    console.log(`Total Companies: ${stats.totalCompanies}`);
    console.log(`Processed: ${stats.processedCompanies}`);
    console.log(`Updated: ${stats.updatedCompanies}`);
    console.log(`Skipped: ${stats.skippedCompanies}`);
    console.log(`Errors: ${stats.errors.length}`);
    console.log(`Processing Time: ${(stats.processingTimeMs / 1000).toFixed(2)}s`);

    if (options.dryRun) {
      console.log('\n⚠️  DRY RUN - No changes were made to the database');
    }

    console.log('\n📈 Industry Distribution:');
    Object.entries(stats.industryDistribution)
      .sort(([,a], [,b]) => b - a)
      .forEach(([industry, count]) => {
        console.log(`  ${industry}: ${count} companies`);
      });

    if (stats.errors.length > 0) {
      console.log('\n❌ Errors:');
      stats.errors.forEach(error => console.log(`  ${error}`));
    }

    console.log(`\n${stats.errors.length === 0 ? '✅' : '⚠️'} Migration completed`);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options: MigrationOptions = {
    dryRun: args.includes('--dry-run'),
    batchSize: parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '50'),
    onlyMissingIndustries: args.includes('--only-missing'),
    limit: parseInt(args.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '0') || undefined
  };

  // Parse batch filter
  const batchArg = args.find(arg => arg.startsWith('--batches='));
  if (batchArg) {
    options.filterBatches = batchArg.split('=')[1].split(',');
  }

  if (args.includes('--help')) {
    console.log(`
Industry Migration Script

Usage: npx ts-node scripts/migrate-company-industries.ts [options]

Options:
  --dry-run              Run without making database changes
  --batch-size=N         Process N companies at a time (default: 50)
  --only-missing         Only update companies without industry info
  --batches=W23,S23      Only process specific batches
  --limit=N              Only process first N companies
  --help                 Show this help message

Examples:
  # Dry run to see what would be updated
  npx ts-node scripts/migrate-company-industries.ts --dry-run

  # Update only companies missing industry info
  npx ts-node scripts/migrate-company-industries.ts --only-missing

  # Update specific batches
  npx ts-node scripts/migrate-company-industries.ts --batches=W23,S23

  # Test with small batch
  npx ts-node scripts/migrate-company-industries.ts --dry-run --limit=10
    `);
    process.exit(0);
  }

  const service = new IndustryMigrationService();
  const stats = await service.migrate(options);

  process.exit(stats.errors.length === 0 ? 0 : 1);
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}