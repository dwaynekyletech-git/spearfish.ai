/**
 * API Route: Test GitHub Storage Service
 * 
 * Test endpoint to verify GitHub repository fetching and storage functionality
 */

import { NextRequest, NextResponse } from 'next/server';
import { githubStorageService } from '@/lib/github-storage-service';
import { githubService } from '@/lib/github-service';

export async function GET(request: NextRequest) {
  try {
    console.log('Testing GitHub storage service...');

    // Test 1: Check rate limit first
    const rateLimit = await githubService.getRateLimit();
    console.log('Rate limit:', rateLimit.remaining, 'remaining');

    if (rateLimit.remaining < 10) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient GitHub API rate limit for testing',
        rateLimit: rateLimit,
        timestamp: new Date().toISOString(),
      }, { status: 429 });
    }

    // Test 2: Fetch and store a well-known repository
    const testRepo = 'microsoft/vscode';
    const [owner, repo] = testRepo.split('/');
    
    console.log(`Fetching and storing ${testRepo}...`);
    const fetchResult = await githubStorageService.fetchAndStoreRepository(owner, repo);

    if (!fetchResult.success) {
      throw new Error(`Failed to fetch and store repository: ${fetchResult.error}`);
    }

    const { repository, metrics, languages } = fetchResult.data!;
    console.log('✅ Repository stored:', repository.full_name, 'ID:', repository.id);

    // Test 3: Retrieve the stored repository with metrics
    console.log('Retrieving stored repository with metrics...');
    const retrieveResult = await githubStorageService.getRepositoryWithMetrics(repository.id);

    if (!retrieveResult.success) {
      throw new Error(`Failed to retrieve repository: ${retrieveResult.error}`);
    }

    console.log('✅ Repository retrieved with', retrieveResult.data!.languages.length, 'languages');

    // Test 4: Try to fetch a private/non-existent repository to test error handling
    console.log('Testing error handling with non-existent repository...');
    const errorResult = await githubStorageService.fetchAndStoreRepository('nonexistent', 'repo');
    console.log('✅ Error handling works:', !errorResult.success ? 'PASS' : 'FAIL');

    // Test 5: Test batch repository storage for a mock company
    console.log('Testing batch repository storage...');
    
    // Create a test company first or use existing one
    const { createServerClient } = await import('@/lib/supabase-server');
    const supabase = await createServerClient();
    
    const { data: testCompany } = await supabase
      .from('companies')
      .select('id, name')
      .limit(1)
      .single();

    let batchResult = null;
    if (testCompany) {
      // Test with smaller repositories to save API calls
      const testRepos = ['octocat/Hello-World', 'github/docs'];
      batchResult = await githubStorageService.fetchAndStoreCompanyRepositories(
        testCompany.id,
        testRepos,
        {
          discoveryMethod: 'api',
          markPrimary: 'github/docs'
        }
      );
      console.log('✅ Batch storage result:', batchResult.successful, 'successful,', batchResult.failed, 'failed');
    }

    // Test 6: Get company repositories
    let companyRepos = null;
    if (testCompany) {
      const companyReposResult = await githubStorageService.getCompanyRepositories(testCompany.id);
      companyRepos = companyReposResult.success ? companyReposResult.data : null;
      console.log('✅ Company repositories retrieved:', companyRepos?.length || 0, 'repos');
    }

    // Test 7: Check final rate limit
    const finalRateLimit = await githubService.getRateLimit();
    console.log('Final rate limit:', finalRateLimit.remaining, 'remaining');

    return NextResponse.json({
      success: true,
      message: 'GitHub storage service working correctly',
      data: {
        rateLimit: {
          initial: rateLimit.remaining,
          final: finalRateLimit.remaining,
          used: rateLimit.remaining - finalRateLimit.remaining,
        },
        repositoryStorage: {
          repository: {
            id: repository.id,
            fullName: repository.full_name,
            stars: repository.stars_count,
            languages: languages.length,
          },
          metrics: {
            stars: metrics.stars_count,
            forks: metrics.forks_count,
            contributors: metrics.contributors_count,
            releases: metrics.releases_count,
          },
          topLanguages: languages.slice(0, 3).map(l => ({
            language: l.language,
            percentage: l.percentage
          })),
        },
        errorHandling: {
          nonExistentRepo: !errorResult.success,
          errorMessage: errorResult.error?.includes('not found') ? 'Correct error type' : 'Unexpected error',
        },
        batchStorage: batchResult ? {
          total: batchResult.total,
          successful: batchResult.successful,
          failed: batchResult.failed,
          hasErrors: batchResult.errors.length > 0,
        } : 'Skipped - no test company',
        companyAssociation: {
          testCompany: testCompany?.name || 'none found',
          repositoriesFound: companyRepos?.length || 0,
        },
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('GitHub storage test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    }, { 
      status: 500 
    });
  }
}