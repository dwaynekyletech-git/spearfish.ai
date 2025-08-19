const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function investigateStructScoreIssue() {
  console.log('🔍 Investigating Struct Score Display Issue\n');

  try {
    // Find Struct company
    const { data: companies, error } = await supabase
      .from('companies')
      .select('*')
      .ilike('name', '%struct%')
      .limit(5);

    if (error || !companies || companies.length === 0) {
      console.log('❌ Struct company not found');
      return;
    }

    for (const company of companies) {
      console.log('=' .repeat(80));
      console.log(`Company: ${company.name}`);
      console.log(`ID: ${company.id}`);
      console.log(`Current Spearfish Score: ${company.spearfish_score}`);
      console.log(`Updated At: ${company.updated_at}`);
      
      // Get score history
      const { data: scoreHistory } = await supabase
        .from('score_history')
        .select('*')
        .eq('company_id', company.id)
        .order('calculated_at', { ascending: false });
        
      if (scoreHistory && scoreHistory.length > 0) {
        console.log(`\n📜 Score History (${scoreHistory.length} entries):`);
        
        scoreHistory.forEach((score, index) => {
          console.log(`\n  Entry ${index + 1}:`);
          console.log(`    Score: ${score.spearfish_score}`);
          console.log(`    Algorithm Version: ${score.algorithm_version}`);
          console.log(`    Calculated At: ${score.calculated_at}`);
          console.log(`    Confidence: ${(score.confidence * 100).toFixed(1)}%`);
          
          if (score.score_breakdown) {
            console.log(`    Breakdown:`);
            Object.entries(score.score_breakdown).forEach(([criterion, value]) => {
              console.log(`      - ${criterion}: ${value}`);
            });
          }
          
          if (score.metadata) {
            console.log(`    Metadata:`);
            console.log(`      - Missing Data: ${JSON.stringify(score.metadata.missingDataPoints || [])}`);
            console.log(`      - Approximations: ${JSON.stringify(score.metadata.approximations || [])}`);
            console.log(`      - Warnings: ${JSON.stringify(score.metadata.warnings || [])}`);
          }
        });
      } else {
        console.log('\n❌ No score history found');
      }
      
      // Check raw company data
      console.log('\n📊 Raw Company Data:');
      console.log(`  Batch: "${company.batch}"`);
      console.log(`  Launched At: ${company.launched_at ? new Date(company.launched_at * 1000).toISOString() : 'null'}`);
      console.log(`  Is Hiring: ${company.is_hiring}`);
      console.log(`  One Liner: "${company.one_liner || 'null'}"`);
      console.log(`  GitHub Repos: ${JSON.stringify(company.github_repos || []).slice(0, 200)}...`);
      console.log(`  HuggingFace Models: ${JSON.stringify(company.huggingface_models || []).slice(0, 200)}...`);
      
      // Manually calculate what the score should be
      console.log('\n🧮 Manual Score Calculation:');
      const batch = company.batch;
      const targetBatches = ['W22', 'S22', 'W23'];
      const normalizedBatch = normalizeBatch(batch);
      const targetBatchScore = targetBatches.includes(normalizedBatch) ? 10 : 0;
      
      let companyAgeScore = 5; // default
      if (company.launched_at) {
        const launchDate = new Date(company.launched_at * 1000);
        const monthsOld = (Date.now() - launchDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
        
        if (monthsOld >= 18 && monthsOld <= 24) companyAgeScore = 10;
        else if (monthsOld < 18) companyAgeScore = Math.max(0, 10 - (18 - monthsOld) * 0.5);
        else companyAgeScore = Math.max(0, 10 - (monthsOld - 24) * 0.3);
      }
      
      const githubRepos = company.github_repos || [];
      const totalStars = githubRepos.reduce((sum, repo) => sum + (repo.stars_count || 0), 0);
      let githubScore = 1;
      if (totalStars >= 10000) githubScore = 10;
      else if (totalStars >= 5000) githubScore = 8;
      else if (totalStars >= 1000) githubScore = 6;
      else if (totalStars >= 100) githubScore = 4;
      else if (totalStars > 0) githubScore = 2;
      
      console.log(`  Target Batch (${batch} -> ${normalizedBatch}): ${targetBatchScore}/10`);
      console.log(`  Company Age: ${companyAgeScore.toFixed(2)}/10`);
      console.log(`  GitHub Activity (${totalStars} stars): ${githubScore}/10`);
      console.log(`  Hiring Status: ${company.is_hiring ? 8 : 4}/10`);
      
      // Calculate expected weighted score
      const weights = {
        targetBatch: 0.4,
        companyAge: 0.15,
        fundingStage: 0.15,
        githubActivity: 0.07,
        b2bFocus: 0.07,
        huggingfaceActivity: 0.06,
        conferencePresence: 0.03,
        nameQuality: 0.04,
        hiringStatus: 0.03
      };
      
      const expectedScore = 
        targetBatchScore * weights.targetBatch +
        companyAgeScore * weights.companyAge +
        5 * weights.fundingStage + // default funding stage
        githubScore * weights.githubActivity +
        0 * weights.b2bFocus + // assuming no B2B keywords
        1 * weights.huggingfaceActivity + // default HF score
        2 * weights.conferencePresence + // default conference
        8 * weights.nameQuality + // assuming good name
        (company.is_hiring ? 8 : 4) * weights.hiringStatus;
      
      console.log(`\n🎯 Expected Weighted Score: ${expectedScore.toFixed(2)}/10`);
      console.log(`📊 Actual Stored Score: ${company.spearfish_score}/10`);
      
      if (Math.abs(expectedScore - (company.spearfish_score || 0)) > 0.1) {
        console.log(`⚠️  MISMATCH DETECTED! Difference: ${Math.abs(expectedScore - (company.spearfish_score || 0)).toFixed(2)}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Investigation failed:', error);
  }
}

function normalizeBatch(batch) {
  if (!batch) return '';
  
  // Handle various batch formats
  if (batch.includes('Winter 2022')) return 'W22';
  if (batch.includes('Summer 2022')) return 'S22';
  if (batch.includes('Winter 2023')) return 'W23';
  
  const match = batch.match(/^(Winter|Summer)\s+(\d{4})$/);
  if (match) {
    const [, season, year] = match;
    const shortSeason = season === 'Winter' ? 'W' : 'S';
    const shortYear = year.slice(-2);
    return `${shortSeason}${shortYear}`;
  }
  return batch;
}

investigateStructScoreIssue().catch(console.error);