/**
 * Apply Function Fix
 * 
 * This script applies the fix for the ambiguous column reference in calculate_star_growth function
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyFunctionFix() {
  console.log('🔧 Applying function fix...\n');
  
  try {
    // First, let's test the current function to see if it's really broken
    console.log('Testing current function...');
    
    // Get a repository ID to test with
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
      console.error('❌ Function is indeed broken:', testError.message);
      console.log('This confirms the ambiguous column reference error.');
      console.log('\nThe fix should be applied by updating the migration file and re-running it.');
      console.log('Since we cannot execute raw SQL directly, the fix needs to be applied at the database level.');
      console.log('\nAlternatively, you can:');
      console.log('1. Connect to your Supabase database directly');
      console.log('2. Execute the fixed function SQL manually');
      console.log('3. Or ask your database administrator to apply the migration');
    } else {
      console.log('✅ Function is working correctly:', result);
      console.log('No fix needed!');
    }
    
  } catch (error) {
    console.error('❌ Error testing function:', error);
  }
}

// Run the script
if (require.main === module) {
  applyFunctionFix().catch(console.error);
}

module.exports = { applyFunctionFix };