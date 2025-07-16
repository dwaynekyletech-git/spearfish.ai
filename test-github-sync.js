/**
 * Test script for GitHub sync functionality
 */

const { githubStorageService } = require('./src/lib/github-storage-service.ts');

async function testGitHubSync() {
  try {
    console.log('Testing GitHub sync with microsoft/TypeScript...');
    
    // Fetch and store the TypeScript repository
    const result = await githubStorageService.fetchAndStoreRepository('microsoft', 'TypeScript');
    
    if (!result.success) {
      console.error('Failed to sync repository:', result.error);
      return;
    }
    
    console.log('Repository synced successfully!');
    console.log('Repository ID:', result.repositoryId);
    
    // Associate with a test company (using the company ID from the URL)
    const companyId = 'f41749c8-2431-44f9-a123-835dfc18c477';
    
    const association = await githubStorageService.associateRepositoryWithCompany(
      result.repositoryId,
      companyId,
      {
        isPrimary: true,
        confidenceScore: 1.0,
        discoveryMethod: 'test',
      }
    );
    
    if (!association.success) {
      console.error('Failed to associate repository:', association.error);
      return;
    }
    
    console.log('Repository associated with company successfully!');
    console.log('Company ID:', companyId);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testGitHubSync();