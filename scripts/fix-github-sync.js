#!/usr/bin/env node

/**
 * CRITICAL FIX SCRIPT
 * 
 * This script will immediately sync your existing GitHub repository data
 * to the companies table so your website can display it properly.
 * 
 * Run this script to fix the empty github_repos fields!
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixGitHubSync() {
  console.log('🔧 CRITICAL FIX: Syncing GitHub Data to Companies Table\n');
  console.log('=' .repeat(70));

  try {
    // Step 1: Check current state
    console.log('\n📊 CHECKING CURRENT STATE...\n');
    
    const { count: totalCompanies } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true });

    const { count: emptyGithubCompanies } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .eq('github_repos', JSON.stringify([]));

    const { count: totalAssociations } = await supabase
      .from('company_github_repositories')
      .select('*', { count: 'exact', head: true });

    console.log(`  • Total companies: ${totalCompanies}`);
    console.log(`  • Companies with empty github_repos: ${emptyGithubCompanies}`);
    console.log(`  • Total GitHub associations available: ${totalAssociations}`);
    
    if (emptyGithubCompanies === 0) {
      console.log('\n✅ All companies already have GitHub data synced!');
      return;
    }

    console.log(`\n🚨 PROBLEM: ${emptyGithubCompanies} companies have empty GitHub data but ${totalAssociations} associations exist!`);

    // Step 2: Get associations to sync
    console.log('\n🔄 GATHERING GITHUB DATA TO SYNC...\n');

    const { data: associations, error } = await supabase
      .from('company_github_repositories')
      .select(`
        company_id,
        companies!inner(id, name),
        github_repositories!inner(
          full_name,
          html_url,
          description,
          stars_count,
          forks_count,
          language,
          last_synced_at
        ),
        is_primary,
        confidence_score
      `)
      .order('company_id')
      .order('is_primary', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch associations: ${error.message}`);
    }

    // Step 3: Group by company
    const companiesMap = new Map();
    
    associations.forEach(assoc => {
      const companyId = assoc.company_id;
      
      if (!companiesMap.has(companyId)) {
        companiesMap.set(companyId, {
          company: assoc.companies,
          repos: []
        });
      }

      companiesMap.get(companyId).repos.push({
        full_name: assoc.github_repositories.full_name,
        html_url: assoc.github_repositories.html_url,
        description: assoc.github_repositories.description,
        stars_count: assoc.github_repositories.stars_count,
        forks_count: assoc.github_repositories.forks_count,
        language: assoc.github_repositories.language,
        is_primary: assoc.is_primary,
        last_synced: assoc.github_repositories.last_synced_at
      });
    });

    console.log(`  • Found ${companiesMap.size} companies with GitHub repos to sync`);

    // Step 4: Update each company
    console.log('\n🔄 SYNCING DATA TO COMPANIES TABLE...\n');
    
    let updated = 0;
    let errors = 0;

    for (const [companyId, data] of companiesMap) {
      try {
        const { error: updateError } = await supabase
          .from('companies')
          .update({
            github_repos: data.repos,
            updated_at: new Date().toISOString()
          })
          .eq('id', companyId);

        if (updateError) {
          console.log(`  ❌ Error updating ${data.company.name}: ${updateError.message}`);
          errors++;
        } else {
          console.log(`  ✅ Updated ${data.company.name} with ${data.repos.length} repos`);
          updated++;
        }
      } catch (error) {
        console.log(`  ❌ Exception updating ${data.company.name}: ${error.message}`);
        errors++;
      }
    }

    // Step 5: Verify the fix
    console.log('\n📊 VERIFYING THE FIX...\n');
    
    const { count: stillEmptyCompanies } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .eq('github_repos', JSON.stringify([]));

    const { count: nowWithGithubData } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .not('github_repos', 'eq', JSON.stringify([]));

    console.log(`  • Companies updated: ${updated}`);
    console.log(`  • Update errors: ${errors}`);
    console.log(`  • Companies still with empty GitHub data: ${stillEmptyCompanies}`);
    console.log(`  • Companies now with GitHub data: ${nowWithGithubData}`);

    // Step 6: Show sample data
    console.log('\n🔍 SAMPLE OF SYNCED DATA...\n');
    
    const { data: sampleCompanies } = await supabase
      .from('companies')
      .select('name, github_repos')
      .not('github_repos', 'eq', JSON.stringify([]))
      .limit(3);

    sampleCompanies?.forEach(company => {
      console.log(`  📦 ${company.name}:`);
      company.github_repos.forEach(repo => {
        console.log(`    → ${repo.full_name} (⭐${repo.stars_count})`);
      });
      console.log('');
    });

    // Final summary
    console.log('=' .repeat(70));
    if (errors === 0 && updated > 0) {
      console.log('🎉 SUCCESS! GitHub data sync completed perfectly!');
      console.log(`✅ ${updated} companies now have GitHub data in the companies table`);
      console.log('✅ Your website will now be able to display GitHub information!');
    } else if (updated > 0) {
      console.log('⚠️  PARTIAL SUCCESS! GitHub data sync completed with some issues');
      console.log(`✅ ${updated} companies updated successfully`);
      console.log(`❌ ${errors} companies had errors`);
    } else {
      console.log('❌ FAILED! No companies were updated');
    }

    console.log('\n🚀 Next steps:');
    console.log('  1. Test your website - GitHub data should now display');
    console.log('  2. Build Hugging Face discovery system');
    console.log('  3. Set up periodic updates');
    console.log('');

  } catch (error) {
    console.error('❌ CRITICAL ERROR:', error);
    process.exit(1);
  }
}

// Run the fix
fixGitHubSync().then(() => {
  console.log('✨ Fix script complete!\n');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});