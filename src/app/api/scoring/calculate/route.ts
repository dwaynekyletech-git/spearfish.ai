/**
 * API Route: Calculate Spearfish Score
 * 
 * Endpoint for calculating spearfish scores for companies
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { 
  CompanyDataSchema, 
  calculateSpearfishScore, 
  batchCalculateSpearfishScores 
} from '@/lib/spearfish-scoring-service';
import { createSpearfishDatabaseService } from '@/lib/spearfish-database-service';

// Request schemas
const SingleScoreRequestSchema = z.object({
  company: CompanyDataSchema,
  saveToDatabase: z.boolean().optional().default(false),
});

const BatchScoreRequestSchema = z.object({
  companies: z.array(CompanyDataSchema),
  saveToDatabase: z.boolean().optional().default(false),
  batchId: z.string().uuid().optional(),
});

// Response schemas (for documentation purposes)
// const ScoreResponseSchema = z.object({
//   success: z.boolean(),
//   data: z.any().optional(),
//   error: z.string().optional(),
//   metadata: z.object({
//     processingTime: z.number(),
//     algorithmsVersion: z.string(),
//     timestamp: z.string(),
//   }),
// });

/**
 * POST /api/scoring/calculate
 * Calculate spearfish score for a single company or batch of companies
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
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

    // Parse request body
    const body = await request.json();
    
    // Determine if this is a single company or batch request
    const isBatch = Array.isArray(body.companies);
    
    if (isBatch) {
      // Handle batch scoring
      const validatedRequest = BatchScoreRequestSchema.parse(body);
      const results = await batchCalculateSpearfishScores(validatedRequest.companies);
      
      // Save to database if requested
      if (validatedRequest.saveToDatabase) {
        const databaseService = createSpearfishDatabaseService(true);
        const batchResult = await databaseService.batchUpdateCompanyScores(
          validatedRequest.companies,
          validatedRequest.batchId
        );
        
        return NextResponse.json({
          success: true,
          data: {
            scores: results,
            batchUpdate: batchResult,
          },
          metadata: {
            processingTime: Date.now() - startTime,
            algorithmsVersion: '1.0',
            timestamp: new Date().toISOString(),
          },
        });
      }
      
      return NextResponse.json({
        success: true,
        data: { scores: results },
        metadata: {
          processingTime: Date.now() - startTime,
          algorithmsVersion: '1.0',
          timestamp: new Date().toISOString(),
        },
      });
    } else {
      // Handle single company scoring
      const validatedRequest = SingleScoreRequestSchema.parse(body);
      const result = calculateSpearfishScore(validatedRequest.company);
      
      // Save to database if requested
      if (validatedRequest.saveToDatabase) {
        const databaseService = createSpearfishDatabaseService(true);
        const success = await databaseService.updateCompanyScore(
          validatedRequest.company.id,
          result
        );
        
        if (!success) {
          return NextResponse.json(
            { 
              success: false, 
              error: 'Failed to save score to database' 
            },
            { status: 500 }
          );
        }
      }
      
      return NextResponse.json({
        success: true,
        data: { score: result },
        metadata: {
          processingTime: Date.now() - startTime,
          algorithmsVersion: '1.0',
          timestamp: new Date().toISOString(),
        },
      });
    }
    
  } catch (error) {
    console.error('Error calculating spearfish score:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request data',
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

/**
 * GET /api/scoring/calculate?company_id=uuid
 * Calculate score for a specific company by ID
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
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

    // Get company ID from query params
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');
    
    if (!companyId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing company_id parameter' 
        },
        { status: 400 }
      );
    }

    // Fetch company data from database
    const databaseService = createSpearfishDatabaseService(true);
    const companies = await databaseService.getCompaniesWithScores({
      limit: 1,
      // Note: This would need to be implemented in the database service
      // For now, we'll need to modify the query or create a separate method
    });
    
    if (companies.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Company not found' 
        },
        { status: 404 }
      );
    }

    const company = companies[0];
    const result = calculateSpearfishScore(company);
    
    return NextResponse.json({
      success: true,
      data: { 
        company: {
          id: company.id,
          name: company.name,
          batch: company.batch,
        },
        score: result 
      },
      metadata: {
        processingTime: Date.now() - startTime,
        algorithmsVersion: '1.0',
        timestamp: new Date().toISOString(),
      },
    });
    
  } catch (error) {
    console.error('Error calculating spearfish score:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}