/**
 * Apply Star Growth Function Fix
 * 
 * This script applies the fix for the ambiguous column reference in calculate_star_growth function
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyStarGrowthFix() {
  console.log('🔧 Applying star growth function fix...\n');
  
  try {
    // Read the SQL file
    const sqlContent = fs.readFileSync('./fix-star-growth.sql', 'utf8');
    
    // Execute the SQL
    const { error } = await supabase.rpc('exec_sql', { sql: sqlContent });
    
    if (error) {
      console.error('❌ Error applying fix:', error);
      return;
    }
    
    console.log('✅ Star growth function fix applied successfully!');
    
    // Test the function
    console.log('\n🧪 Testing the fixed function...');
    
    // Get a random repository ID to test with
    const { data: repos, error: repoError } = await supabase
      .from('github_repositories')
      .select('id')
      .limit(1);
    
    if (repoError || !repos || repos.length === 0) {
      console.log('⚠️  No repositories found to test with');
      return;
    }
    
    const testRepoId = repos[0].id;
    
    // Test the function
    const { data: result, error: testError } = await supabase
      .rpc('calculate_star_growth', { 
        repo_id: testRepoId, 
        days_period: 30 
      });
    
    if (testError) {
      console.error('❌ Test failed:', testError);
    } else {
      console.log('✅ Test passed! Function result:', result);
    }
    
  } catch (error) {
    console.error('❌ Error applying fix:', error);
  }
}

// Run the script
if (require.main === module) {
  applyStarGrowthFix().catch(console.error);
}

module.exports = { applyStarGrowthFix };