import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getGlobalResearchService } from '@/lib/company-research-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; sessionId: string } }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { sessionId } = params;
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing Parameters', message: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Get shared research service instance and get real progress
    const researchService = getGlobalResearchService();
    const progress = await researchService.getResearchProgress(sessionId);
    
    console.log(`DEBUG: Progress API - Looking for session ${sessionId}`);
    console.log(`DEBUG: Progress found:`, progress ? {
      status: progress.status,
      totalQueries: progress.totalQueries,
      completedQueries: progress.completedQueries,
      findingsCount: progress.findings?.length || 0,
      hasQuerySources: !!progress.querySources?.length
    } : null);
    
    if (!progress) {
      return NextResponse.json(
        { error: 'Session Not Found', message: 'Research session not found or expired' },
        { status: 404 }
      );
    }

    // Calculate progress percentage
    const progressPercentage = progress.totalQueries > 0 
      ? Math.round((progress.completedQueries / progress.totalQueries) * 100)
      : 0;

    return NextResponse.json({
      success: true,
      session: {
        id: sessionId,
        status: progress.status,
        progress: progressPercentage,
        total_queries: progress.totalQueries,
        completed_queries: progress.completedQueries,
        started_at: new Date().toISOString(),
        research_type: 'comprehensive',
        current_query: progress.currentQuery,
        active_queries: progress.activeQueries || [],
        query_sources: progress.querySources || [],
        error_message: progress.errorMessage
      }
    });

  } catch (error) {
    console.error('Progress retrieval failed:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal Server Error', 
        message: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; sessionId: string } }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id: companyId, sessionId } = params;
    
    if (!companyId || !sessionId) {
      return NextResponse.json(
        { error: 'Missing Parameters', message: 'Company ID and Session ID are required' },
        { status: 400 }
      );
    }

    // Get shared research service instance
    const researchService = getGlobalResearchService();
    
    // Cancel research session
    await researchService.cancelResearchSession(sessionId);
    
    return NextResponse.json({
      success: true,
      message: 'Research session cancelled successfully',
      data: {
        session_id: sessionId,
        company_id: companyId,
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      }
    });

  } catch (error) {
    console.error('Research cancellation failed:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal Server Error', 
        message: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}