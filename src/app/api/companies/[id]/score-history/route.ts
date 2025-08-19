import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSpearfishDatabaseService } from '@/lib/spearfish-database-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const companyId = params.id;
    
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const fromDate = searchParams.get('fromDate') ? new Date(searchParams.get('fromDate')!) : undefined;
    const toDate = searchParams.get('toDate') ? new Date(searchParams.get('toDate')!) : undefined;

    // Create database service with service role for score history access
    // Using service role because score_history table has RLS restrictions
    const databaseService = createSpearfishDatabaseService(true, true); // Use server client with service role
    
    // Fetch score history from database
    const scoreHistory = await databaseService.getCompanyScoreHistory(
      companyId,
      {
        limit,
        fromDate,
        toDate
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        companyId,
        history: scoreHistory,
        count: scoreHistory.length
      },
      metadata: {
        timestamp: new Date().toISOString(),
        limit,
        fromDate: fromDate?.toISOString(),
        toDate: toDate?.toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching score history:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch score history',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}