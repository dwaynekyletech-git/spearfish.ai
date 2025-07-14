/**
 * API Route: Get Companies with Spearfish Scores
 * 
 * Endpoint for retrieving companies with their spearfish scores
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { createSpearfishDatabaseService } from '@/lib/spearfish-database-service';

// Query parameters schema
const QueryParamsSchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
  batches: z.string().optional().transform(val => val ? val.split(',') : undefined),
  aiOnly: z.coerce.boolean().optional().default(true),
  minScore: z.coerce.number().min(0).max(10).optional(),
  orderBy: z.enum(['score', 'name', 'batch', 'updated_at']).optional().default('score'),
  orderDirection: z.enum(['asc', 'desc']).optional().default('desc'),
});

/**
 * GET /api/scoring/companies
 * Get companies with their spearfish scores
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
    const companies = await databaseService.getCompaniesWithScores({
      limit: queryParams.limit,
      offset: queryParams.offset,
      batches: queryParams.batches,
      aiOnly: queryParams.aiOnly,
      minScore: queryParams.minScore,
      orderBy: queryParams.orderBy,
      orderDirection: queryParams.orderDirection,
    });

    // Get statistics
    const statistics = await databaseService.getScoringStatistics();

    return NextResponse.json({
      success: true,
      data: {
        companies,
        statistics,
        pagination: {
          limit: queryParams.limit,
          offset: queryParams.offset,
          total: statistics.totalCompanies,
        },
      },
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Error fetching companies with scores:', error);
    
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