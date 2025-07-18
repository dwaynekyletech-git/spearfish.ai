/**
 * API Route: Companies List
 * 
 * Endpoint for retrieving companies for the discovery interface
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { createSpearfishDatabaseService } from '@/lib/spearfish-database-service';
import { CompanyData, spearfishScoringService } from '@/lib/spearfish-scoring-service';

// Query parameters schema
const QueryParamsSchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
  search: z.string().optional(),
  batches: z.string().optional().transform(val => val ? val.split(',') : undefined),
  teamSizes: z.string().optional().transform(val => val ? val.split(',').map(Number) : undefined),
  hiringOnly: z.coerce.boolean().optional().default(false),
  minScore: z.coerce.number().min(0).max(10).optional(),
  orderBy: z.enum(['score', 'name', 'batch', 'updated_at']).optional().default('score'),
  orderDirection: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Mock data for fallback when database is not available
function getMockCompanies(): CompanyData[] {
  return [
    {
      id: '1',
      name: 'Anthropic',
      batch: 'S21',
      industry: 'Artificial Intelligence',
      one_liner: 'AI safety company focused on developing safe, beneficial AI systems',
      spearfish_score: 9.2,
      team_size: 150,
      status: 'Active',
      is_hiring: true,
      tags: ['AI Safety', 'LLM', 'Research'],
      regions: ['San Francisco'],
      github_repos: [],
      huggingface_models: [],
    },
    {
      id: '2',
      name: 'Cohere',
      batch: 'W21',
      industry: 'Machine Learning',
      one_liner: 'Natural language processing platform for enterprise applications',
      spearfish_score: 8.7,
      team_size: 120,
      status: 'Active',
      is_hiring: true,
      tags: ['NLP', 'Enterprise', 'API'],
      regions: ['Toronto'],
      github_repos: [],
      huggingface_models: [],
    },
    {
      id: '3',
      name: 'Scale AI',
      batch: 'S16',
      industry: 'Data Infrastructure',
      one_liner: 'Data platform for AI, providing training data for machine learning',
      spearfish_score: 8.9,
      team_size: 400,
      status: 'Active',
      is_hiring: true,
      tags: ['Data', 'Training', 'ML Infrastructure'],
      regions: ['San Francisco'],
      github_repos: [],
      huggingface_models: [],
    },
    {
      id: '4',
      name: 'Replicate',
      batch: 'W20',
      industry: 'Machine Learning',
      one_liner: 'Run open-source machine learning models with a cloud API',
      spearfish_score: 7.8,
      team_size: 25,
      status: 'Active',
      is_hiring: true,
      tags: ['Open Source', 'ML Models', 'API'],
      regions: ['San Francisco'],
      github_repos: [],
      huggingface_models: [],
    },
    {
      id: '5',
      name: 'Weights & Biases',
      batch: 'W17',
      industry: 'Developer Tools',
      one_liner: 'MLOps platform for building better models faster',
      spearfish_score: 8.3,
      team_size: 200,
      status: 'Active',
      is_hiring: true,
      tags: ['MLOps', 'Developer Tools', 'Tracking'],
      regions: ['San Francisco'],
      github_repos: [],
      huggingface_models: [],
    },
  ] as CompanyData[];
}

/**
 * GET /api/companies
 * Get companies for discovery interface with filtering and search
 */
export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = QueryParamsSchema.parse(Object.fromEntries(searchParams));

    // Get companies with scores
    const databaseService = createSpearfishDatabaseService(true);
    
    let companies;
    try {
      companies = await databaseService.getCompaniesWithScores({
        limit: queryParams.limit + 10, // Get a few extra for filtering
        offset: queryParams.offset,
        batches: queryParams.batches,
        aiOnly: false, // Temporarily disable AI-only filter to get all companies
        minScore: queryParams.minScore,
        orderBy: queryParams.orderBy,
        orderDirection: queryParams.orderDirection,
      });
    } catch (dbError) {
      console.warn('Database error, falling back to mock data:', dbError);
      // Fallback to mock data for development
      companies = getMockCompanies();
    }

    // Apply search filter if provided
    if (queryParams.search) {
      const searchTerm = queryParams.search.toLowerCase();
      companies = companies.filter(company => 
        company.name?.toLowerCase().includes(searchTerm) ||
        company.one_liner?.toLowerCase().includes(searchTerm) ||
        company.long_description?.toLowerCase().includes(searchTerm) ||
        company.industry?.toLowerCase().includes(searchTerm)
      );
    }

    // Apply team size filter if provided
    if (queryParams.teamSizes && queryParams.teamSizes.length > 0) {
      companies = companies.filter(company => {
        const teamSize = company.team_size;
        if (!teamSize) return false;
        return queryParams.teamSizes!.some(size => {
          if (size === 1) return teamSize === 1;
          if (size === 5) return teamSize >= 2 && teamSize <= 10;
          if (size === 15) return teamSize >= 11 && teamSize <= 25;
          if (size === 50) return teamSize >= 26 && teamSize <= 100;
          if (size === 100) return teamSize > 100;
          return false;
        });
      });
    }

    // Apply hiring filter if provided
    if (queryParams.hiringOnly) {
      companies = companies.filter(company => company.is_hiring);
    }

    // Limit to requested amount
    companies = companies.slice(0, queryParams.limit);

    // Calculate scores for companies that don't have them and transform data
    const transformedCompanies = await Promise.all(companies.map(async (company) => {
      let spearfish_score = company.spearfish_score;
      
      // Calculate score if missing
      if (!spearfish_score || spearfish_score === 0) {
        try {
          // Transform company data to match schema before scoring
          const companyForScoring = {
            ...company,
            tags: Array.isArray(company.tags) ? company.tags : 
                  typeof company.tags === 'string' ? (company.tags as string).split(',').filter(t => t.trim()) : [],
            regions: Array.isArray(company.regions) ? company.regions : 
                     typeof company.regions === 'string' ? (company.regions as string).split(',').filter(r => r.trim()) : [],
            github_repos: company.github_repos || [],
            huggingface_models: company.huggingface_models || [],
            spearfish_score: undefined, // Remove null values for scoring
          };
          
          const scoringResult = spearfishScoringService.calculateScore(companyForScoring);
          spearfish_score = scoringResult.totalScore;
          
          // Update database with calculated score (fire and forget)
          databaseService.updateCompanyScore(company.id, scoringResult).catch(err => 
            console.warn(`Failed to update score for company ${company.id}:`, err)
          );
        } catch (error) {
          console.warn(`Failed to calculate score for company ${company.name}:`, error);
          spearfish_score = 0;
        }
      }
      
      return {
        ...company,
        spearfish_score,
        updated_at: (company as any).updated_at || new Date().toISOString(),
      };
    }));

    const response = NextResponse.json({
      success: true,
      data: transformedCompanies,
      metadata: {
        total: transformedCompanies.length,
        limit: queryParams.limit,
        offset: queryParams.offset,
        timestamp: new Date().toISOString(),
      },
    });

    // Add caching headers
    response.headers.set('Cache-Control', 'public, s-maxage=180, stale-while-revalidate=30');
    
    return response;

  } catch (error) {
    console.error('Error fetching companies:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid query parameters',
          details: error.errors 
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}