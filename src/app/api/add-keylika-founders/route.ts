/**
 * Add Keylika Founders API Route
 * 
 * Test endpoint to add real founder data scraped from YC
 */

import { NextRequest, NextResponse } from 'next/server';
import { createFounderDatabaseService } from '@/lib/founder-database-service';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Adding Keylika founders from YC scraping...');
    
    const founderDbService = createFounderDatabaseService();
    
    // Use the test company ID
    const companyId = '51b7bd3c-31f2-4919-a263-fc5af2334e76';
    
    // Clear existing founders first
    await founderDbService.clearFounders(companyId);
    
    // Add real founders from Keylika (scraped from YC page)
    const keylikaFounders = [
      {
        name: 'Buddha Chaudhuri',
        title: 'Co-Founder',
        bio: 'Co-founder of Keylika, focused on drug discovery and computational chemistry.',
        linkedin_url: null,
        twitter_url: null
      },
      {
        name: 'Frederik Ceyssens',
        title: 'Co-Founder',
        bio: 'Co-founder of Keylika, expertise in machine learning and pharmaceutical research.',
        linkedin_url: null,
        twitter_url: null
      }
    ];
    
    // Save founders
    console.log('💾 Saving Keylika founder data...');
    for (const founder of keylikaFounders) {
      await founderDbService.saveFounder(companyId, founder, 'https://www.ycombinator.com/companies/keylika');
    }
    
    // Save funding summary
    const fundingData = {
      company_id: companyId,
      founders: keylikaFounders,
      funding_rounds: [],
      key_investors: ['Y Combinator'],
      total_funding: null, // No funding data found
      last_updated: new Date().toISOString(),
      sources: ['https://www.ycombinator.com/companies/keylika']
    };
    
    await founderDbService.saveFundingSummary(companyId, fundingData);
    
    // Retrieve the data to confirm
    const teamData = await founderDbService.getCompanyTeamData(companyId);
    
    return NextResponse.json({
      success: true,
      message: 'Keylika founders added successfully',
      data: {
        founders_added: keylikaFounders.length,
        retrieved_data: teamData,
        summary: {
          founders_in_db: teamData.founders.length,
          funding_data_saved: !!teamData.funding,
          sources: teamData.funding?.sources || []
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to add Keylika founders:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to add Keylika founders'
    }, { status: 500 });
  }
}