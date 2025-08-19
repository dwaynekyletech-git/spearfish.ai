/**
 * Test the score history API to see if it returns proper breakdown data
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testScoreAPI() {
  console.log('🧪 Testing Score History API\n');

  try {
    // Get Struct company ID
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name, spearfish_score')
      .ilike('name', '%struct%')
      .limit(1);

    if (!companies || companies.length === 0) {
      console.log('❌ Struct company not found');
      return;
    }

    const struct = companies[0];
    console.log(`📋 Testing with: ${struct.name} (Score: ${struct.spearfish_score})`);
    console.log(`📋 Company ID: ${struct.id}\n`);

    // Test 1: Direct database query
    console.log('🔍 Test 1: Direct Database Query');
    const { data: directHistory, error: directError } = await supabase
      .from('score_history')
      .select('*')
      .eq('company_id', struct.id)
      .order('calculated_at', { ascending: false })
      .limit(1);

    if (directError) {
      console.log('❌ Direct query error:', directError);
    } else if (directHistory && directHistory.length > 0) {
      const latest = directHistory[0];
      console.log('✅ Direct query success:');
      console.log(`  Score: ${latest.spearfish_score}`);
      console.log(`  Algorithm: v${latest.algorithm_version}`);
      console.log(`  Breakdown keys: ${Object.keys(latest.score_breakdown || {}).join(', ')}`);
      console.log(`  Sample breakdown values:`);
      const breakdown = latest.score_breakdown || {};
      Object.entries(breakdown).slice(0, 3).forEach(([key, value]) => {
        console.log(`    ${key}: ${value}`);
      });
    } else {
      console.log('❌ No direct history found');
    }

    // Test 2: Test the API response format that frontend would receive
    console.log('\n🌐 Test 2: Simulating Frontend API Call');
    
    // Simulate what the frontend would get
    const mockAPIResponse = {
      success: true,
      data: {
        companyId: struct.id,
        history: directHistory || [],
        count: (directHistory || []).length
      }
    };

    if (mockAPIResponse.data.history.length > 0) {
      const frontendLatestScore = mockAPIResponse.data.history[0];
      const frontendScoreBreakdown = frontendLatestScore?.score_breakdown || {};
      
      console.log('✅ Frontend would receive:');
      console.log(`  scoreHistory.length: ${mockAPIResponse.data.history.length}`);
      console.log(`  latestScore exists: ${!!frontendLatestScore}`);
      console.log(`  scoreBreakdown object: ${JSON.stringify(frontendScoreBreakdown)}`);
      
      // Test the actual key lookup that frontend does
      const CRITERIA_KEYS = [
        'targetBatch', 'companyAge', 'fundingStage', 'githubActivity',
        'b2bFocus', 'huggingfaceActivity', 'conferencePresence', 'nameQuality', 'hiringStatus'
      ];
      
      console.log('\n🔍 Frontend Key Lookup Test:');
      CRITERIA_KEYS.forEach(key => {
        const value = frontendScoreBreakdown[key] || 0;
        console.log(`  ${key}: ${value} ${value === 0 ? '❌' : '✅'}`);
      });
      
    } else {
      console.log('❌ Frontend would receive empty history');
    }

    // Test 3: Check if there are any authentication issues
    console.log('\n🔐 Test 3: Authentication Test');
    
    // Try with anon key (what frontend might use)
    const anonSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data: anonHistory, error: anonError } = await anonSupabase
      .from('score_history')
      .select('*')
      .eq('company_id', struct.id)
      .limit(1);

    if (anonError) {
      console.log('❌ Anon key access failed:', anonError.message);
      console.log('  This could be the issue - RLS might be blocking anon access');
    } else {
      console.log(`✅ Anon key access works - found ${(anonHistory || []).length} records`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testScoreAPI().catch(console.error);