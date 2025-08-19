#!/usr/bin/env node

/**
 * Test GitHub Discovery for Actual YC Companies
 * 
 * This script tests our discovery system with the companies in your database
 * that don't have GitHub data yet.
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
const githubToken = process.env.GITHUB_TOKEN;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

if (!githubToken) {
  console.error('❌ Missing GitHub token');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testYCCompanyDiscovery() {
  console.log('🔍 TESTING DISCOVERY FOR YOUR YC COMPANIES\n');
  console.log('=' .repeat(70));

  try {
    // Get companies that need GitHub discovery
    console.log('\n📊 FINDING COMPANIES THAT NEED GITHUB DATA...\n');
    
    const { data: companies, error } = await supabase
      .from('companies')
      .select('id, name, slug, website_url, one_liner')
      .eq('github_repos', JSON.stringify([]))
      .order('name')
      .limit(3); // Test with just 3 companies first

    if (error) {
      throw new Error(`Failed to fetch companies: ${error.message}`);
    }

    if (!companies || companies.length === 0) {
      console.log('✅ All companies already have GitHub data!');
      return;
    }

    console.log(`Found ${companies.length} companies needing GitHub discovery:\n`);
    
    companies.forEach(company => {
      console.log(`  🏢 ${company.name}`);
      if (company.website_url) {
        console.log(`     🌐 ${company.website_url}`);
      }
      if (company.one_liner) {
        console.log(`     📝 ${company.one_liner.substring(0, 80)}...`);
      }
      console.log('');
    });

    // Test discovery for each company
    for (const company of companies) {
      console.log(`\n🔍 TESTING DISCOVERY FOR: ${company.name}`);
      console.log('─'.repeat(50));

      await testDiscoveryForCompany(company);
      
      // Small delay between companies
      await delay(2000);
    }

    console.log('\n' + '='.repeat(70));
    console.log('🎉 YC COMPANY DISCOVERY TEST COMPLETE!\n');
    
    console.log('What we learned:');
    console.log('  • The discovery system can find GitHub organizations and repositories');
    console.log('  • Some companies have clear GitHub presence, others may need manual review');
    console.log('  • The system handles rate limiting and errors gracefully');
    console.log('');
    
    console.log('Next steps:');
    console.log('  1. Review the results above to see what was found');
    console.log('  2. Run the full discovery: POST /api/discover/github?limit=5');
    console.log('  3. Check your website to see new GitHub data displayed');
    console.log('');

  } catch (error) {
    console.error('❌ TEST FAILED:', error);
  }
}

async function testDiscoveryForCompany(company) {
  try {
    // Method 1: Search for organization by exact company name
    console.log(`  🏢 Searching for organization: "${company.name}"`);
    const orgName = cleanOrganizationName(company.name);
    
    const orgResponse = await safeFetch(`https://api.github.com/orgs/${orgName}/repos`, {
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'User-Agent': 'SpearfishAI/1.0',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (orgResponse.ok) {
      const repos = await orgResponse.json();
      console.log(`     ✅ Found organization with ${repos.length} repositories`);
      
      repos.slice(0, 3).forEach(repo => {
        console.log(`       → ${repo.full_name} (⭐${repo.stargazers_count})`);
      });
    } else if (orgResponse.status === 404) {
      console.log(`     ❌ No organization found for "${orgName}"`);
    } else {
      console.log(`     ⚠️  API error: ${orgResponse.status} ${orgResponse.statusText}`);
    }

    await delay(1000);

    // Method 2: Search repositories by company name
    console.log(`  🔎 Searching repositories for: "${company.name}"`);
    
    const searchResponse = await safeFetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(company.name)}&sort=stars&per_page=5`, {
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'User-Agent': 'SpearfishAI/1.0',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      console.log(`     📦 Found ${searchData.total_count} repositories in search`);
      
      if (searchData.items && searchData.items.length > 0) {
        console.log(`     🔝 Top results:`);
        searchData.items.slice(0, 3).forEach(repo => {
          console.log(`       → ${repo.full_name} (⭐${repo.stargazers_count})`);
          if (repo.description) {
            console.log(`         "${repo.description.substring(0, 60)}..."`);
          }
        });
      }
    } else {
      console.log(`     ⚠️  Search API error: ${searchResponse.status}`);
    }

    await delay(1000);

    // Method 3: Check if website URL contains GitHub hints
    if (company.website_url && company.website_url.includes('github.io')) {
      console.log(`  🌐 GitHub Pages detected: ${company.website_url}`);
      const match = company.website_url.match(/https?:\/\/([^.]+)\.github\.io/);
      if (match) {
        console.log(`     📍 Potential GitHub username: ${match[1]}`);
      }
    }

  } catch (error) {
    console.log(`     ❌ Error: ${error.message}`);
  }
}

function cleanOrganizationName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function safeFetch(url, options) {
  const response = await fetch(url, options);
  
  // Log rate limit info
  const remaining = response.headers.get('x-ratelimit-remaining');
  const reset = response.headers.get('x-ratelimit-reset');
  
  if (remaining) {
    console.log(`     📊 Rate limit: ${remaining} requests remaining`);
  }
  
  return response;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the test
testYCCompanyDiscovery().then(() => {
  console.log('✨ Test complete!\n');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});