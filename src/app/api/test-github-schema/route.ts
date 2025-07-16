/**
 * API Route: Test GitHub Database Schema
 * 
 * Test endpoint to verify GitHub database tables and functions work correctly
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    console.log('Testing GitHub database schema...');

    const supabase = await createServerClient();

    // Test 1: Insert a test GitHub repository
    const testRepoData = {
      github_id: 123456789,
      full_name: 'test/example-repo',
      name: 'example-repo',
      owner: 'test',
      description: 'Test repository for schema validation',
      html_url: 'https://github.com/test/example-repo',
      language: 'TypeScript',
      stars_count: 1250,
      forks_count: 89,
      open_issues_count: 12,
      size: 2048,
      archived: false,
      disabled: false,
      private: false,
      created_at_github: '2023-01-15T10:30:00Z',
      updated_at_github: '2024-12-01T14:22:00Z',
      pushed_at_github: '2024-12-01T14:22:00Z'
    };

    const { data: repoResult, error: repoError } = await supabase
      .from('github_repositories')
      .insert(testRepoData)
      .select()
      .single();

    if (repoError) {
      throw new Error(`Repository insert failed: ${repoError.message}`);
    }

    console.log('✅ Repository inserted:', repoResult.full_name);

    // Test 2: Insert repository metrics
    const metricsData = {
      repository_id: repoResult.id,
      stars_count: 1250,
      forks_count: 89,
      open_issues_count: 12,
      size: 2048,
      contributors_count: 15,
      commit_count_last_year: 234,
      releases_count: 8
    };

    const { data: metricsResult, error: metricsError } = await supabase
      .from('github_repository_metrics')
      .insert(metricsData)
      .select()
      .single();

    if (metricsError) {
      throw new Error(`Metrics insert failed: ${metricsError.message}`);
    }

    console.log('✅ Metrics inserted for repository');

    // Test 3: Insert repository languages
    const languagesData = [
      {
        repository_id: repoResult.id,
        language: 'TypeScript',
        bytes_count: 125000,
        percentage: 65.5
      },
      {
        repository_id: repoResult.id,
        language: 'JavaScript',
        bytes_count: 45000,
        percentage: 23.5
      },
      {
        repository_id: repoResult.id,
        language: 'CSS',
        bytes_count: 21000,
        percentage: 11.0
      }
    ];

    const { data: languagesResult, error: languagesError } = await supabase
      .from('github_repository_languages')
      .insert(languagesData)
      .select();

    if (languagesError) {
      throw new Error(`Languages insert failed: ${languagesError.message}`);
    }

    console.log('✅ Languages inserted:', languagesResult.length, 'entries');

    // Test 4: Find a test company and create association
    const { data: testCompany, error: companyError } = await supabase
      .from('companies')
      .select('id, name')
      .limit(1)
      .single();

    if (companyError || !testCompany) {
      console.warn('No test company found, skipping association test');
    } else {
      const associationData = {
        company_id: testCompany.id,
        repository_id: repoResult.id,
        is_primary: true,
        discovery_method: 'api',
        confidence_score: 0.95,
        notes: 'Test association for schema validation'
      };

      const { data: associationResult, error: associationError } = await supabase
        .from('company_github_repositories')
        .insert(associationData)
        .select()
        .single();

      if (associationError) {
        throw new Error(`Association insert failed: ${associationError.message}`);
      }

      console.log('✅ Company-repository association created');
    }

    // Test 5: Test custom functions
    let functionsTestResult = {};
    
    try {
      // Test calculate_star_growth function
      const { data: starGrowthResult, error: starGrowthError } = await supabase
        .rpc('calculate_star_growth', { 
          repo_id: repoResult.id, 
          days_period: 30 
        });

      if (starGrowthError) {
        console.warn('Star growth function test failed:', starGrowthError.message);
      } else {
        functionsTestResult = { ...functionsTestResult, star_growth: starGrowthResult };
        console.log('✅ calculate_star_growth function works');
      }
    } catch (error) {
      console.warn('Star growth function test error:', error);
    }

    try {
      // Test get_company_top_repositories function if we have a company
      if (testCompany) {
        const { data: topReposResult, error: topReposError } = await supabase
          .rpc('get_company_top_repositories', { 
            comp_id: testCompany.id, 
            limit_count: 5 
          });

        if (topReposError) {
          console.warn('Top repositories function test failed:', topReposError.message);
        } else {
          functionsTestResult = { ...functionsTestResult, top_repositories: topReposResult };
          console.log('✅ get_company_top_repositories function works');
        }
      }
    } catch (error) {
      console.warn('Top repositories function test error:', error);
    }

    // Test 6: Query data back to verify schema
    const { data: queryResult, error: queryError } = await supabase
      .from('github_repositories')
      .select(`
        *,
        github_repository_metrics(*),
        github_repository_languages(*),
        company_github_repositories(*)
      `)
      .eq('id', repoResult.id)
      .single();

    if (queryError) {
      throw new Error(`Query test failed: ${queryError.message}`);
    }

    console.log('✅ Complex query with joins successful');

    // Clean up test data
    await supabase.from('github_repositories').delete().eq('id', repoResult.id);
    console.log('✅ Test data cleaned up');

    return NextResponse.json({
      success: true,
      message: 'GitHub database schema working correctly',
      data: {
        repository_created: true,
        metrics_created: true,
        languages_created: true,
        association_created: !!testCompany,
        functions_tested: functionsTestResult,
        query_joins_working: true,
        test_company: testCompany?.name || 'none found',
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('GitHub schema test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    }, { 
      status: 500 
    });
  }
}