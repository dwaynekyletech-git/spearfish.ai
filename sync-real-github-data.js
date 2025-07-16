/**
 * Manual GitHub sync script to populate real repository data
 * 
 * This script fetches real GitHub repositories for known companies
 * Run with: node sync-real-github-data.js
 */

const { GitHubStorageService } = require('./src/lib/github-storage-service');
const { GitHubService } = require('./src/lib/github-service');

// Known Y Combinator companies with their GitHub repositories
const COMPANY_REPOS = [
  {
    companyId: 'f41749c8-2431-44f9-a123-835dfc18c477', // Replace with actual company ID
    repositories: [
      { owner: 'stripe', repo: 'stripe-cli' },
      { owner: 'stripe', repo: 'stripe-js' },
    ]
  },
  // Add more companies as needed
  {
    companyId: 'some-other-company-id',
    repositories: [
      { owner: 'vercel', repo: 'next.js' },
      { owner: 'vercel', repo: 'turborepo' },
    ]
  }
];

async function syncRealGitHubData() {
  console.log('🚀 Starting real GitHub data sync...');
  
  const githubService = new GitHubService();
  const storageService = new GitHubStorageService();
  
  for (const company of COMPANY_REPOS) {
    console.log(`\n📦 Processing company: ${company.companyId}`);
    
    for (const repoInfo of company.repositories) {
      try {
        console.log(`  📥 Syncing ${repoInfo.owner}/${repoInfo.repo}...`);
        
        // Fetch repository data from GitHub API
        const result = await storageService.fetchAndStoreRepository(
          repoInfo.owner, 
          repoInfo.repo
        );
        
        if (!result.success) {
          console.error(`  ❌ Failed to sync repository: ${result.error}`);
          continue;
        }
        
        console.log(`  ✅ Repository synced: ${result.repositoryId}`);
        
        // Associate with company
        const association = await storageService.associateRepositoryWithCompany(
          result.repositoryId,
          company.companyId,
          {
            isPrimary: true,
            confidenceScore: 1.0,
            discoveryMethod: 'manual',
          }
        );
        
        if (!association.success) {
          console.error(`  ❌ Failed to associate repository: ${association.error}`);
          continue;
        }
        
        console.log(`  🔗 Repository associated with company`);
        
      } catch (error) {
        console.error(`  ❌ Error syncing ${repoInfo.owner}/${repoInfo.repo}:`, error.message);
      }
    }
  }
  
  console.log('\n🎉 GitHub data sync completed!');
}

// Check if GitHub token is available
if (!process.env.GITHUB_TOKEN) {
  console.error('❌ GITHUB_TOKEN environment variable is required');
  process.exit(1);
}

// Run the sync
syncRealGitHubData().catch(error => {
  console.error('💥 Sync failed:', error);
  process.exit(1);
});