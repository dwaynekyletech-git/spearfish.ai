/**
 * Run GitHub Auto-Discovery on Existing Companies
 * 
 * This script will find GitHub repositories for companies in your database
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { Octokit } = require('@octokit/rest');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize GitHub client
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

class GitHubDiscovery {
  async discoverForCompany(company) {
    console.log(`\n🔍 Discovering GitHub repos for: ${company.name}`);
    
    const discoveries = [];
    
    // Strategy 1: Search for organizations with exact company name
    try {
      const orgSearch = await octokit.search.users({
        q: `${company.name} type:org`,
        per_page: 5,
      });
      
      for (const org of orgSearch.data.items) {
        const confidence = this.calculateNameSimilarity(company.name, org.login);
        if (confidence > 0.7) {
          discoveries.push({
            type: 'organization',
            name: org.login,
            url: org.html_url,
            confidence: confidence,
            method: 'org_search'
          });
          
          // Get top repos from this org
          const repos = await octokit.repos.listForOrg({
            org: org.login,
            sort: 'stars',
            direction: 'desc',
            per_page: 3
          });
          
          for (const repo of repos.data) {
            discoveries.push({
              type: 'repository',
              owner: repo.owner.login,
              name: repo.name,
              full_name: repo.full_name,
              stars: repo.stargazers_count,
              url: repo.html_url,
              confidence: confidence,
              method: 'org_repos',
              description: repo.description
            });
          }
        }
      }
    } catch (error) {
      console.log(`  ⚠️  Org search failed: ${error.message}`);
    }
    
    // Strategy 2: Direct repository search
    try {
      const repoSearch = await octokit.search.repos({
        q: company.name,
        sort: 'stars',
        order: 'desc',
        per_page: 5
      });
      
      for (const repo of repoSearch.data.items) {
        const ownerConfidence = this.calculateNameSimilarity(company.name, repo.owner.login);
        const repoConfidence = this.calculateNameSimilarity(company.name, repo.name);
        const confidence = Math.max(ownerConfidence, repoConfidence * 0.8);
        
        if (confidence > 0.6) {
          discoveries.push({
            type: 'repository',
            owner: repo.owner.login,
            name: repo.name,
            full_name: repo.full_name,
            stars: repo.stargazers_count,
            url: repo.html_url,
            confidence: confidence,
            method: 'repo_search',
            description: repo.description
          });
        }
      }
    } catch (error) {
      console.log(`  ⚠️  Repo search failed: ${error.message}`);
    }
    
    // Remove duplicates and sort by confidence
    const uniqueDiscoveries = this.deduplicateByFullName(discoveries);
    const sortedDiscoveries = uniqueDiscoveries
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);
    
    return sortedDiscoveries;
  }
  
  calculateNameSimilarity(name1, name2) {
    const clean1 = name1.toLowerCase().replace(/[^a-z0-9]/g, '');
    const clean2 = name2.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (clean1 === clean2) return 1.0;
    if (clean1.includes(clean2) || clean2.includes(clean1)) return 0.9;
    
    // Simple similarity calculation
    const longer = clean1.length > clean2.length ? clean1 : clean2;
    const shorter = clean1.length > clean2.length ? clean2 : clean1;
    const editDistance = this.levenshteinDistance(longer, shorter);
    const similarity = (longer.length - editDistance) / longer.length;
    
    return Math.max(0, similarity);
  }
  
  levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  }
  
  deduplicateByFullName(discoveries) {
    const seen = new Map();
    for (const discovery of discoveries) {
      const key = discovery.full_name || `${discovery.owner}/${discovery.name}` || discovery.name;
      if (!seen.has(key) || discovery.confidence > seen.get(key).confidence) {
        seen.set(key, discovery);
      }
    }
    return Array.from(seen.values());
  }
  
  async storeRepository(repoDiscovery, companyId) {
    try {
      // First, store the repository
      const { data: existingRepo } = await supabase
        .from('github_repositories')
        .select('id')
        .eq('full_name', repoDiscovery.full_name)
        .single();
      
      let repositoryId;
      
      if (existingRepo) {
        repositoryId = existingRepo.id;
        console.log(`    📦 Repository ${repoDiscovery.full_name} already exists`);
      } else {
        // Create new repository record
        const { data: newRepo, error: repoError } = await supabase
          .from('github_repositories')
          .insert({
            github_id: Math.floor(Math.random() * 1000000), // Temporary ID
            full_name: repoDiscovery.full_name,
            name: repoDiscovery.name,
            owner: repoDiscovery.owner,
            description: repoDiscovery.description,
            html_url: repoDiscovery.url,
            stars_count: repoDiscovery.stars,
            forks_count: 0, // Will be updated by sync
            open_issues_count: 0,
            size: 0,
            created_at_github: new Date().toISOString(),
            updated_at_github: new Date().toISOString(),
            pushed_at_github: new Date().toISOString(),
            archived: false,
            disabled: false,
            last_synced_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (repoError) {
          console.error(`    ❌ Error storing repository:`, repoError.message);
          return false;
        }
        
        repositoryId = newRepo.id;
        console.log(`    ✅ Stored new repository: ${repoDiscovery.full_name}`);
      }
      
      // Associate with company
      const { error: associationError } = await supabase
        .from('company_github_repositories')
        .upsert({
          company_id: companyId,
          repository_id: repositoryId,
          is_primary: repoDiscovery.confidence >= 0.9,
          confidence_score: repoDiscovery.confidence,
          discovery_method: repoDiscovery.method
        }, {
          onConflict: 'company_id,repository_id'
        });
      
      if (associationError) {
        console.error(`    ❌ Error associating repository:`, associationError.message);
        return false;
      }
      
      console.log(`    🔗 Associated ${repoDiscovery.full_name} with company (confidence: ${repoDiscovery.confidence.toFixed(2)})`);
      return true;
    } catch (error) {
      console.error(`    ❌ Error in storeRepository:`, error.message);
      return false;
    }
  }
}

async function runDiscoveryForAllCompanies() {
  console.log('🚀 Starting GitHub Auto-Discovery for all companies...\n');
  
  const discovery = new GitHubDiscovery();
  
  // Get companies that don't have GitHub repos yet
  const { data: companies, error } = await supabase
    .from('companies')
    .select(`
      id, 
      name,
      company_github_repositories(id)
    `)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('❌ Error fetching companies:', error);
    return;
  }
  
  console.log(`📊 Found ${companies.length} companies in database`);
  
  // Filter companies without GitHub repos
  const companiesWithoutRepos = companies.filter(company => 
    !company.company_github_repositories || company.company_github_repositories.length === 0
  );
  
  console.log(`🎯 ${companiesWithoutRepos.length} companies need GitHub discovery\n`);
  
  for (const company of companiesWithoutRepos.slice(0, 10)) { // Limit to first 10 for testing
    const discoveries = await discovery.discoverForCompany(company);
    
    if (discoveries.length === 0) {
      console.log(`  ❌ No repositories found for ${company.name}`);
      continue;
    }
    
    console.log(`  📋 Found ${discoveries.length} potential matches:`);
    
    let storedCount = 0;
    for (const repo of discoveries) {
      if (repo.type === 'repository') {
        if (repo.confidence >= 0.8) {
          const success = await discovery.storeRepository(repo, company.id);
          if (success) storedCount++;
        } else {
          console.log(`    🤔 ${repo.full_name} (confidence: ${repo.confidence.toFixed(2)}) - needs manual review`);
        }
      }
    }
    
    console.log(`  ✅ Auto-approved and stored ${storedCount} repositories`);
    
    // Rate limiting pause
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n🎉 GitHub discovery completed!');
  console.log('\nNext steps:');
  console.log('1. Check your database for new GitHub repository associations');
  console.log('2. Review companies in the UI to see GitHub data');
  console.log('3. Run the GitHub sync service to get detailed metrics');
}

// Run the discovery
if (require.main === module) {
  runDiscoveryForAllCompanies().catch(console.error);
}

module.exports = { runDiscoveryForAllCompanies };