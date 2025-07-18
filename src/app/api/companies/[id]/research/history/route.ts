import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

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

    // Return empty history for now
    return NextResponse.json({
      success: true,
      sessions: []
    });

  } catch (error) {
    console.error('Research history retrieval failed:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal Server Error', 
        message: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}