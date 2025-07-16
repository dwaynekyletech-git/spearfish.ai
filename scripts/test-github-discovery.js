/**
 * Simple GitHub Auto-Discovery Test Script
 * 
 * This script demonstrates the GitHub discovery process with a simpler approach
 */

require('dotenv').config();
const { Octokit } = require('@octokit/rest');

// GitHub service simplified for testing
class SimpleGitHubService {
  constructor() {
    const token = process.env.GITHUB_TOKEN;
    
    if (!token) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }

    this.octokit = new Octokit({
      auth: token,
    });
  }

  async searchOrganizations(query) {
    try {
      const response = await this.octokit.search.users({
        q: `${query} type:org`,
        per_page: 5,
      });
      
      return response.data.items;
    } catch (error) {
      console.error('Error searching organizations:', error.message);
      return [];
    }
  }

  async searchRepositories(query) {
    try {
      const response = await this.octokit.search.repos({
        q: query,
        sort: 'stars',
        order: 'desc',
        per_page: 5,
      });
      
      return response.data.items;
    } catch (error) {
      console.error('Error searching repositories:', error.message);
      return [];
    }
  }
}

// Test discovery for a few well-known companies
async function testDiscovery() {
  const github = new SimpleGitHubService();
  
  const testCompanies = [
    'Stripe',
    'Vercel', 
    'OpenAI',
    'Supabase',
    'Clerk'
  ];

  console.log('🔍 Testing GitHub Discovery for Y Combinator companies...\n');

  for (const company of testCompanies) {
    console.log(`\n📦 Testing: ${company}`);
    console.log('═'.repeat(50));
    
    // Search for organizations
    console.log('\n🏢 Organizations:');
    const orgs = await github.searchOrganizations(company);
    orgs.forEach(org => {
      console.log(`  ✓ ${org.login} (${org.html_url})`);
    });
    
    // Search for repositories
    console.log('\n📂 Top Repositories:');
    const repos = await github.searchRepositories(company);
    repos.slice(0, 3).forEach(repo => {
      console.log(`  ⭐ ${repo.full_name} - ${repo.stargazers_count} stars`);
      console.log(`     ${repo.description || 'No description'}`);
    });
    
    // Wait a bit to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n✅ Discovery test completed!');
  console.log('\nNext steps:');
  console.log('1. Review the results above');
  console.log('2. Identify which organizations/repos belong to each company');
  console.log('3. The auto-discovery script will use similar logic to automatically link repos');
}

// Run the test
if (require.main === module) {
  testDiscovery().catch(console.error);
}

module.exports = { testDiscovery };