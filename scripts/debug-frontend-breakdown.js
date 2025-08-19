const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugFrontendBreakdown() {
  console.log('🔍 Debugging Frontend Score Breakdown Issue\n');

  try {
    // Get Struct's score history
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name')
      .ilike('name', '%struct%')
      .limit(1);

    if (!companies || companies.length === 0) {
      console.log('❌ Struct company not found');
      return;
    }

    const struct = companies[0];
    
    const { data: scoreHistory } = await supabase
      .from('score_history')
      .select('*')
      .eq('company_id', struct.id)
      .order('calculated_at', { ascending: false })
      .limit(1);

    if (!scoreHistory || scoreHistory.length === 0) {
      console.log('❌ No score history found');
      return;
    }

    const latestScore = scoreHistory[0];
    console.log('📊 Latest Score Breakdown from Database:');
    console.log(JSON.stringify(latestScore.score_breakdown, null, 2));
    
    console.log('\n🔍 CRITERIA_INFO Keys (what frontend expects):');
    const CRITERIA_INFO_KEYS = [
      'targetBatch',
      'companyAge', 
      'fundingStage',
      'githubActivity',
      'b2bFocus',
      'huggingfaceActivity',
      'conferencePresence',
      'nameQuality',
      'hiringStatus'
    ];
    
    CRITERIA_INFO_KEYS.forEach(key => {
      const scoreFromDB = latestScore.score_breakdown[key];
      console.log(`  ${key}: ${scoreFromDB !== undefined ? scoreFromDB : 'MISSING'}`);
    });
    
    console.log('\n🔍 Database Breakdown Keys (what we actually have):');
    Object.keys(latestScore.score_breakdown).forEach(key => {
      console.log(`  ${key}: ${latestScore.score_breakdown[key]}`);
    });
    
    // Check for key mismatches
    console.log('\n⚠️  Key Mapping Issues:');
    const dbKeys = Object.keys(latestScore.score_breakdown);
    const expectedKeys = CRITERIA_INFO_KEYS;
    
    const missingInDB = expectedKeys.filter(key => !dbKeys.includes(key));
    const extraInDB = dbKeys.filter(key => !expectedKeys.includes(key));
    
    if (missingInDB.length > 0) {
      console.log(`  Missing in DB: ${missingInDB.join(', ')}`);
    }
    
    if (extraInDB.length > 0) {
      console.log(`  Extra in DB: ${extraInDB.join(', ')}`);
    }
    
    if (missingInDB.length === 0 && extraInDB.length === 0) {
      console.log('  ✅ All keys match perfectly');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugFrontendBreakdown().catch(console.error);