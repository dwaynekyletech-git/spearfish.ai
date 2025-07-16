#!/usr/bin/env node

/**
 * Re-sync YC Data Script
 * 
 * This script fetches all YC companies with the new fields and updates the database
 * with the additional data that was previously missing.
 */

// This script should be run from the project root using the API endpoint
console.log('⚠️  This script has been replaced with an API endpoint.');
console.log('📋 To test YC re-sync, use:');
console.log('   curl http://localhost:3000/api/test-yc-resync');
console.log('');
console.log('📋 To run full re-sync, use:');
console.log('   curl -X POST http://localhost:3000/api/test-yc-resync -H "Content-Type: application/json" -d \'{"full_sync": true}\'');
console.log('');
console.log('🚀 Or visit http://localhost:3000/api/test-yc-resync in your browser for a test run');
process.exit(0);

async function main() {
  console.log('🚀 Starting YC data re-sync with new fields...');
  
  try {
    // Initialize services
    const ycClient = createYCClient();
    const dbService = createYCDatabaseService();
    
    // Test database connection
    console.log('📊 Testing database connection...');
    const isConnected = await dbService.testConnection();
    if (!isConnected) {
      throw new Error('Database connection failed');
    }
    console.log('✅ Database connection successful');
    
    // Get all companies from YC API
    console.log('🔍 Fetching all companies from YC API...');
    const companies = await ycClient.getCompanies();
    console.log(`📈 Found ${companies.length} companies from YC API`);
    
    // Process companies in batches
    const batchSize = 50;
    const batches = [];
    for (let i = 0; i < companies.length; i += batchSize) {
      batches.push(companies.slice(i, i + batchSize));
    }
    
    console.log(`📦 Processing ${batches.length} batches of ${batchSize} companies each`);
    
    let totalSuccess = 0;
    let totalFailed = 0;
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`🔄 Processing batch ${i + 1}/${batches.length} (${batch.length} companies)...`);
      
      try {
        const results = await dbService.upsertCompanies(batch);
        totalSuccess += results.successful.length;
        totalFailed += results.failed.length;
        
        if (results.failed.length > 0) {
          console.log(`⚠️  Batch ${i + 1}: ${results.successful.length} succeeded, ${results.failed.length} failed`);
          // Log first few errors for debugging
          results.failed.slice(0, 3).forEach(failure => {
            console.log(`   Error for ${failure.company.name}: ${failure.error}`);
          });
        } else {
          console.log(`✅ Batch ${i + 1}: All ${results.successful.length} companies processed successfully`);
        }
        
        // Brief pause between batches to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Batch ${i + 1} failed completely:`, error.message);
        totalFailed += batch.length;
      }
    }
    
    console.log('\n📊 Re-sync Summary:');
    console.log(`✅ Successfully processed: ${totalSuccess} companies`);
    console.log(`❌ Failed to process: ${totalFailed} companies`);
    console.log(`📈 Total companies: ${companies.length}`);
    console.log(`🎯 Success rate: ${((totalSuccess / companies.length) * 100).toFixed(1)}%`);
    
    // Get updated sync statistics
    console.log('\n📈 Getting updated database statistics...');
    const stats = await dbService.getSyncStatistics();
    console.log(`📊 Database now contains: ${stats.total_companies} companies`);
    console.log(`🔄 Last sync: ${stats.last_sync_date}`);
    console.log(`🤖 AI classified: ${stats.ai_companies} companies`);
    
    console.log('\n🎉 YC data re-sync completed successfully!');
    
  } catch (error) {
    console.error('❌ Re-sync failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⏹️  Re-sync interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⏹️  Re-sync terminated');
  process.exit(0);
});

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = { main };