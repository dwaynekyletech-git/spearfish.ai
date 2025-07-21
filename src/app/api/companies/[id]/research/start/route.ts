import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getGlobalResearchService } from '@/lib/company-research-service';
import { createServiceClient } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const companyId = params.id;
    
    return NextResponse.json({
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
    });

  } catch (error) {
    console.error('Research configuration failed:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal Server Error', 
        message: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const companyId = params.id;
    const body = await request.json();
    
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

    const templateIds = templateMap[body.research_type] || templateMap['comprehensive'];
    
    // Get shared research service instance
    const researchService = getGlobalResearchService();
    
    // Prepare research configuration
    const config = {
      templateIds,
      variables: {
        companyName: body.company_data?.name || 'Unknown Company',
        website: body.company_data?.website,
        industry: body.company_data?.industry,
        location: body.company_data?.location
      },
      priority: 'high' as const,
      maxConcurrentQueries: 2,
      maxCostUsd: 5.0,
      timeoutMs: 120000,
      enableSynthesis: true,
      saveToDatabase: true
    };

    // Get user profile ID from Clerk user ID
    const supabase = createServiceClient()
    const { data: userProfile, error: userError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('clerk_user_id', userId)
      .single()

    if (userError || !userProfile) {
      console.error('Failed to get user profile:', userError)
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Start research session with user profile ID
    const { sessionId } = await researchService.startResearchSession(
      companyId,
      userProfile.id,
      config
    );
    
    console.log(`Created research session: ${sessionId}`);
    
    // Check if session was actually created in progress tracker
    const testProgress = await researchService.getResearchProgress(sessionId);
    console.log(`Session check in progress tracker:`, testProgress);
    
    return NextResponse.json({
      success: true,
      message: 'Research session started successfully',
      session: {
        id: sessionId,
        status: 'processing',
        progress: 0,
        total_queries: templateIds.length,
        completed_queries: 0,
        started_at: new Date().toISOString(),
        research_type: body.research_type || 'comprehensive'
      }
    });

  } catch (error) {
    console.error('Research start failed:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal Server Error', 
        message: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}