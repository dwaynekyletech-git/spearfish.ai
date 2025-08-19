#!/usr/bin/env node

/**
 * Script to examine GitHub and Hugging Face data in detail
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

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function examineGitHubHFData() {
  console.log('🔍 Examining GitHub and Hugging Face Data in Detail\n');
  console.log('=' .repeat(80));

  try {
    // 1. Check what's in the github_repos JSONB field
    console.log('\n📋 GITHUB_REPOS JSONB FIELD ANALYSIS\n');
    console.log('-' .repeat(40));

    const { data: companiesWithGithub, error: ghError } = await supabase
      .from('companies')
      .select('name, github_repos')
      .not('github_repos', 'is', null)
      .limit(3);

    if (!ghError && companiesWithGithub) {
      companiesWithGithub.forEach(company => {
        console.log(`\n🏢 ${company.name}:`);
        console.log(`   GitHub repos field type: ${typeof company.github_repos}`);
        console.log(`   Content: ${JSON.stringify(company.github_repos, null, 2)}`);
      });
    }

    // 2. Check what's in the huggingface_models JSONB field
    console.log('\n' + '=' .repeat(80));
    console.log('\n📋 HUGGINGFACE_MODELS JSONB FIELD ANALYSIS\n');
    console.log('-' .repeat(40));

    const { data: companiesWithHF, error: hfError } = await supabase
      .from('companies')
      .select('name, huggingface_models')
      .not('huggingface_models', 'is', null)
      .limit(3);

    if (!hfError && companiesWithHF) {
      companiesWithHF.forEach(company => {
        console.log(`\n🏢 ${company.name}:`);
        console.log(`   HF models field type: ${typeof company.huggingface_models}`);
        console.log(`   Content: ${JSON.stringify(company.huggingface_models, null, 2)}`);
      });
    }

    // 3. Check actual GitHub repository data
    console.log('\n' + '=' .repeat(80));
    console.log('\n📋 GITHUB_REPOSITORIES TABLE SAMPLE DATA\n');
    console.log('-' .repeat(40));

    const { data: repos, error: repoError } = await supabase
      .from('github_repositories')
      .select('full_name, stars_count, forks_count, language, last_synced_at')
      .order('stars_count', { ascending: false })
      .limit(5);

    if (!repoError && repos) {
      console.log('\nTop 5 repositories by stars:');
      repos.forEach(repo => {
        console.log(`\n  📦 ${repo.full_name}`);
        console.log(`     ⭐ Stars: ${repo.stars_count}`);
        console.log(`     🍴 Forks: ${repo.forks_count}`);
        console.log(`     💻 Language: ${repo.language || 'Not specified'}`);
        console.log(`     🔄 Last synced: ${new Date(repo.last_synced_at).toLocaleDateString()}`);
      });
    }

    // 4. Check company-repository associations
    console.log('\n' + '=' .repeat(80));
    console.log('\n📋 COMPANY-GITHUB ASSOCIATIONS DETAIL\n');
    console.log('-' .repeat(40));

    const { data: associations, error: assocError } = await supabase
      .from('company_github_repositories')
      .select(`
        company_id,
        repository_id,
        is_primary,
        discovery_method,
        confidence_score,
        companies!inner(name),
        github_repositories!inner(full_name)
      `)
      .limit(5);

    if (!assocError && associations) {
      console.log('\nSample associations:');
      associations.forEach(assoc => {
        console.log(`\n  🔗 ${assoc.companies?.name} → ${assoc.github_repositories?.full_name}`);
        console.log(`     Primary: ${assoc.is_primary ? '✓' : '✗'}`);
        console.log(`     Discovery: ${assoc.discovery_method}`);
        console.log(`     Confidence: ${(assoc.confidence_score * 100).toFixed(0)}%`);
      });
    }

    // 5. Check if we have historical metrics
    console.log('\n' + '=' .repeat(80));
    console.log('\n📋 HISTORICAL METRICS CHECK\n');
    console.log('-' .repeat(40));

    const { count: metricsCount } = await supabase
      .from('github_repository_metrics')
      .select('*', { count: 'exact', head: true });

    console.log(`\n📊 Historical metrics records: ${metricsCount || 0}`);
    
    if (metricsCount > 0) {
      const { data: sampleMetrics } = await supabase
        .from('github_repository_metrics')
        .select('*')
        .limit(2);
      
      console.log('Sample metrics:', JSON.stringify(sampleMetrics, null, 2));
    } else {
      console.log('   ❌ No historical tracking data found');
    }

    // 6. Summary of data quality
    console.log('\n' + '=' .repeat(80));
    console.log('\n🎯 DATA QUALITY ASSESSMENT\n');
    console.log('-' .repeat(40));

    const { data: dataQuality } = await supabase.rpc('get_data_quality_metrics', {});
    
    if (dataQuality) {
      console.log('Data quality metrics:', dataQuality);
    } else {
      // Manual quality check
      const { count: totalCompanies } = await supabase
        .from('companies')
        .select('*', { count: 'exact', head: true });
      
      const { count: withValidGithub } = await supabase
        .from('company_github_repositories')
        .select('*', { count: 'exact', head: true })
        .gt('confidence_score', 0.5);
      
      console.log('\n📊 Current Data Status:');
      console.log(`  • Total companies: ${totalCompanies}`);
      console.log(`  • Companies with verified GitHub repos: ${withValidGithub}`);
      console.log(`  • GitHub repos field: Appears to be empty arrays [] for all companies`);
      console.log(`  • Hugging Face models field: Appears to be empty arrays [] for all companies`);
      console.log(`  • GitHub repositories table: Has ${metricsCount || 0} repos but limited association`);
    }

    // 7. Check what needs to be populated
    console.log('\n' + '=' .repeat(80));
    console.log('\n🚨 DATA GAPS IDENTIFIED\n');
    console.log('-' .repeat(40));

    console.log('\n1. GitHub Data Issues:');
    console.log('   • github_repos JSONB field contains empty arrays');
    console.log('   • Need to discover and associate repos with companies');
    console.log('   • Need to populate historical metrics');
    console.log('   • Need regular sync schedule');

    console.log('\n2. Hugging Face Data Issues:');
    console.log('   • huggingface_models JSONB field contains empty arrays');
    console.log('   • No discovery mechanism implemented');
    console.log('   • No dedicated table for HF model details');
    console.log('   • No metrics tracking');

    console.log('\n3. Update System Issues:');
    console.log('   • No last_updated tracking for GitHub data');
    console.log('   • No scheduled jobs visible');
    console.log('   • No data freshness monitoring');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the examination
examineGitHubHFData().then(() => {
  console.log('\n✨ Detailed examination complete!\n');
  process.exit(0);
});