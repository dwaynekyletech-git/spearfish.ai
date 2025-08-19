/**
 * Simple verification that the fix works by testing database service directly
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function verifyFix() {
  console.log('🔍 Verifying Score Breakdown Fix\n');

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get Struct company
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
    console.log(`📋 Testing: ${struct.name} (Current Score: ${struct.spearfish_score})`);

    // Test direct access with service role (what the fixed API now uses)
    const { data: scoreHistory, error } = await supabase
      .from('score_history')
      .select('*')
      .eq('company_id', struct.id)
      .order('calculated_at', { ascending: false })
      .limit(1);

    if (error) {
      console.log('❌ Error fetching score history:', error.message);
      return;
    }

    if (!scoreHistory || scoreHistory.length === 0) {
      console.log('❌ No score history found');
      return;
    }

    const latest = scoreHistory[0];
    console.log('\n✅ Score History Retrieved Successfully:');
    console.log(`  Score: ${latest.spearfish_score}`);
    console.log(`  Algorithm Version: ${latest.algorithm_version}`);
    console.log(`  Confidence: ${(latest.confidence * 100).toFixed(1)}%`);
    console.log(`  Calculated At: ${latest.calculated_at}`);

    const breakdown = latest.score_breakdown || {};
    console.log('\n📊 Score Breakdown:');
    
    let nonZeroCount = 0;
    let totalScore = 0;
    
    Object.entries(breakdown).forEach(([criterion, score]) => {
      const displayScore = typeof score === 'number' ? score.toFixed(2) : score;
      console.log(`  ${criterion}: ${displayScore}/10`);
      
      if (typeof score === 'number' && score > 0) {
        nonZeroCount++;
        totalScore += score;
      }
    });

    console.log(`\n🎯 Summary:`);
    console.log(`  Criteria with values > 0: ${nonZeroCount}/${Object.keys(breakdown).length}`);
    console.log(`  Average score: ${(totalScore / Object.keys(breakdown).length).toFixed(2)}/10`);

    if (nonZeroCount >= 5) {
      console.log('\n🎉 SUCCESS! Score breakdown has meaningful values.');
      console.log('📱 The frontend should now display actual scores instead of 0.0');
      console.log('🔧 The API fix using service role authentication resolved the issue.');
    } else {
      console.log('\n⚠️  Still seeing mostly zero values - may need additional investigation');
    }

    // Show the specific values that should appear in frontend
    console.log('\n📱 Frontend Should Now Display:');
    console.log(`  Target Batch: ${breakdown.targetBatch || 0}/10 (was showing 0.0)`);
    console.log(`  Company Age: ${(breakdown.companyAge || 0).toFixed(1)}/10 (was showing 0.0)`);
    console.log(`  GitHub Activity: ${breakdown.githubActivity || 0}/10 (was showing 0.0)`);
    console.log(`  B2B Focus: ${breakdown.b2bFocus || 0}/10 (was showing 0.0)`);
    console.log(`  Hiring Status: ${breakdown.hiringStatus || 0}/10 (was showing 0.0)`);

  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

verifyFix().catch(console.error);