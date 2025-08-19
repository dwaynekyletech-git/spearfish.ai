const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRLSPolicies() {
  console.log('🔍 Checking RLS Policies on score_history table\n');

  try {
    // Check if RLS is enabled
    const { data: rlsStatus, error: rlsError } = await supabase
      .from('pg_tables')
      .select('schemaname, tablename, rowsecurity')
      .eq('tablename', 'score_history');

    if (rlsError) {
      console.log('❌ Error checking RLS status:', rlsError);
    } else {
      console.log('📋 RLS Status:', rlsStatus);
    }

    // Check existing policies
    const { data: policies, error: policiesError } = await supabase.rpc('exec_sql', {
      query: `
        SELECT 
          pol.policyname,
          pol.permissive,
          pol.roles,
          pol.cmd,
          pol.qual,
          pol.with_check
        FROM pg_policies pol 
        WHERE pol.tablename = 'score_history'
        ORDER BY pol.policyname;
      `
    });

    if (policiesError) {
      console.log('❌ Error checking policies:', policiesError);
      
      // Try alternative approach
      const { data: altPolicies, error: altError } = await supabase
        .from('information_schema.table_privileges')
        .select('*')
        .eq('table_name', 'score_history');
        
      console.log('📋 Table privileges:', altPolicies);
    } else {
      console.log('📋 Existing Policies:', policies);
    }

    // Test current user access
    console.log('\n🧪 Testing Current User Access:');
    
    // Test with service role
    const { data: serviceData, error: serviceError } = await supabase
      .from('score_history')
      .select('count')
      .limit(1);
      
    console.log(`Service Role Access: ${serviceError ? '❌ ' + serviceError.message : '✅ Success'}`);

  } catch (error) {
    console.error('❌ Check failed:', error);
  }
}

checkRLSPolicies().catch(console.error);