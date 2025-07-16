/**
 * API Route: Company GitHub Repositories
 * 
 * Endpoint for retrieving GitHub repository data for a specific company
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { githubStorageService } from '@/lib/github-storage-service';
import { createServerClient } from '@/lib/supabase-server';

/**
 * GET /api/companies/[id]/github
 * Get GitHub repositories for a company with metrics and star growth
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Unauthorized - Authentication required' 
        },
        { status: 401 }
      );
    }

    const companyId = params.id;
    
    // Validate company ID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(companyId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid company ID format',
      }, { status: 400 });
    }

    // Check if company exists
    const supabase = await createServerClient();
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      return NextResponse.json({
        success: false,
        error: 'Company not found',
      }, { status: 404 });
    }

    // Get company repositories with enhanced data
    const { data: repositories, error } = await supabase
      .from('github_repositories')
      .select(`
        *,
        company_github_repositories!inner(
          company_id,
          is_primary,
          confidence_score,
          discovery_method
        ),
        github_repository_metrics(
          stars_count,
          forks_count,
          contributors_count,
          commit_count_last_year,
          releases_count,
          recorded_at
        ),
        github_repository_languages(
          language,
          percentage
        )
      `)
      .eq('company_github_repositories.company_id', companyId)
      .eq('archived', false)
      .eq('disabled', false)
      .order('stars_count', { ascending: false });

    if (error) {
      console.error('Database error fetching repositories:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch repositories',
        details: error.message,
      }, { status: 500 });
    }

    // If no repositories found, return empty response
    if (!repositories || repositories.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          company: {
            id: company.id,
            name: company.name,
          },
          repositories: [],
          summary: {
            total_repositories: 0,
            total_stars: 0,
            total_forks: 0,
            total_contributors: 0,
            total_commits_last_year: 0,
            monthly_star_growth: 0,
            primary_repository: null,
            top_languages: [],
            last_synced: null,
          },
        },
        metadata: {
          timestamp: new Date().toISOString(),
          total_repositories: 0,
        },
      });
    }

    // Process repositories to include growth metrics
    const processedRepositories = await Promise.all(
      repositories.map(async (repo: any) => {
        // Get latest metrics
        const latestMetrics = repo.github_repository_metrics?.[0] || {
          stars_count: repo.stars_count,
          forks_count: repo.forks_count,
          contributors_count: 0,
          commit_count_last_year: 0,
          releases_count: 0,
        };

        // Calculate star growth (30-day period)
        const { data: starGrowth, error: growthError } = await supabase
          .rpc('calculate_star_growth', { 
            repo_id: repo.id, 
            days_period: 30 
          });
        
        if (growthError) {
          console.warn(`Error calculating star growth for repo ${repo.id}:`, growthError);
        }

        // Get top 3 languages
        const topLanguages = repo.github_repository_languages
          ?.sort((a: any, b: any) => b.percentage - a.percentage)
          ?.slice(0, 3)
          ?.map((lang: any) => ({
            language: lang.language,
            percentage: lang.percentage,
          })) || [];

        return {
          id: repo.id,
          github_id: repo.github_id,
          full_name: repo.full_name,
          name: repo.name,
          owner: repo.owner,
          description: repo.description,
          html_url: repo.html_url,
          language: repo.language,
          stars_count: repo.stars_count,
          forks_count: repo.forks_count,
          open_issues_count: repo.open_issues_count,
          created_at_github: repo.created_at_github,
          updated_at_github: repo.updated_at_github,
          pushed_at_github: repo.pushed_at_github,
          last_synced_at: repo.last_synced_at,
          association: {
            is_primary: repo.company_github_repositories[0]?.is_primary || false,
            confidence_score: repo.company_github_repositories[0]?.confidence_score || 0,
            discovery_method: repo.company_github_repositories[0]?.discovery_method || 'unknown',
          },
          metrics: {
            stars_count: latestMetrics.stars_count,
            forks_count: latestMetrics.forks_count,
            contributors_count: latestMetrics.contributors_count,
            commit_count_last_year: latestMetrics.commit_count_last_year,
            releases_count: latestMetrics.releases_count,
          },
          star_growth: {
            monthly_growth: starGrowth?.[0]?.monthly_growth_rate || 0,
            growth_percentage: starGrowth?.[0]?.growth_percentage || 0,
            period_days: 30,
          },
          top_languages: topLanguages,
        };
      })
    );

    // Calculate aggregate statistics
    const totalStars = processedRepositories.reduce((sum, repo) => sum + repo.stars_count, 0);
    const totalForks = processedRepositories.reduce((sum, repo) => sum + repo.forks_count, 0);
    const totalContributors = processedRepositories.reduce((sum, repo) => sum + repo.metrics.contributors_count, 0);
    const totalCommitsLastYear = processedRepositories.reduce((sum, repo) => sum + repo.metrics.commit_count_last_year, 0);
    const totalRepos = processedRepositories.length;
    const primaryRepo = processedRepositories.find(repo => repo.association.is_primary);
    const monthlyStarGrowth = processedRepositories.reduce(
      (sum, repo) => sum + (repo.star_growth.monthly_growth || 0), 0
    );

    // Get all languages across repositories
    const allLanguages = new Map<string, number>();
    processedRepositories.forEach(repo => {
      repo.top_languages.forEach((lang: { language: string; percentage: number }) => {
        const current = allLanguages.get(lang.language) || 0;
        allLanguages.set(lang.language, current + lang.percentage);
      });
    });

    const topCompanyLanguages = Array.from(allLanguages.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([language, totalPercentage]) => ({
        language,
        percentage: Number((totalPercentage / totalRepos).toFixed(1)),
      }));

    const response = NextResponse.json({
      success: true,
      data: {
        company: {
          id: company.id,
          name: company.name,
        },
        repositories: processedRepositories,
        summary: {
          total_repositories: totalRepos,
          total_stars: totalStars,
          total_forks: totalForks,
          total_contributors: totalContributors,
          total_commits_last_year: totalCommitsLastYear,
          monthly_star_growth: Math.round(monthlyStarGrowth),
          primary_repository: primaryRepo ? {
            name: primaryRepo.full_name,
            stars: primaryRepo.stars_count,
            language: primaryRepo.language,
          } : null,
          top_languages: topCompanyLanguages,
          last_synced: processedRepositories[0]?.last_synced_at || null,
        },
      },
      metadata: {
        timestamp: new Date().toISOString(),
        total_repositories: totalRepos,
      },
    });

    // Add caching headers
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    
    return response;

  } catch (error) {
    console.error('Error fetching company GitHub data:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    }, { 
      status: 500 
    });
  }
}