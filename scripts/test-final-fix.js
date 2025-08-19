/**
 * Test the final fix for score breakdown display issue
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function testFinalFix() {
  console.log('🎯 Testing Final Fix for Score Breakdown Display\n');

  try {
    // Test the API endpoint that frontend actually calls
    const testCompanyId = '8dffbd33-783c-444c-a31c-77ab9819a505'; // Struct
    
    // Test 1: Check if API returns data now
    console.log('🌐 Test 1: Testing Score History API...');
    
    const response = await fetch(`http://localhost:3000/api/companies/${testCompanyId}/score-history`, {
      headers: {
        'Cookie': 'test=1' // This won't work but let's see the error
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API Response Success:');
      console.log(`  History Length: ${data.data?.history?.length || 0}`);
      
      if (data.data?.history?.length > 0) {
        const latest = data.data.history[0];
        console.log(`  Latest Score: ${latest.spearfish_score}`);
        console.log(`  Breakdown Keys: ${Object.keys(latest.score_breakdown || {}).join(', ')}`);
        console.log('🎉 Frontend should now display scores correctly!');
      } else {
        console.log('❌ Still no history data returned');
      }
    } else {
      console.log(`❌ API Error: ${response.status} ${response.statusText}`);
      const errorData = await response.text();
      console.log(`  Error: ${errorData}`);
    }

    // Test 2: Direct database test with service role
    console.log('\n🔧 Test 2: Direct Database Access Test...');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: companies } = await supabase
      .from('companies')
      .select('id, name, spearfish_score')
      .ilike('name', '%struct%')
      .limit(1);

    if (companies && companies.length > 0) {
      const struct = companies[0];
      console.log(`📋 Testing: ${struct.name} (Score: ${struct.spearfish_score})`);

      // Using the same method as the fixed API
      const { SpearfishDatabaseService } = require('../dist/lib/spearfish-database-service.js');
      const databaseService = new SpearfishDatabaseService(true, true); // server client with service role
      
      const scoreHistory = await databaseService.getCompanyScoreHistory(struct.id, { limit: 1 });
      
      console.log('✅ Database Service Test:');
      console.log(`  History Length: ${scoreHistory.length}`);
      
      if (scoreHistory.length > 0) {
        const latest = scoreHistory[0];
        console.log(`  Score: ${latest.spearfish_score}`);
        console.log(`  Algorithm: v${latest.algorithm_version}`);
        console.log(`  Confidence: ${(latest.confidence * 100).toFixed(1)}%`);
        
        const breakdown = latest.score_breakdown || {};
        console.log('  Breakdown:');
        Object.entries(breakdown).forEach(([key, value]) => {
          console.log(`    ${key}: ${value}`);
        });
        
        // Verify non-zero values
        const nonZeroCount = Object.values(breakdown).filter(v => v > 0).length;
        console.log(`\n🎯 Non-zero breakdown values: ${nonZeroCount}/${Object.keys(breakdown).length}`);
        
        if (nonZeroCount > 5) {
          console.log('🎉 SUCCESS: Score breakdown has meaningful values!');
          console.log('📱 Frontend should now display correct scores instead of 0.0');
        } else {
          console.log('⚠️  Most breakdown values are still 0 - need to investigate further');
        }
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testFinalFix().catch(console.error);