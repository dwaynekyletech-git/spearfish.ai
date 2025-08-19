const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function investigateScoreMismatch() {
  console.log('🔍 Investigating Score Mismatch Issue\n');

  // Get a sample company from Winter 2022 batch
  const { data: companies, error } = await supabase
    .from('companies')
    .select('*')
    .eq('batch', 'Winter 2022')
    .limit(5);

  if (error) {
    console.error('Error fetching companies:', error);
    return;
  }

  for (const company of companies) {
    console.log('=' .repeat(80));
    console.log(`Company: ${company.name} (${company.batch})`);
    console.log(`ID: ${company.id}`);
    console.log('\n📊 Raw Data from Database:');
    console.log(`- Batch: "${company.batch}"`);
    console.log(`- Launched At: ${company.launched_at ? new Date(company.launched_at * 1000).toISOString() : 'null'}`);
    console.log(`- Is Hiring: ${company.is_hiring}`);
    console.log(`- GitHub Repos: ${JSON.stringify(company.github_repos || []).slice(0, 100)}...`);
    console.log(`- HuggingFace Models: ${JSON.stringify(company.huggingface_models || []).slice(0, 100)}...`);
    console.log(`- One Liner: "${company.one_liner || 'null'}"`);
    console.log(`- Tags: ${JSON.stringify(company.tags || [])}`);
    console.log(`- Current Spearfish Score: ${company.spearfish_score || 'null'}`);
    
    // Check what the scoring service sees
    console.log('\n🔍 What Scoring Service Evaluates:');
    
    // Mock the scoring evaluation to see what it calculates
    const mockEvaluate = {
      targetBatch: evaluateTargetBatch(company),
      companyAge: evaluateCompanyAge(company),
      githubActivity: evaluateGithubActivity(company),
      huggingfaceActivity: evaluateHuggingFaceActivity(company),
      b2bFocus: evaluateB2BFocus(company),
      hiringStatus: company.is_hiring ? 8 : 4,
    };
    
    console.log(`- Target Batch Score: ${mockEvaluate.targetBatch}/10 (W22/S22/W23 = 10, others = 0)`);
    console.log(`- Company Age Score: ${mockEvaluate.companyAge}/10`);
    console.log(`- GitHub Activity Score: ${mockEvaluate.githubActivity}/10`);
    console.log(`- HuggingFace Activity Score: ${mockEvaluate.huggingfaceActivity}/10`);
    console.log(`- B2B Focus Score: ${mockEvaluate.b2bFocus}/10`);
    console.log(`- Hiring Status Score: ${mockEvaluate.hiringStatus}/10`);
    
    // Check score history
    const { data: history } = await supabase
      .from('score_history')
      .select('*')
      .eq('company_id', company.id)
      .order('calculated_at', { ascending: false })
      .limit(1);
      
    if (history && history.length > 0) {
      console.log('\n📜 Latest Score History:');
      console.log(`- Score: ${history[0].spearfish_score}`);
      console.log(`- Algorithm Version: ${history[0].algorithm_version}`);
      console.log(`- Calculated At: ${history[0].calculated_at}`);
      console.log(`- Breakdown: ${JSON.stringify(history[0].score_breakdown)}`);
    }
  }
}

// Helper functions to evaluate criteria (simplified versions)
function evaluateTargetBatch(company) {
  const batch = company.batch;
  if (!batch) return 0;
  
  // Normalize batch format
  const normalizedBatch = normalizeBatch(batch);
  const targetBatches = ['W22', 'S22', 'W23'];
  return targetBatches.includes(normalizedBatch) ? 10 : 0;
}

function normalizeBatch(batch) {
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

function evaluateCompanyAge(company) {
  if (!company.launched_at) return 5;
  
  const launchDate = new Date(company.launched_at * 1000);
  const monthsOld = (Date.now() - launchDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  
  if (monthsOld >= 18 && monthsOld <= 24) return 10;
  if (monthsOld < 18) return Math.max(0, 10 - (18 - monthsOld) * 0.5);
  return Math.max(0, 10 - (monthsOld - 24) * 0.3);
}

function evaluateGithubActivity(company) {
  if (!company.github_repos || company.github_repos.length === 0) return 1;
  
  const repos = company.github_repos;
  let totalStars = 0;
  
  repos.forEach(repo => {
    totalStars += repo.stars_count || 0;
  });
  
  if (totalStars >= 10000) return 10;
  if (totalStars >= 5000) return 8;
  if (totalStars >= 1000) return 6;
  if (totalStars >= 100) return 4;
  return 2;
}

function evaluateHuggingFaceActivity(company) {
  if (!company.huggingface_models || company.huggingface_models.length === 0) return 1;
  
  const models = company.huggingface_models;
  let totalDownloads = 0;
  
  models.forEach(model => {
    totalDownloads += model.downloads || 0;
  });
  
  if (totalDownloads >= 1000000) return 10;
  if (totalDownloads >= 100000) return 8;
  if (totalDownloads >= 10000) return 6;
  if (totalDownloads >= 1000) return 4;
  return 2;
}

function evaluateB2BFocus(company) {
  const text = `${company.one_liner || ''} ${company.long_description || ''}`.toLowerCase();
  const b2bKeywords = ['b2b', 'business', 'enterprise', 'saas', 'api', 'platform', 'developer'];
  
  let score = 0;
  for (const keyword of b2bKeywords) {
    if (text.includes(keyword.toLowerCase())) {
      score += 2;
    }
  }
  
  return Math.min(score, 10);
}

investigateScoreMismatch().catch(console.error);