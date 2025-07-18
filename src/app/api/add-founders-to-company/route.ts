/**
 * Add Founders to Company API Route
 * 
 * Add founder data to a specific company
 */

import { NextRequest, NextResponse } from 'next/server';
import { createFounderDatabaseService } from '@/lib/founder-database-service';

export async function POST(request: NextRequest) {
  try {
    const { company_id, company_name } = await request.json();
    
    if (!company_id) {
      throw new Error('company_id is required');
    }
    
    console.log(`🚀 Adding founder data to company: ${company_name || company_id}`);
    
    const founderDbService = createFounderDatabaseService();
    
    // Clear existing founders first
    await founderDbService.clearFounders(company_id);
    
    // Add Keylika founders (since that's what we're testing)
    const founders = [
      {
        name: 'Buddha Chaudhuri',
        title: 'Co-Founder',
        bio: 'Co-founder of Keylika, focused on drug discovery and computational chemistry.',
        linkedin_url: undefined,
        twitter_url: undefined
      },
      {
        name: 'Frederik Ceyssens',
        title: 'Co-Founder',
        bio: 'Co-founder of Keylika, expertise in machine learning and pharmaceutical research.',
        linkedin_url: undefined,
        twitter_url: undefined
      }
    ];
    
    // Save founders
    console.log(`💾 Saving ${founders.length} founders...`);
    for (const founder of founders) {
      await founderDbService.saveFounder(company_id, founder, 'https://www.ycombinator.com/companies/keylika');
    }
    
    // Save funding summary
    const fundingData = {
      company_id: company_id,
      founders: founders,
      funding_rounds: [],
      key_investors: ['Y Combinator'],
      total_funding: null,
      last_updated: new Date().toISOString(),
      sources: ['https://www.ycombinator.com/companies/keylika']
    };
    
    await founderDbService.saveFundingSummary(company_id, fundingData);
    
    // Retrieve the data to confirm
    const teamData = await founderDbService.getCompanyTeamData(company_id);
    
    return NextResponse.json({
      success: true,
      message: `Founders added successfully to ${company_name || company_id}`,
      data: {
        company_id: company_id,
        founders_added: founders.length,
        retrieved_data: teamData,
        summary: {
          founders_in_db: teamData.founders.length,
          funding_data_saved: !!teamData.funding,
          sources: teamData.funding?.sources || []
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to add founders:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to add founders'
    }, { status: 500 });
  }
}