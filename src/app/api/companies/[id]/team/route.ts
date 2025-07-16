/**
 * Company Team API Route
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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const companyId = params.id;
    const { action } = await request.json();
    
    if (!companyId) {
      return NextResponse.json({
        success: false,
        error: 'Company ID is required'
      }, { status: 400 });
    }

    if (action === 'scrape') {
      // Trigger scraping for this company
      console.log(`🚀 Triggering team data scraping for company: ${companyId}`);
      
      // Import the scraper services
      const { createFounderScraperService } = await import('@/lib/founder-scraper-service');
      const { createSpearfishDatabaseService } = await import('@/lib/spearfish-database-service');
      const founderDbService = createFounderDatabaseService();
      
      // Get company data
      const databaseService = createSpearfishDatabaseService(true);
      const companies = await databaseService.getCompaniesWithScores({ limit: 1000 });
      const company = companies.find(c => c.id === companyId);
      
      if (!company) {
        return NextResponse.json({
          success: false,
          error: 'Company not found'
        }, { status: 404 });
      }
      
      // Scrape founder data
      const scraperService = createFounderScraperService();
      const fundingData = await scraperService.scrapeCompanyData(company);
      const cleanedData = scraperService.cleanData(fundingData);
      
      // Save to database
      await founderDbService.saveFundingData(companyId, cleanedData);
      
      // Return the fresh data
      const teamData = await founderDbService.getCompanyTeamData(companyId);
      
      return NextResponse.json({
        success: true,
        message: 'Team data scraped and saved successfully',
        data: teamData,
        founders: teamData.founders,
        funding: teamData.funding,
        scraping_summary: {
          founders_found: cleanedData.founders.length,
          funding_found: !!cleanedData.total_funding,
          sources_used: cleanedData.sources.length
        }
      });
    }
    
    return NextResponse.json({
      success: false,
      error: 'Invalid action'
    }, { status: 400 });
    
  } catch (error) {
    console.error(`❌ Error handling team action for ${params.id}:`, error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to handle team action'
    }, { status: 500 });
  }
}