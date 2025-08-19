#!/usr/bin/env node

/**
 * Test HuggingFace Discovery API
 * 
 * This script tests the complete HuggingFace discovery system by calling the API
 * and analyzing the results to ensure proper validation and data quality.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testHuggingFaceDiscoveryAPI() {
  console.log('🧪 TESTING HUGGINGFACE DISCOVERY API\n');
  console.log('=' .repeat(70));

  try {
    // Step 1: Check current status before discovery
    console.log('\n📊 STEP 1: CHECKING CURRENT STATUS\n');
    console.log('-' .repeat(40));

    const { data: companiesBefore, error: beforeError } = await supabase
      .from('companies')
      .select('id, name, huggingface_models')
      .eq('huggingface_models', JSON.stringify([]))
      .limit(5);

    if (beforeError) {
      throw new Error(`Failed to fetch companies: ${beforeError.message}`);
    }

    console.log(`\n🏢 Companies without HuggingFace models: ${companiesBefore?.length || 0}`);
    
    if (companiesBefore && companiesBefore.length > 0) {
      console.log('\nTop 5 companies needing discovery:');
      companiesBefore.forEach((company, index) => {
        console.log(`   ${index + 1}. ${company.name}`);
      });
    } else {
      console.log('✅ All companies already have HuggingFace data!');
      console.log('   You may want to clear some data to test discovery.');
      return;
    }

    // Step 2: Get API status
    console.log('\n\n📋 STEP 2: CHECKING API STATUS\n');
    console.log('-' .repeat(40));

    const statusResponse = await fetch('http://localhost:3000/api/discover/huggingface', {
      method: 'GET'
    });

    if (!statusResponse.ok) {
      throw new Error(`API status check failed: ${statusResponse.status} ${statusResponse.statusText}`);
    }

    const statusData = await statusResponse.json();
    console.log('\n📊 API Status Response:');
    console.log(`   • Success: ${statusData.success}`);
    console.log(`   • Companies needing discovery: ${statusData.data?.companiesNeedingDiscovery || 0}`);
    console.log(`   • Current HF data percentage: ${statusData.data?.currentStatus?.hfDataPercentage || 0}%`);

    // Step 3: Run discovery on a small batch
    console.log('\n\n🚀 STEP 3: RUNNING DISCOVERY (BATCH SIZE: 3)\n');
    console.log('-' .repeat(40));

    const discoveryResponse = await fetch('http://localhost:3000/api/discover/huggingface?limit=3', {
      method: 'POST'
    });

    if (!discoveryResponse.ok) {
      const errorData = await discoveryResponse.json();
      throw new Error(`Discovery API failed: ${errorData.message || 'Unknown error'}`);
    }

    const discoveryData = await discoveryResponse.json();
    console.log('\n🎉 Discovery Results:');
    console.log(`   • Success: ${discoveryData.success}`);
    console.log(`   • Message: ${discoveryData.message}`);
    
    if (discoveryData.data?.summary) {
      const summary = discoveryData.data.summary;
      console.log(`   • Companies processed: ${summary.companiesProcessed}`);
      console.log(`   • Models found: ${summary.modelsFound || 0}`);
      console.log(`   • Models stored: ${summary.modelsStored || 0}`);
      console.log(`   • Companies updated: ${summary.companiesUpdated || 0}`);
      console.log(`   • Rate limit remaining: ${summary.rateLimitRemaining || 'Unknown'}`);
    }

    // Step 4: Analyze individual company results
    if (discoveryData.data?.discovery?.results) {
      console.log('\n\n🔍 STEP 4: DETAILED COMPANY ANALYSIS\n');
      console.log('-' .repeat(40));

      discoveryData.data.discovery.results.forEach((result, index) => {
        console.log(`\n🏢 Company ${index + 1}: ${result.companyName}`);
        console.log(`   Search methods: [${result.searchMethods.join(', ') || 'none'}]`);
        console.log(`   Models found: ${result.modelsFound.length}`);
        console.log(`   Models associated: ${result.modelsAssociated}`);
        console.log(`   Confidence: ${result.confidence}`);
        
        if (result.issues.length > 0) {
          console.log(`   Issues: ${result.issues.join(', ')}`);
        }
        
        if (result.modelsFound.length > 0) {
          console.log(`   Top models:`);
          result.modelsFound.slice(0, 3).forEach(model => {
            console.log(`     • ${model.id} (${model.downloads} downloads, ${model.likes} likes)`);
          });
        }
      });
    }

    // Step 5: Verify data was synced correctly
    console.log('\n\n✅ STEP 5: VERIFYING DATA SYNC\n');
    console.log('-' .repeat(40));

    // Check if companies now have HF data
    const { data: companiesAfter, error: afterError } = await supabase
      .from('companies')
      .select('id, name, huggingface_models')
      .not('huggingface_models', 'eq', JSON.stringify([]))
      .order('updated_at', { ascending: false })
      .limit(3);

    if (afterError) {
      throw new Error(`Failed to fetch updated companies: ${afterError.message}`);
    }

    if (companiesAfter && companiesAfter.length > 0) {
      console.log('\n🎯 Companies with newly discovered HF models:');
      companiesAfter.forEach((company, index) => {
        const modelCount = Array.isArray(company.huggingface_models) ? company.huggingface_models.length : 0;
        console.log(`   ${index + 1}. ${company.name}: ${modelCount} models`);
        
        if (modelCount > 0 && company.huggingface_models[0]) {
          const primaryModel = company.huggingface_models[0];
          console.log(`      Primary: ${primaryModel.model_id} (${primaryModel.downloads || 0} downloads)`);
        }
      });
    }

    // Step 6: Data quality check
    console.log('\n\n🎯 STEP 6: DATA QUALITY ASSESSMENT\n');
    console.log('-' .repeat(40));

    // Check for any suspicious associations
    const { data: associations, error: assocError } = await supabase
      .from('company_huggingface_models')
      .select(`
        id,
        confidence_score,
        discovery_method,
        companies!inner(name),
        huggingface_models!inner(model_id, author, downloads)
      `)
      .order('confidence_score', { ascending: true })
      .limit(5);

    if (!assocError && associations && associations.length > 0) {
      console.log('\n🔍 Lowest confidence associations (potential false positives):');
      associations.forEach((assoc, index) => {
        console.log(`   ${index + 1}. ${assoc.companies.name} → ${assoc.huggingface_models.model_id}`);
        console.log(`      Author: ${assoc.huggingface_models.author}`);
        console.log(`      Confidence: ${(assoc.confidence_score * 100).toFixed(0)}%`);
        console.log(`      Method: ${assoc.discovery_method}`);
        console.log(`      Downloads: ${assoc.huggingface_models.downloads}`);
      });
    }

    // Step 7: Summary and recommendations
    console.log('\n\n' + '='.repeat(70));
    console.log('🎉 HUGGINGFACE DISCOVERY TEST COMPLETE!\n');

    const totalModelsFound = discoveryData.data?.summary?.modelsFound || 0;
    const totalCompaniesProcessed = discoveryData.data?.summary?.companiesProcessed || 0;

    if (totalModelsFound > 0) {
      console.log(`✅ SUCCESS: Discovered ${totalModelsFound} models for ${totalCompaniesProcessed} companies`);
    } else {
      console.log(`ℹ️  NO MODELS FOUND: Processed ${totalCompaniesProcessed} companies but found no valid models`);
    }

    console.log('\n📋 Next Steps:');
    if (totalModelsFound > 0) {
      console.log('  1. ✅ Discovery is working - review the model associations above');
      console.log('  2. 🧹 Run cleanup script if you see any false positives');
      console.log('  3. 🔄 Process more companies by increasing the limit parameter');
      console.log('  4. 🎯 Update scoring service to use the new HF data');
    } else {
      console.log('  1. 🔑 Ensure you have a valid HuggingFace token in .env.local');
      console.log('  2. 🔍 Check if the companies have public HF models');
      console.log('  3. 🧪 Try manual discovery with known AI companies');
      console.log('  4. 📝 Review validation logic if results seem incorrect');
    }

    console.log('\n🛠️  Useful Commands:');
    console.log('  • Test validation: node scripts/test-hf-validation-system.js');
    console.log('  • Cleanup bad data: node scripts/cleanup-bad-hf-associations.js');
    console.log('  • Check API status: curl http://localhost:3000/api/discover/huggingface');
    console.log('  • Run discovery: curl -X POST "http://localhost:3000/api/discover/huggingface?limit=5"');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('  1. Make sure your development server is running (npm run dev)');
    console.log('  2. Check that database migrations have been applied');
    console.log('  3. Verify environment variables are set correctly');
    console.log('  4. Ensure HuggingFace token is valid (if using)');
    process.exit(1);
  }
}

// Run the test
testHuggingFaceDiscoveryAPI().then(() => {
  console.log('\n✨ Test completed successfully!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal test error:', error);
  process.exit(1);
});