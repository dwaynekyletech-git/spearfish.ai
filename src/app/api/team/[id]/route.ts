/**
 * Team API Route
 * 
 * Get team members and funding data for a specific company
 */

import { NextRequest, NextResponse } from 'next/server';
import { createFounderDatabaseService } from '@/lib/founder-database-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const companyId = params.id;
    
    if (!companyId) {
      return NextResponse.json({
        success: false,
        error: 'Company ID is required'
      }, { status: 400 });
    }

    console.log(`🔍 Fetching team data for company: ${companyId}`);
    
    const founderService = createFounderDatabaseService();
    const teamData = await founderService.getCompanyTeamData(companyId);
    
    console.log(`📊 Found ${teamData.founders.length} founders and ${teamData.funding ? 'funding data' : 'no funding data'}`);
    
    return NextResponse.json({
      success: true,
      data: teamData,
      // Also return at root level for easier access
      founders: teamData.founders,
      funding: teamData.funding
    });
    
  } catch (error) {
    console.error(`❌ Error fetching team data for ${params.id}:`, error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to fetch team data'
    }, { status: 500 });
  }
}