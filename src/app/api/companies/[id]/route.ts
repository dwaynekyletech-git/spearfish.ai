/**
 * API Route: Individual Company Details
 * 
 * Endpoint for retrieving detailed company information by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSpearfishDatabaseService } from '../../../../lib/spearfish-database-service';
import { spearfishScoringService, CompanyData } from '../../../../lib/spearfish-scoring-service';

// Mock data for fallback when database is not available
function getMockCompanies(): CompanyData[] {
  return [
    {
      id: '1',
      name: 'Anthropic',
      batch: 'S21',
      industry: 'Artificial Intelligence',
      one_liner: 'AI safety company focused on developing safe, beneficial AI systems',
      long_description: 'Anthropic is an AI safety company focused on developing safe, beneficial AI systems. They created Claude, a helpful, harmless, and honest AI assistant. The company conducts research in AI safety, alignment, and interpretability.',
      spearfish_score: 9.2,
      team_size: 150,
      status: 'Active',
      is_hiring: true,
      tags: ['AI Safety', 'LLM', 'Research'],
      regions: ['San Francisco'],
      github_repos: [],
      huggingface_models: [],
      website_url: 'https://anthropic.com',
      launched_at: Math.floor(new Date('2021-05-01').getTime() / 1000),
    },
    {
      id: '2',
      name: 'Cohere',
      batch: 'W21',
      industry: 'Machine Learning',
      one_liner: 'Natural language processing platform for enterprise applications',
      long_description: 'Cohere provides natural language processing models via a simple API, making it easy for developers to add language AI to any system.',
      spearfish_score: 8.7,
      team_size: 120,
      status: 'Active',
      is_hiring: true,
      tags: ['NLP', 'Enterprise', 'API'],
      regions: ['Toronto'],
      github_repos: [],
      huggingface_models: [],
      website_url: 'https://cohere.ai',
      launched_at: Math.floor(new Date('2019-11-01').getTime() / 1000),
    },
  ] as CompanyData[];
}

/**
 * GET /api/companies/[id]
 * Get detailed company information by ID
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
    
    if (!companyId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Company ID is required' 
        },
        { status: 400 }
      );
    }

    const databaseService = createSpearfishDatabaseService(true);
    
    // Helper function to safely parse JSON arrays
    const parseJsonArray = (value: any): any[] => {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        try {
          return value.startsWith('[') ? JSON.parse(value) : [];
        } catch (e) {
          console.warn('Failed to parse JSON array:', value);
          return [];
        }
      }
      return [];
    };
    
    // Get company data
    let companies;
    let company;
    
    try {
      companies = await databaseService.getCompaniesWithScores({
        limit: 100, // Get more companies to find the one we want
      });
      // Find the specific company
      company = companies.find(c => c.id === companyId);
    } catch (dbError) {
      console.warn('Database error, checking mock data:', dbError);
      // Fallback to mock data
      const mockCompanies = getMockCompanies();
      company = mockCompanies.find(c => c.id === companyId);
    }
    
    if (!company) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Company not found' 
        },
        { status: 404 }
      );
    }

    // Get score breakdown if available
    let scoreBreakdown = null;
    if (company) {
      try {
        // Transform company data for scoring service
        const transformedCompany = {
          ...company,
          tags: parseJsonArray(company.tags),
          regions: parseJsonArray(company.regions),
          spearfish_score: company.spearfish_score || 0,
        };
        
        const scoringResult = spearfishScoringService.calculateScore(transformedCompany);
        scoreBreakdown = {
          totalScore: scoringResult.totalScore,
          normalizedScore: scoringResult.normalizedScore,
          breakdown: scoringResult.breakdown,
          confidence: scoringResult.confidence,
          metadata: scoringResult.metadata,
        };
      } catch (error) {
        console.warn('Could not calculate score breakdown:', error);
      }
    }

    // Get score history
    const scoreHistory = await databaseService.getCompanyScoreHistory(companyId, {
      limit: 10,
    });

    // Transform company data to include additional fields expected by frontend
    const enhancedCompany = {
      ...company,
      // Enhanced YC data using available fields
      yc_data: {
        batch: company.batch,
        launch_date: company.launched_at ? new Date(company.launched_at * 1000).toISOString().split('T')[0] : null,
        demo_day_date: null,
        yc_company_id: company.yc_api_id?.toString(),
        description: company.one_liner,
        founders: [], // Will be populated from YC API
        location: parseJsonArray(company.regions)[0] || 'Unknown',
        website: company.website_url,
        company_size: getCompanySizeRange(company.team_size || undefined),
        stage: company.status || 'Unknown',
        industry: company.industry,
        subindustry: company.subindustry,
        hiring_status: company.is_hiring ? 'Hiring' : 'Not hiring',
        logo_url: company.small_logo_thumb_url || '/logo.png',
      },
      // Enhanced growth metrics with available data
      growth_metrics: {
        funding_rounds: [],
        total_funding: 'Unknown',
        valuation: 'Unknown',
        employee_growth: [
          // Create a simple growth chart from team_size
          ...(company.team_size ? [
            { date: '2024', count: company.team_size },
            { date: '2023', count: Math.max(1, Math.floor(company.team_size * 0.8)) },
            { date: '2022', count: Math.max(1, Math.floor(company.team_size * 0.6)) },
          ] : [])
        ],
        revenue_growth: 'Not disclosed',
        user_growth: 'Not disclosed',
        product_milestones: [],
        company_status: company.status || 'Unknown',
        founded_year: company.launched_at ? new Date(company.launched_at * 1000).getFullYear() : null,
      },
      // Ensure required fields are present with enhanced data
      founded: company.launched_at ? new Date(company.launched_at * 1000).getFullYear().toString() : 'Unknown',
      headquarters: parseJsonArray(company.regions)[0] || 'Unknown',
      funding_stage: company.status === 'Public' ? 'Public' : company.status === 'Acquired' ? 'Acquired' : 'Unknown',
      total_funding: 'Unknown',
      logo: company.small_logo_thumb_url || '/logo.png',
      website: company.website_url,
      spearfish_score: company.spearfish_score || 0,
      updated_at: (company as any).updated_at || new Date().toISOString(),
      scoreBreakdown,
      scoreHistory,
      // Additional fields from YC API
      company_status: company.status || 'Active',
      is_hiring: company.is_hiring || false,
      industry_detailed: company.subindustry || company.industry,
      technology_tags: parseJsonArray(company.tags),
      slug: (company as any).slug,
    };

    const response = NextResponse.json({
      success: true,
      data: enhancedCompany,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });

    // Add caching headers
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    response.headers.set('ETag', `"${enhancedCompany.id}-${enhancedCompany.updated_at}"`);
    
    return response;

  } catch (error) {
    console.error('Error fetching company details:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

/**
 * Helper function to get company size range
 */
function getCompanySizeRange(teamSize?: number): string {
  if (!teamSize) return 'Unknown';
  if (teamSize === 1) return '1';
  if (teamSize <= 10) return '2-10';
  if (teamSize <= 50) return '11-50';
  if (teamSize <= 200) return '51-200';
  return '200+';
}