#!/usr/bin/env ts-node

/**
 * Y Combinator JSON Import CLI
 * 
 * Command-line interface for importing YC company data from Apify JSON exports.
 * 
 * Usage:
 *   npm run import:yc -- --file dataset.json
 *   npm run import:yc -- --file dataset.json --clear-existing
 *   npm run import:yc -- --file dataset.json --dry-run
 *   npm run import:yc -- --directory ./datasets --clear-existing
 * 
 * Options:
 *   --file              Path to JSON file to import
 *   --directory         Directory containing JSON files to import
 *   --clear-existing    Clear all existing company data before import
 *   --dry-run          Simulate import without making changes
 *   --skip-duplicates  Skip companies that already exist
 *   --batch-size       Number of companies to process in each batch (default: 10)
 *   --verbose          Enable verbose logging
 *   --help             Show this help message
 */

import path from 'path';
import fs from 'fs/promises';

// Load environment variables from .env.local FIRST, before importing other modules
async function loadEnvironmentVariables() {
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    const envContent = await fs.readFile(envPath, 'utf-8');
    
    // Parse and set environment variables
    envContent.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          if (value && !process.env[key]) {
            process.env[key] = value.replace(/^['"](.*)['"]$/, '$1'); // Remove quotes
          }
        }
      }
    });
  } catch (error) {
    // .env.local doesn't exist, that's OK
  }
}

// Import types for TypeScript
import type { ImportOptions, ImportResult } from '../src/lib/yc-json-import-service';

// =============================================================================
// Simple CLI Argument Parser
// =============================================================================

interface CLIOptions {
  file?: string;
  directory?: string;
  source: 'file' | 'apify' | 'oss';
  datasetId?: string;
  actorId?: string;
  runActor: boolean;
  clearExisting: boolean;
  dryRun: boolean;
  skipDuplicates: boolean;
  batchSize: number;
  classifyAI: boolean;
  aiOnly: boolean;
  confidenceThreshold?: number;
  maxCompanies?: number;
  verbose: boolean;
  help: boolean;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {
    source: 'file', // Default to file source for backward compatibility
    runActor: false,
    clearExisting: false,
    dryRun: false,
    skipDuplicates: false,
    batchSize: 10,
    classifyAI: false,
    aiOnly: false,
    verbose: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--file':
        options.file = args[++i];
        options.source = 'file';
        break;
      case '--directory':
        options.directory = args[++i];
        options.source = 'file';
        break;
      case '--source':
        const source = args[++i];
        if (source === 'file' || source === 'apify' || source === 'oss') {
          options.source = source;
        } else {
          throw new Error('Invalid source. Use "file", "apify", or "oss"');
        }
        break;
      case '--dataset-id':
        options.datasetId = args[++i];
        options.source = 'apify';
        break;
      case '--actor-id':
        options.actorId = args[++i];
        options.source = 'apify';
        break;
      case '--run-actor':
        options.runActor = true;
        options.source = 'apify';
        break;
      case '--clear-existing':
        options.clearExisting = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--skip-duplicates':
        options.skipDuplicates = true;
        break;
      case '--batch-size':
        options.batchSize = parseInt(args[++i]) || 10;
        break;
      case '--classify-ai':
        options.classifyAI = true;
        break;
      case '--ai-only':
        options.aiOnly = true;
        options.classifyAI = true; // Auto-enable classification
        break;
      case '--confidence-threshold':
        options.confidenceThreshold = parseFloat(args[++i]);
        break;
      case '--max-companies':
        options.maxCompanies = parseInt(args[++i]);
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--help':
        options.help = true;
        break;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
Y Combinator JSON Import CLI

Usage (File-based):
  npm run import:yc -- --file dataset.json
  npm run import:yc -- --file dataset.json --clear-existing
  npm run import:yc -- --directory ./datasets --clear-existing

Usage (YC OSS API):
  npm run import:yc -- --source oss
  npm run import:yc -- --source oss --classify-ai --ai-only
  npm run import:yc -- --source oss --clear-existing --classify-ai --confidence-threshold 0.7
  npm run import:yc -- --source oss --max-companies 100 --dry-run

Usage (Apify-based):
  npm run import:yc -- --source apify
  npm run import:yc -- --source apify --dataset-id YOUR_DATASET_ID
  npm run import:yc -- --source apify --actor-id YOUR_ACTOR_ID --run-actor
  npm run import:yc -- --dataset-id YOUR_DATASET_ID --dry-run

File Import Options:
  --file              Path to JSON file to import
  --directory         Directory containing JSON files to import

YC OSS API Options:
  --source oss        Use YC OSS API (5,402+ companies)
  --classify-ai       Run AI classification on companies
  --ai-only          Only import AI-classified companies (auto-enables --classify-ai)
  --confidence-threshold Minimum AI confidence score (0.0-1.0)
  --max-companies     Limit number of companies for testing

Apify Import Options:
  --source            Data source: "file", "apify", or "oss" (default: file)
  --dataset-id        Specific Apify dataset ID to fetch data from
  --actor-id          Specific Apify actor ID to use (uses env default if not provided)
  --run-actor         Run the actor first to get fresh data before importing

General Options:
  --clear-existing    Clear all existing company data before import
  --dry-run          Simulate import without making changes
  --skip-duplicates  Skip companies that already exist
  --batch-size       Number of companies to process in each batch (default: 10/50 for OSS)
  --verbose          Enable verbose logging
  --help             Show this help message

Environment Variables (for Apify):
  APIFY_API_TOKEN     Your Apify API token (required for Apify imports)
  APIFY_ACTOR_ID      Default actor ID for Y Combinator scraper
  APIFY_DATASET_ID    Default dataset ID to fetch from

Examples:
  # File imports
  npm run import:yc -- --file dataset_y-combinator-scraper_2025-08-19_21-32-40-154.json
  npm run import:yc -- --directory ./datasets --clear-existing --verbose

  # YC OSS API imports (recommended)
  npm run import:yc -- --source oss --classify-ai --ai-only --clear-existing
  npm run import:yc -- --source oss --max-companies 100 --dry-run --verbose
  npm run import:yc -- --source oss --confidence-threshold 0.8 --classify-ai

  # Apify imports
  npm run import:yc -- --source apify --verbose
  npm run import:yc -- --dataset-id abc123 --clear-existing
  npm run import:yc -- --actor-id your-actor --run-actor --dry-run
`);
}

// =============================================================================
// Simple Console Colors
// =============================================================================

const colors = {
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  gray: (text: string) => `\x1b[90m${text}\x1b[0m`
};

// =============================================================================
// Main Function
// =============================================================================

async function main() {
  try {
    // Load environment variables first
    await loadEnvironmentVariables();
    
    const options = parseArgs();

    // Show help if requested or no valid source provided
    if (options.help || (options.source === 'file' && !options.file && !options.directory) || (options.source === 'apify' && !process.env.APIFY_API_TOKEN)) {
      if (options.source === 'apify' && !process.env.APIFY_API_TOKEN) {
        console.log(colors.red('❌ APIFY_API_TOKEN environment variable is required for Apify imports\n'));
      }
      showHelp();
      return;
    }

    // Validate environment
    await validateEnvironment(options.source);

    // Configure import options
    const importOptions: ImportOptions = {
      clearExisting: options.clearExisting || false,
      dryRun: options.dryRun || false,
      skipDuplicates: options.skipDuplicates || false,
      batchSize: options.batchSize || 10,
      validateUrls: true
    };

    console.log(colors.blue('🚀 Starting Y Combinator JSON Import\n'));

    if (options.verbose) {
      console.log(colors.gray('Import Options:'));
      console.log(colors.gray(`  Clear Existing: ${importOptions.clearExisting}`));
      console.log(colors.gray(`  Dry Run: ${importOptions.dryRun}`));
      console.log(colors.gray(`  Skip Duplicates: ${importOptions.skipDuplicates}`));
      console.log(colors.gray(`  Batch Size: ${importOptions.batchSize}\n`));
    }

    // Initialize results
    let totalResults: ImportResult = {
      success: true,
      companiesProcessed: 0,
      companiesImported: 0,
      foundersImported: 0,
      jobsImported: 0,
      errors: [],
      warnings: [],
      skipped: [],
      processingTimeMs: 0
    };

    // Clear existing data if requested (only once, before processing)
    if (importOptions.clearExisting && !importOptions.dryRun) {
      await clearExistingData(options.verbose);
      // Don't clear again for subsequent operations
      importOptions.clearExisting = false;
    }

    // Process based on source type
    const { createYCJSONImportService } = await import('../src/lib/yc-json-import-service');
    const importService = createYCJSONImportService();

    if (options.source === 'apify') {
      // Process data from Apify
      console.log(colors.blue('🔗 Fetching data from Apify...\n'));
      
      if (options.verbose) {
        console.log(colors.gray('Apify Options:'));
        if (options.datasetId) console.log(colors.gray(`  Dataset ID: ${options.datasetId}`));
        if (options.actorId) console.log(colors.gray(`  Actor ID: ${options.actorId}`));
        console.log(colors.gray(`  Run Actor: ${options.runActor}`));
        console.log('');
      }

      const apifyOptions = {
        ...importOptions,
        datasetId: options.datasetId,
        actorId: options.actorId,
        runActor: options.runActor,
        apifyOptions: {
          limit: 10000, // Default limit for large datasets
          clean: true   // Default to clean items
        }
      };

      const result = await importService.importFromApify(apifyOptions);
      totalResults = result;

      // Show results
      if (result.success) {
        console.log(colors.green(`✅ Apify import successful!`));
        console.log(colors.green(`   Companies: ${result.companiesImported}, Founders: ${result.foundersImported}, Jobs: ${result.jobsImported}`));
      } else {
        console.log(colors.red(`❌ Apify import failed: ${result.errors.length} errors`));
        if (options.verbose) {
          result.errors.forEach(error => console.log(colors.red(`   Error: ${error}`)));
        }
      }
      
    } else if (options.source === 'oss') {
      // Process data from YC OSS API
      console.log(colors.blue('🔗 Fetching data from YC OSS API...\n'));
      
      if (options.verbose) {
        console.log(colors.gray('YC OSS Options:'));
        console.log(colors.gray(`  Classify AI: ${options.classifyAI}`));
        console.log(colors.gray(`  AI Only: ${options.aiOnly}`));
        if (options.confidenceThreshold) console.log(colors.gray(`  Confidence Threshold: ${options.confidenceThreshold}`));
        if (options.maxCompanies) console.log(colors.gray(`  Max Companies: ${options.maxCompanies}`));
        console.log('');
      }

      // Import YC OSS service
      const { createYCOSSImportService } = await import('../src/lib/yc-oss-import-service');
      const ossImportService = createYCOSSImportService();

      const ossOptions = {
        clearExisting: importOptions.clearExisting,
        dryRun: importOptions.dryRun,
        batchSize: options.batchSize || 50, // Larger batches for OSS
        skipDuplicates: importOptions.skipDuplicates,
        classifyAI: options.classifyAI,
        aiOnly: options.aiOnly,
        confidenceThreshold: options.confidenceThreshold,
        maxCompanies: options.maxCompanies
      };

      const result = await ossImportService.importFromYCOSS(ossOptions);
      
      // Map OSS result to standard ImportResult format
      totalResults = {
        success: result.success,
        companiesProcessed: result.companiesProcessed,
        companiesImported: result.companiesImported,
        foundersImported: 0, // OSS doesn't have founder data
        jobsImported: 0, // OSS doesn't have job data
        errors: result.errors,
        warnings: result.warnings,
        skipped: result.skipped,
        processingTimeMs: result.processingTimeMs
      };

      // Show results
      if (result.success) {
        console.log(colors.green(`✅ YC OSS import successful!`));
        console.log(colors.green(`   Companies: ${result.companiesImported} (${result.aiCompanies} AI, ${result.nonAiCompanies} non-AI)`));
        console.log(colors.gray(`   Download: ${result.downloadTimeMs}ms, Classification: ${result.classificationTimeMs}ms`));
      } else {
        console.log(colors.red(`❌ YC OSS import failed: ${result.errors.length} errors`));
        if (options.verbose) {
          result.errors.forEach(error => console.log(colors.red(`   Error: ${error}`)));
        }
      }
      
    } else {
      // Process files (existing logic)
      const filesToProcess = await getFilesToProcess(options);
      
      if (filesToProcess.length === 0) {
        console.log(colors.yellow('⚠️  No JSON files found to process'));
        return;
      }

      console.log(colors.blue(`📁 Found ${filesToProcess.length} file(s) to process\n`));

      for (const filePath of filesToProcess) {
        console.log(colors.blue(`📄 Processing: ${path.basename(filePath)}`));
        
        const result = await importService.importFromFile(filePath, importOptions);
        
        // Aggregate results
        totalResults.companiesProcessed += result.companiesProcessed;
        totalResults.companiesImported += result.companiesImported;
        totalResults.foundersImported += result.foundersImported;
        totalResults.jobsImported += result.jobsImported;
        totalResults.errors.push(...result.errors);
        totalResults.warnings.push(...result.warnings);
        totalResults.skipped.push(...result.skipped);
        totalResults.processingTimeMs += result.processingTimeMs;
        totalResults.success = totalResults.success && result.success;

        // Show file results
        if (result.success) {
          console.log(colors.green(`✅ Success: ${result.companiesImported} companies, ${result.foundersImported} founders imported`));
        } else {
          console.log(colors.red(`❌ Failed: ${result.errors.length} errors`));
          if (options.verbose) {
            result.errors.forEach(error => console.log(colors.red(`   Error: ${error}`)));
          }
        }
        console.log('');
      }
    }

    // Show final summary
    await showFinalSummary(totalResults, options.verbose);

  } catch (error) {
    console.error(colors.red('\n❌ Import failed:'));
    console.error(colors.red(error instanceof Error ? error.message : 'Unknown error'));
    process.exit(1);
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Validate environment variables and database connection
 */
async function validateEnvironment(source: 'file' | 'apify' | 'oss' = 'file'): Promise<void> {
  console.log(colors.gray('🔍 Validating environment...'));

  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];

  // Add source-specific requirements
  if (source === 'apify') {
    required.push('APIFY_API_TOKEN');
  } else if (source === 'oss') {
    // YC OSS API doesn't require additional env vars
    // But we might want to add OpenAI for AI classification
    if (process.env.OPENAI_API_KEY) {
      console.log(colors.gray('   OpenAI API key found - AI classification available'));
    } else {
      console.log(colors.yellow('   OpenAI API key not found - AI classification disabled'));
    }
  }

  const missing = required.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    console.error(colors.red('❌ Missing required environment variables:'));
    missing.forEach(envVar => console.error(colors.red(`   - ${envVar}`)));
    console.error(colors.yellow('\n💡 Create a .env.local file in the project root with:'));
    console.error(colors.gray('   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url'));
    console.error(colors.gray('   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key'));
    console.error(colors.gray('   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key'));
    throw new Error(`Missing ${missing.length} required environment variable(s)`);
  }

  // Test database connection
  try {
    const { createYCDatabaseService } = await import('../src/lib/yc-database');
    const dbService = createYCDatabaseService();
    const isConnected = await dbService.testConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to database');
    }
    console.log(colors.green('✅ Database connection verified\n'));
  } catch (error) {
    throw new Error(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get list of JSON files to process
 */
async function getFilesToProcess(options: any): Promise<string[]> {
  const files: string[] = [];

  if (options.file) {
    // Single file
    const filePath = path.resolve(options.file);
    try {
      await fs.access(filePath);
      files.push(filePath);
    } catch (error) {
      throw new Error(`File not found: ${filePath}`);
    }
  }

  if (options.directory) {
    // Directory of files
    const dirPath = path.resolve(options.directory);
    try {
      const dirEntries = await fs.readdir(dirPath, { withFileTypes: true });
      const jsonFiles = dirEntries
        .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
        .map(entry => path.join(dirPath, entry.name));
      files.push(...jsonFiles);
    } catch (error) {
      throw new Error(`Directory not found or inaccessible: ${dirPath}`);
    }
  }

  return files.sort(); // Process files in consistent order
}

/**
 * Clear existing data
 */
async function clearExistingData(verbose: boolean): Promise<void> {
  console.log(colors.yellow('🧹 Clearing existing company data...'));
  
  try {
    const { createYCDatabaseService } = await import('../src/lib/yc-database');
    const dbService = createYCDatabaseService();
    const result = await dbService.clearAllCompanies();
    
    console.log(colors.green(`✅ Cleared ${result.companiesDeleted} companies, ${result.foundersDeleted} founders\n`));
    
    if (verbose) {
      console.log(colors.gray(`   Companies deleted: ${result.companiesDeleted}`));
      console.log(colors.gray(`   Founders deleted: ${result.foundersDeleted}`));
      console.log(colors.gray(`   Funding records deleted: ${result.fundingDeleted}\n`));
    }
  } catch (error) {
    throw new Error(`Failed to clear existing data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Show final import summary
 */
async function showFinalSummary(results: ImportResult, verbose: boolean): Promise<void> {
  console.log(colors.blue('📊 Final Import Summary'));
  console.log(colors.blue('========================\n'));

  if (results.success) {
    console.log(colors.green(`✅ Import completed successfully!`));
  } else {
    console.log(colors.red(`❌ Import completed with errors`));
  }

  console.log(`\n📈 Statistics:`);
  console.log(`   Companies processed: ${colors.cyan(results.companiesProcessed.toString())}`);
  console.log(`   Companies imported: ${colors.green(results.companiesImported.toString())}`);
  console.log(`   Founders imported: ${colors.green(results.foundersImported.toString())}`);
  console.log(`   Processing time: ${colors.gray((results.processingTimeMs / 1000).toFixed(2))}s`);

  if (results.errors.length > 0) {
    console.log(`\n❌ Errors: ${colors.red(results.errors.length.toString())}`);
    if (verbose) {
      results.errors.forEach(error => console.log(colors.red(`   ${error}`)));
    }
  }

  if (results.warnings.length > 0) {
    console.log(`\n⚠️  Warnings: ${colors.yellow(results.warnings.length.toString())}`);
    if (verbose) {
      results.warnings.forEach(warning => console.log(colors.yellow(`   ${warning}`)));
    }
  }

  if (results.skipped.length > 0) {
    console.log(`\n⏭️  Skipped: ${colors.gray(results.skipped.length.toString())}`);
    if (verbose) {
      results.skipped.forEach(skipped => console.log(colors.gray(`   ${skipped}`)));
    }
  }

  // Show database statistics
  if (!results.success || verbose) {
    await showDatabaseStats();
  }

  console.log('');
}

/**
 * Show current database statistics
 */
async function showDatabaseStats(): Promise<void> {
  try {
    console.log(`\n🗄️  Database Statistics:`);
    
    const { createYCDatabaseService } = await import('../src/lib/yc-database');
    const dbService = createYCDatabaseService();
    const health = await dbService.getHealthMetrics();
    
    console.log(`   Total companies: ${colors.cyan(health.totalCompanies.toString())}`);
    console.log(`   Last sync: ${colors.gray(health.lastSyncDate || 'Never')}`);
    console.log(`   Database connected: ${health.isConnected ? colors.green('Yes') : colors.red('No')}`);
  } catch (error) {
    console.log(colors.red(`   Failed to fetch database stats: ${error instanceof Error ? error.message : 'Unknown'}`));
  }
}

// =============================================================================
// Error Handling
// =============================================================================

process.on('unhandledRejection', (error) => {
  console.error(colors.red('\n💥 Unhandled rejection:'));
  console.error(error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error(colors.red('\n💥 Uncaught exception:'));
  console.error(error);
  process.exit(1);
});

// =============================================================================
// Run the CLI
// =============================================================================

if (require.main === module) {
  main().catch(error => {
    console.error(colors.red('\n💥 CLI execution failed:'));
    console.error(error);
    process.exit(1);
  });
}