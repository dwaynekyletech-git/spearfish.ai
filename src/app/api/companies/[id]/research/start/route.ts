import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { getGlobalResearchService } from '@/lib/company-research-service';
import { createServiceClient } from '@/lib/supabase-server';
import { verifyCsrf, needsCsrfProtection, getCsrfConfig } from '@/lib/security/csrf-protection';
import { CompanyIdParamsSchema } from '@/lib/validation/common';
import { StartResearchRequestSchema } from '@/lib/validation/research';
import Logger, { logApiRequest, logApiResponse, logApiError } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now();
  
  try {
    // Start API request logging
    logApiRequest('GET', `/api/companies/${params.id}/research/start`);
    
    // Validate parameters
    const validatedParams = CompanyIdParamsSchema.parse(params);
    const companyId = validatedParams.id;
    
    const { userId } = await auth();
    
    if (!userId) {
      logApiError('Authentication required', 401);
      return NextResponse.json(
        { success: false, error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    Logger.setContext({ userId, companyId });
    
    const response = {
      success: true,
      message: 'Research configuration endpoint',
      data: {
        company_id: companyId,
        user_id: userId,
        available_templates: [
          {
            id: 'technical-challenges',
            name: 'Technical Challenges Analysis',
            category: 'technical',
            priority: 'high',
          },
          {
            id: 'business-challenges',
            name: 'Business Challenges Analysis',
            category: 'business',
            priority: 'high',
          },
          {
            id: 'key-decision-makers',
            name: 'Key Decision Makers Analysis',
            category: 'team',
            priority: 'high',
          },
        ],
        default_config: {
          priority: 'medium',
          max_concurrent_queries: 3,
          max_cost_usd: 10.0,
          timeout_ms: 60000,
          enable_synthesis: true,
          save_to_database: true,
        },
      }
    };

    logApiResponse(200, Date.now() - startTime);
    return NextResponse.json(response);

  } catch (error) {
    if (error instanceof z.ZodError) {
      logApiError('Validation failed', 400);
      return NextResponse.json(
        { 
          success: false,
          error: 'Validation failed', 
          details: error.errors 
        },
        { status: 400 }
      );
    }

    logApiError(error instanceof Error ? error.message : 'Unknown error occurred', 500);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal Server Error', 
        message: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  } finally {
    Logger.clearContext();
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now();
  
  try {
    // Start API request logging
    logApiRequest('POST', `/api/companies/${params.id}/research/start`);
    
    // Validate parameters
    const validatedParams = CompanyIdParamsSchema.parse(params);
    const companyId = validatedParams.id;

    // Apply CSRF protection for mutation requests
    if (needsCsrfProtection(request)) {
      verifyCsrf(request, getCsrfConfig());
    }
    
    const { userId } = await auth();
    
    if (!userId) {
      logApiError('Authentication required', 401);
      return NextResponse.json(
        { success: false, error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    Logger.setContext({ userId, companyId });

    // Parse and validate request body
    const body = await request.json();
    const validatedRequest = StartResearchRequestSchema.parse(body);
    
    // Map research types to template IDs
    const templateMap: Record<string, string[]> = {
      'technical-challenges': ['technical-challenges', 'tech-stack-analysis'],
      'business-intelligence': ['business-challenges', 'market-opportunities', 'funding-analysis'],
      'team-dynamics': ['key-decision-makers', 'hiring-patterns'],
      'recent-activities': ['recent-activities'],
      'comprehensive': [
        'technical-challenges',
        'business-challenges', 
        'key-decision-makers',
        'recent-activities',
        'market-opportunities'
      ]
    };

    const templateIds = templateMap[validatedRequest.research_type] || templateMap['comprehensive'];
    
    // Get shared research service instance
    const researchService = getGlobalResearchService();
    
    // Prepare research configuration using validated request
    const config = {
      templateIds: validatedRequest.config?.template_ids || templateIds,
      variables: {
        companyName: validatedRequest.company_data?.name || 'Unknown Company',
        website: validatedRequest.company_data?.website,
        industry: validatedRequest.company_data?.industry,
        location: validatedRequest.company_data?.location
      },
      priority: validatedRequest.config?.priority || 'medium' as const,
      maxConcurrentQueries: 2,
      maxCostUsd: validatedRequest.config?.max_cost_usd || 5.0,
      timeoutMs: validatedRequest.config?.timeout_ms || 120000,
      enableSynthesis: validatedRequest.config?.enable_synthesis ?? true,
      saveToDatabase: validatedRequest.config?.save_to_database ?? true
    };

    // Get user profile ID from Clerk user ID
    const supabase = createServiceClient()
    const { data: userProfile, error: userError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('clerk_user_id', userId)
      .single()

    if (userError || !userProfile) {
      Logger.error('Failed to get user profile', { userError });
      return NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Start research session with user profile ID
    const { sessionId } = await researchService.startResearchSession(
      companyId,
      userProfile.id,
      config
    );
    
    Logger.info('Created research session', { sessionId });
    
    // Check if session was actually created in progress tracker
    const testProgress = await researchService.getResearchProgress(sessionId);
    Logger.debug('Session check in progress tracker', { sessionId, testProgress });
    
    const response = {
      success: true,
      message: 'Research session started successfully',
      session: {
        id: sessionId,
        status: 'processing',
        progress: 0,
        total_queries: templateIds.length,
        completed_queries: 0,
        started_at: new Date().toISOString(),
        research_type: validatedRequest.research_type
      }
    };

    logApiResponse(200, Date.now() - startTime);
    return NextResponse.json(response);

  } catch (error) {
    if (error instanceof z.ZodError) {
      logApiError('Validation failed', 400);
      return NextResponse.json(
        { 
          success: false,
          error: 'Validation failed', 
          details: error.errors 
        },
        { status: 400 }
      );
    }
    
    if (error instanceof Error && error.name === 'CsrfValidationError') {
      logApiError('CSRF validation failed', 403);
      return NextResponse.json(
        { 
          success: false,
          error: 'CSRF validation failed',
          message: 'Request origin validation failed'
        },
        { status: 403 }
      );
    }

    logApiError(error instanceof Error ? error.message : 'Unknown error occurred', 500);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal Server Error', 
        message: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  } finally {
    Logger.clearContext();
  }
}