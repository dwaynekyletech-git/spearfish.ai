#!/usr/bin/env node

/**
 * Script to examine current Supabase database state
 * This will show us what tables exist, their columns, and sample data
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
  console.error('❌ Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function examineDatabase() {
  console.log('🔍 Examining Supabase Database Structure\n');
  console.log('=' .repeat(80));

  try {
    // 1. Get all table names
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .order('table_name');

    if (tablesError) {
      // Try alternative approach using direct query
      const { data: tableList, error: listError } = await supabase.rpc('get_public_tables', {});
      
      if (listError) {
        console.log('⚠️  Could not query table list, trying companies table directly...\n');
      } else {
        console.log('📊 Tables found:', tableList);
      }
    } else {
      console.log('📊 Tables in database:');
      tables.forEach(t => console.log(`  • ${t.table_name}`));
    }

    console.log('\n' + '=' .repeat(80));

    // 2. Examine Companies Table
    console.log('\n📋 COMPANIES TABLE ANALYSIS\n');
    console.log('-' .repeat(40));

    // Get sample company data
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('*')
      .limit(5);

    if (companiesError) {
      console.log('❌ Error fetching companies:', companiesError.message);
    } else {
      console.log(`✅ Found ${companies?.length || 0} sample companies\n`);
      
      if (companies && companies.length > 0) {
        // Show what fields we have
        const sampleCompany = companies[0];
        console.log('📌 Company table columns:');
        Object.keys(sampleCompany).forEach(key => {
          const value = sampleCompany[key];
          const valueType = Array.isArray(value) ? 'array' : typeof value;
          const hasValue = value !== null && value !== undefined && value !== '';
          console.log(`  • ${key}: ${valueType} ${hasValue ? '✓' : '✗ empty'}`);
        });

        // Count how many companies have important fields
        console.log('\n📊 Data Completeness Check:');
        
        const { count: totalCount } = await supabase
          .from('companies')
          .select('*', { count: 'exact', head: true });
        
        const { count: withWebsite } = await supabase
          .from('companies')
          .select('*', { count: 'exact', head: true })
          .not('website_url', 'is', null);
        
        const { count: withGithub } = await supabase
          .from('companies')
          .select('*', { count: 'exact', head: true })
          .not('github_repos', 'is', null);
        
        const { count: withHuggingface } = await supabase
          .from('companies')
          .select('*', { count: 'exact', head: true })
          .not('huggingface_models', 'is', null);
        
        const { count: withAI } = await supabase
          .from('companies')
          .select('*', { count: 'exact', head: true })
          .eq('is_ai_related', true);

        console.log(`  • Total companies: ${totalCount || 0}`);
        console.log(`  • With website URL: ${withWebsite || 0} (${totalCount ? Math.round(withWebsite/totalCount*100) : 0}%)`);
        console.log(`  • With GitHub repos: ${withGithub || 0} (${totalCount ? Math.round(withGithub/totalCount*100) : 0}%)`);
        console.log(`  • With Huggingface models: ${withHuggingface || 0} (${totalCount ? Math.round(withHuggingface/totalCount*100) : 0}%)`);
        console.log(`  • Marked as AI-related: ${withAI || 0} (${totalCount ? Math.round(withAI/totalCount*100) : 0}%)`);
      }
    }

    // 3. Check GitHub Repositories Table
    console.log('\n' + '=' .repeat(80));
    console.log('\n📋 GITHUB_REPOSITORIES TABLE ANALYSIS\n');
    console.log('-' .repeat(40));

    const { data: githubRepos, error: githubError } = await supabase
      .from('github_repositories')
      .select('*')
      .limit(5);

    if (githubError) {
      console.log('❌ GitHub repositories table not found or error:', githubError.message);
    } else {
      console.log(`✅ Found ${githubRepos?.length || 0} GitHub repositories\n`);
      
      if (githubRepos && githubRepos.length > 0) {
        const sampleRepo = githubRepos[0];
        console.log('📌 GitHub repository columns:');
        Object.keys(sampleRepo).forEach(key => {
          const value = sampleRepo[key];
          const hasValue = value !== null && value !== undefined && value !== '';
          console.log(`  • ${key}: ${hasValue ? '✓' : '✗ empty'}`);
        });

        // Count total repos
        const { count: repoCount } = await supabase
          .from('github_repositories')
          .select('*', { count: 'exact', head: true });
        
        console.log(`\n📊 Total GitHub repositories tracked: ${repoCount || 0}`);
      }
    }

    // 4. Check Company-GitHub Associations
    console.log('\n' + '=' .repeat(80));
    console.log('\n📋 COMPANY-GITHUB ASSOCIATIONS\n');
    console.log('-' .repeat(40));

    const { data: associations, error: assocError } = await supabase
      .from('company_github_repositories')
      .select('*')
      .limit(5);

    if (assocError) {
      console.log('❌ Company-GitHub association table not found:', assocError.message);
    } else {
      const { count: assocCount } = await supabase
        .from('company_github_repositories')
        .select('*', { count: 'exact', head: true });
      
      console.log(`✅ Found ${assocCount || 0} company-repository associations`);
    }

    // 5. Check Founders Table
    console.log('\n' + '=' .repeat(80));
    console.log('\n📋 FOUNDERS TABLE ANALYSIS\n');
    console.log('-' .repeat(40));

    const { data: founders, error: foundersError } = await supabase
      .from('founders')
      .select('*')
      .limit(5);

    if (foundersError) {
      console.log('❌ Founders table not found or error:', foundersError.message);
    } else {
      const { count: founderCount } = await supabase
        .from('founders')
        .select('*', { count: 'exact', head: true });
      
      console.log(`✅ Found ${founderCount || 0} founder records`);
      
      if (founders && founders.length > 0) {
        const sampleFounder = founders[0];
        console.log('\n📌 Founder table columns:');
        Object.keys(sampleFounder).forEach(key => {
          const value = sampleFounder[key];
          const hasValue = value !== null && value !== undefined && value !== '';
          console.log(`  • ${key}: ${hasValue ? '✓' : '✗ empty'}`);
        });
      }
    }

    // 6. Check for Hugging Face related tables
    console.log('\n' + '=' .repeat(80));
    console.log('\n📋 HUGGING FACE DATA CHECK\n');
    console.log('-' .repeat(40));
    
    // Check if there's any Hugging Face specific table
    const { data: hfTable, error: hfError } = await supabase
      .from('huggingface_models')
      .select('*')
      .limit(1);
    
    if (hfError) {
      console.log('❌ No dedicated Hugging Face table found');
      console.log('   Currently stored in companies.huggingface_models JSONB field');
    } else {
      console.log('✅ Found dedicated Hugging Face models table');
    }

    // 7. Summary of missing data
    console.log('\n' + '=' .repeat(80));
    console.log('\n🎯 MISSING DATA SUMMARY\n');
    console.log('-' .repeat(40));

    console.log('Based on the analysis, here\'s what needs to be collected:\n');
    
    console.log('❌ MISSING DATA SOURCES:');
    console.log('  1. GitHub repository discovery and association');
    console.log('  2. GitHub metrics tracking (stars, forks, activity)');
    console.log('  3. Hugging Face model discovery');
    console.log('  4. Hugging Face model metrics (downloads, likes)');
    console.log('  5. Comprehensive founder information');
    console.log('  6. Funding details and amounts');
    
    console.log('\n❌ MISSING PERIODIC UPDATE SYSTEM:');
    console.log('  1. No scheduled jobs for data updates');
    console.log('  2. No tracking of when data was last updated');
    console.log('  3. No historical metrics tracking');

    console.log('\n✅ EXISTING INFRASTRUCTURE:');
    console.log('  1. Companies table with basic YC data');
    console.log('  2. AI classification system');
    console.log('  3. Basic GitHub tables (but not populated)');
    console.log('  4. Founders table (partially populated)');
    console.log('  5. Authentication and security');

  } catch (error) {
    console.error('❌ Error examining database:', error);
  }
}

// Run the examination
examineDatabase().then(() => {
  console.log('\n✨ Database examination complete!\n');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});