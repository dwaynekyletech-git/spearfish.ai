const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyRLSFix() {
  console.log('🔧 Applying RLS Fix for score_history table\n');

  try {
    // Read the migration file
    const migration = fs.readFileSync('supabase/migrations/20250119_fix_score_history_rls.sql', 'utf8');
    
    console.log('📋 Applying migration...');
    
    // Split by semicolons and execute each statement
    const statements = migration
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt && !stmt.startsWith('--') && stmt !== '');

    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`Executing: ${statement.slice(0, 50)}...`);
        
        const { error } = await supabase.rpc('exec_sql', {
          query: statement + ';'
        });
        
        if (error) {
          console.log(`❌ Error: ${error.message}`);
          // Continue with other statements
        } else {
          console.log('✅ Success');
        }
      }
    }

    console.log('\n🧪 Testing access after fix...');
    
    // Test anon access
    const anonSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Get Struct company ID
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name')
      .ilike('name', '%struct%')
      .limit(1);

    if (companies && companies.length > 0) {
      const struct = companies[0];
      
      const { data: anonHistory, error: anonError } = await anonSupabase
        .from('score_history')
        .select('*')
        .eq('company_id', struct.id)
        .limit(1);

      if (anonError) {
        console.log('❌ Anon access still blocked:', anonError.message);
      } else {
        console.log(`✅ Anon access now works - found ${(anonHistory || []).length} records`);
        
        if (anonHistory && anonHistory.length > 0) {
          console.log('🎉 Score breakdown should now display correctly in frontend!');
        }
      }
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

applyRLSFix().catch(console.error);