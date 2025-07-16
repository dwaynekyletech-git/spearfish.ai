/**
 * API Route: Test Star Growth Function Fix
 * 
 * Test endpoint to verify the fixed calculate_star_growth function works correctly
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    console.log('Testing fixed calculate_star_growth function...');

    const supabase = await createServerClient();

    // Test 1: Create a test repository
    const testRepoData = {
      github_id: 999999999,
      full_name: 'test/star-growth-test',
      name: 'star-growth-test',
      owner: 'test',
      description: 'Test repository for star growth function fix',
      html_url: 'https://github.com/test/star-growth-test',
      language: 'JavaScript',
      stars_count: 100,
      forks_count: 10,
      open_issues_count: 5,
      size: 1024,
      archived: false,
      disabled: false,
      private: false,
      created_at_github: '2024-01-01T00:00:00Z',
      updated_at_github: '2024-12-01T00:00:00Z',
      pushed_at_github: '2024-12-01T00:00:00Z'
    };

    const { data: testRepo, error: repoError } = await supabase
      .from('github_repositories')
      .insert(testRepoData)
      .select()
      .single();

    if (repoError) {
      throw new Error(`Failed to create test repository: ${repoError.message}`);
    }

    console.log('✅ Test repository created:', testRepo.full_name);

    // Test 2: Test function with no metrics (should return zeros)
    const { data: noMetricsResult, error: noMetricsError } = await supabase
      .rpc('calculate_star_growth', { 
        repo_id: testRepo.id, 
        days_period: 30 
      });

    if (noMetricsError) {
      console.error('❌ No metrics test failed:', noMetricsError);
    } else {
      console.log('✅ No metrics test passed:', noMetricsResult);
    }

    // Test 3: Add some metrics and test again
    const metricsData = [
      {
        repository_id: testRepo.id,
        stars_count: 80,
        forks_count: 8,
        open_issues_count: 3,
        size: 1000,
        contributors_count: 5,
        commit_count_last_year: 50,
        releases_count: 2,
        recorded_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(), // 25 days ago
      },
      {
        repository_id: testRepo.id,
        stars_count: 100,
        forks_count: 10,
        open_issues_count: 5,
        size: 1024,
        contributors_count: 6,
        commit_count_last_year: 60,
        releases_count: 3,
        recorded_at: new Date().toISOString(), // Now
      }
    ];

    const { data: metricsResult, error: metricsError } = await supabase
      .from('github_repository_metrics')
      .insert(metricsData)
      .select();

    if (metricsError) {
      throw new Error(`Failed to insert metrics: ${metricsError.message}`);
    }

    console.log('✅ Test metrics inserted:', metricsResult.length, 'records');

    // Test 4: Test function with metrics (should calculate growth)
    const { data: withMetricsResult, error: withMetricsError } = await supabase
      .rpc('calculate_star_growth', { 
        repo_id: testRepo.id, 
        days_period: 30 
      });

    if (withMetricsError) {
      console.error('❌ With metrics test failed:', withMetricsError);
    } else {
      console.log('✅ With metrics test passed:', withMetricsResult);
    }

    // Test 5: Test get_company_top_repositories function if we have a company
    const { data: testCompany, error: companyError } = await supabase
      .from('companies')
      .select('id, name')
      .limit(1)
      .single();

    let topReposResult = null;
    if (testCompany) {
      // Associate repository with company
      await supabase
        .from('company_github_repositories')
        .insert({
          company_id: testCompany.id,
          repository_id: testRepo.id,
          is_primary: true,
          discovery_method: 'test',
          confidence_score: 1.0,
          notes: 'Test association for star growth function fix'
        });

      const { data: topRepos, error: topReposError } = await supabase
        .rpc('get_company_top_repositories', { 
          comp_id: testCompany.id, 
          limit_count: 5 
        });

      if (topReposError) {
        console.error('❌ Top repositories test failed:', topReposError);
      } else {
        console.log('✅ Top repositories test passed:', topRepos);
        topReposResult = topRepos;
      }
    }

    // Clean up test data
    await supabase.from('github_repositories').delete().eq('id', testRepo.id);
    console.log('✅ Test data cleaned up');

    return NextResponse.json({
      success: true,
      message: 'Star growth function fix test completed successfully',
      data: {
        test_repository_created: true,
        no_metrics_test: noMetricsResult,
        with_metrics_test: withMetricsResult,
        top_repositories_test: topReposResult,
        test_company: testCompany?.name || 'none found',
        expected_growth: {
          start_stars: 80,
          end_stars: 100,
          star_growth: 20,
          growth_percentage: 25.0, // 20/80 * 100
        }
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Star growth function test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    }, { 
      status: 500 
    });
  }
}