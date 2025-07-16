/**
 * API Route: Test GitHub Integration
 * 
 * Test endpoint to verify GitHub API connectivity and authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { githubService } from '@/lib/github-service';

export async function GET(request: NextRequest) {
  try {
    console.log('Testing GitHub API connectivity...');

    // Test 1: Check rate limit status
    const rateLimit = await githubService.getRateLimit();
    console.log('Rate limit check:', rateLimit);

    // Test 2: Get a well-known repository (GitHub's own repo)
    const testRepo = await githubService.getRepository('github', 'docs');
    console.log('Test repository fetch:', testRepo.name, testRepo.stars_count, 'stars');

    // Test 3: Get repository stats
    const repoStats = await githubService.getRepositoryStats('github', 'docs');
    console.log('Repository stats:', {
      contributors: repoStats.contributors_count,
      releases: repoStats.releases_count,
      languages: Object.keys(repoStats.languages).slice(0, 3)
    });

    return NextResponse.json({
      success: true,
      message: 'GitHub API integration working correctly',
      data: {
        rateLimit: {
          remaining: rateLimit.remaining,
          limit: rateLimit.limit,
          resetTime: new Date(rateLimit.reset * 1000).toISOString(),
        },
        testRepository: {
          name: testRepo.name,
          fullName: testRepo.full_name,
          stars: testRepo.stars_count,
          forks: testRepo.forks_count,
          language: testRepo.language,
          lastUpdated: testRepo.updated_at,
        },
        repositoryStats: {
          contributors: repoStats.contributors_count,
          commitsLastYear: repoStats.commit_count_last_year,
          releases: repoStats.releases_count,
          topLanguages: Object.keys(repoStats.languages).slice(0, 5),
        },
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('GitHub API test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: error,
      timestamp: new Date().toISOString(),
    }, { 
      status: 500 
    });
  }
}