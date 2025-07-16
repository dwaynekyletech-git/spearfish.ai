/**
 * Test Founder Scraper API Route
 * 
 * Test endpoint to verify founder and funding data scraping
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSpearfishDatabaseService } from '@/lib/spearfish-database-service';
import { createFounderScraperService } from '@/lib/founder-scraper-service';

export async function GET(request: NextRequest) {
  try {
    console.log('🚀 Testing founder scraper...');
    
    // Get a sample company to test with
    const databaseService = createSpearfishDatabaseService(true);
    const scraperService = createFounderScraperService();
    
    const companies = await databaseService.getCompaniesWithScores({
      limit: 5,
      orderBy: 'score',
      orderDirection: 'desc'
    });
    
    if (companies.length === 0) {
      throw new Error('No companies found to test with');
    }
    
    console.log(`📈 Found ${companies.length} companies for testing`);
    
    // Test scraping on the first company
    const testCompany = companies[0];
    console.log(`🔍 Testing scraper on: ${testCompany.name}`);
    
    const teamData = await scraperService.scrapeCompanyData(testCompany);
    const cleanedData = scraperService.cleanTeamData(teamData);
    
    console.log('📊 Scraper Results:', {
      founders_found: cleanedData.founders.length,
      sources_checked: cleanedData.sources.length
    });
    
    return NextResponse.json({
      success: true,
      message: 'Founder scraper test completed',
      data: {
        test_company: {
          name: testCompany.name,
          website_url: testCompany.website_url,
          yc_url: (testCompany as any).yc_url
        },
        scraping_results: cleanedData,
        summary: {
          founders_found: cleanedData.founders.length,
          sources_checked: cleanedData.sources.length,
          success_rate: cleanedData.founders.length > 0 ? 'Found founders' : 'No founders found'
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Founder scraper test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Founder scraper test failed'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { company_id, test_mode } = await request.json();
    
    console.log('🚀 Running founder scraper for specific company...');
    
    const databaseService = createSpearfishDatabaseService(true);
    const scraperService = createFounderScraperService();
    
    // Get specific company or sample companies
    let companies;
    if (company_id) {
      companies = await databaseService.getCompaniesWithScores({ limit: 100 });
      companies = companies.filter(c => c.id === company_id);
    } else {
      const limit = test_mode ? 3 : 20;
      companies = await databaseService.getCompaniesWithScores({
        limit,
        orderBy: 'score',
        orderDirection: 'desc'
      });
    }
    
    if (companies.length === 0) {
      throw new Error('No companies found');
    }
    
    console.log(`📈 Processing ${companies.length} companies`);
    
    const results = [];
    
    for (const company of companies) {
      try {
        console.log(`🔍 Scraping: ${company.name}`);
        
        const teamData = await scraperService.scrapeCompanyData(company);
        const cleanedData = scraperService.cleanTeamData(teamData);
        
        results.push({
          company: {
            id: company.id,
            name: company.name,
            website_url: company.website_url
          },
          scraping_results: cleanedData,
          success: cleanedData.sources.length > 0 || cleanedData.founders.length > 0
        });
        
        // Brief pause between companies
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ Error scraping ${company.name}:`, error);
        results.push({
          company: {
            id: company.id,
            name: company.name,
            website_url: company.website_url
          },
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false
        });
      }
    }
    
    const summary = {
      total_companies: companies.length,
      successful_scrapes: results.filter(r => r.success).length,
      failed_scrapes: results.filter(r => !r.success).length,
      total_founders_found: results.reduce((sum, r) => sum + (r.scraping_results?.founders?.length || 0), 0),
      average_founders_per_company: (results.reduce((sum, r) => sum + (r.scraping_results?.founders?.length || 0), 0) / companies.length).toFixed(1),
      success_rate: ((results.filter(r => r.success).length / companies.length) * 100).toFixed(1) + '%'
    };
    
    console.log('📊 Scraping Summary:', summary);
    
    return NextResponse.json({
      success: true,
      message: 'Founder scraping completed',
      data: {
        results,
        summary
      }
    });
    
  } catch (error) {
    console.error('❌ Founder scraping failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Founder scraping failed'
    }, { status: 500 });
  }
}