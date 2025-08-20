#!/usr/bin/env ts-node

/**
 * Simplified Industry Migration Script
 * 
 * Updates existing companies with industry information extracted from tags.
 * Uses direct Supabase service client to avoid Clerk dependencies.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

const { extractIndustry, extractMultipleIndustries } = require('../src/lib/industry-extraction-service');

// Load environment variables
dotenv.config();

interface Company {
  id: string;
  name: string;
  tags: any;
  one_liner?: string;
  long_description?: string;
  industry?: string;
  industries?: string[];
  batch?: string;
}

interface MigrationStats {
  totalCompanies: number;
  processedCompanies: number;
  updatedCompanies: number;
  skippedCompanies: number;
  errors: string[];
  industryDistribution: Record<string, number>;
}

class SimpleMigrationService {
  private supabase;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    this.supabase = createClient(supabaseUrl, serviceRoleKey);
  }

  async migrateIndustries(options: {
    dryRun?: boolean;
    limit?: number;
    onlyMissing?: boolean;
  } = {}): Promise<MigrationStats> {
    const stats: MigrationStats = {
      totalCompanies: 0,
      processedCompanies: 0,
      updatedCompanies: 0,
      skippedCompanies: 0,
      errors: [],
      industryDistribution: {}
    };

    console.log('🚀 Starting Industry Migration');
    console.log('Options:', options);
    console.log('='.repeat(60));

    try {
      // Fetch companies
      let query = this.supabase
        .from('companies')
        .select('id, name, tags, one_liner, long_description, industry, industries, batch');

      if (options.onlyMissing) {
        query = query.or('industry.is.null,industry.eq.');
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data: companies, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch companies: ${error.message}`);
      }

      if (!companies || companies.length === 0) {
        console.log('✅ No companies found to process');
        return stats;
      }

      stats.totalCompanies = companies.length;
      console.log(`Found ${companies.length} companies to process\n`);

      // Process each company
      for (const company of companies) {
        stats.processedCompanies++;
        
        try {
          const result = await this.processCompany(company as Company, options.dryRun || false);
          
          if (result.updated) {
            stats.updatedCompanies++;
            stats.industryDistribution[result.industry!] = 
              (stats.industryDistribution[result.industry!] || 0) + 1;
          } else {
            stats.skippedCompanies++;
          }

          // Progress update every 10 companies
          if (stats.processedCompanies % 10 === 0) {
            console.log(`Progress: ${stats.processedCompanies}/${stats.totalCompanies} processed`);
          }

        } catch (error) {
          const errorMsg = `Error processing ${company.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          stats.errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }

      this.printResults(stats, options);

    } catch (error) {
      const errorMsg = `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      stats.errors.push(errorMsg);
      console.error('❌', errorMsg);
    }

    return stats;
  }

  private async processCompany(company: Company, dryRun: boolean): Promise<{
    updated: boolean;
    industry?: string;
  }> {
    // Parse tags
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

    // Skip if no data to work with
    if (tags.length === 0 && !company.one_liner && !company.long_description) {
      return { updated: false };
    }

    // Extract industry
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

    // Check if update needed
    const needsUpdate = !company.industry || 
      company.industry !== industryResult.primaryIndustry ||
      !company.industries ||
      JSON.stringify(company.industries) !== JSON.stringify(allIndustries);

    if (!needsUpdate) {
      return { updated: false };
    }

    console.log(`  📝 ${company.name}: ${company.industry || 'N/A'} → ${industryResult.primaryIndustry} (${(industryResult.confidence * 100).toFixed(0)}%)`);

    // Update database if not dry run
    if (!dryRun) {
      const { error } = await this.supabase
        .from('companies')
        .update({
          industry: industryResult.primaryIndustry,
          industries: allIndustries,
          updated_at: new Date().toISOString()
        })
        .eq('id', company.id);

      if (error) {
        throw new Error(`Database update failed: ${error.message}`);
      }
    }

    return { 
      updated: true, 
      industry: industryResult.primaryIndustry 
    };
  }

  private printResults(stats: MigrationStats, options: any) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Results');
    console.log('='.repeat(60));
    
    console.log(`Total Companies: ${stats.totalCompanies}`);
    console.log(`Processed: ${stats.processedCompanies}`);
    console.log(`Updated: ${stats.updatedCompanies}`);
    console.log(`Skipped: ${stats.skippedCompanies}`);
    console.log(`Errors: ${stats.errors.length}`);

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
  const options = {
    dryRun: args.includes('--dry-run'),
    limit: parseInt(args.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '0') || undefined,
    onlyMissing: args.includes('--only-missing')
  };

  if (args.includes('--help')) {
    console.log(`
Simplified Industry Migration Script

Usage: npx ts-node scripts/migrate-company-industries-simple.ts [options]

Options:
  --dry-run      Run without making database changes
  --limit=N      Only process first N companies
  --only-missing Only update companies without industry info
  --help         Show this help message

Examples:
  # Dry run with 10 companies
  npx ts-node scripts/migrate-company-industries-simple.ts --dry-run --limit=10

  # Update only companies missing industry info
  npx ts-node scripts/migrate-company-industries-simple.ts --only-missing

  # Full migration (use with caution!)
  npx ts-node scripts/migrate-company-industries-simple.ts
    `);
    process.exit(0);
  }

  try {
    const service = new SimpleMigrationService();
    const stats = await service.migrateIndustries(options);
    process.exit(stats.errors.length === 0 ? 0 : 1);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}