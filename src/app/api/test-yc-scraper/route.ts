/**
 * Test YC Scraper API Route
 * 
 * Test YC company page scraping directly
 */

import { NextRequest, NextResponse } from 'next/server';
import { createFounderScraperService } from '@/lib/founder-scraper-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companySlug = searchParams.get('company') || 'keylika';
    
    console.log(`🚀 Testing YC scraper on: ${companySlug}`);
    
    const scraperService = createFounderScraperService();
    
    // Create a mock company object for testing
    const mockCompany = {
      id: 'test-id',
      name: companySlug.charAt(0).toUpperCase() + companySlug.slice(1),
      slug: companySlug,
      website_url: `https://${companySlug}.com`,
      yc_url: `https://www.ycombinator.com/companies/${companySlug}`,
      batch: 'Unknown',
      status: 'Active' as const,
      tags: [],
      regions: [],
      is_hiring: false,
      github_repos: [],
      huggingface_models: []
    };
    
    console.log(`🔍 Testing YC scraper on: ${mockCompany.yc_url}`);
    
    const fundingData = await scraperService.scrapeCompanyData(mockCompany);
    const cleanedData = scraperService.cleanData(fundingData);
    
    console.log('📊 YC Scraper Results:', {
      founders_found: cleanedData.founders.length,
      funding_found: !!cleanedData.total_funding,
      sources_checked: cleanedData.sources.length
    });
    
    return NextResponse.json({
      success: true,
      message: 'YC scraper test completed',
      data: {
        test_company: {
          name: mockCompany.name,
          yc_url: mockCompany.yc_url
        },
        scraping_results: cleanedData,
        summary: {
          founders_found: cleanedData.founders.length,
          total_funding: cleanedData.total_funding,
          sources_checked: cleanedData.sources.length,
          founders_list: cleanedData.founders.map(f => `${f.name} (${f.title})`),
          success_rate: cleanedData.sources.length > 0 ? 'Available' : 'No data found'
        }
      }
    });
    
  } catch (error) {
    console.error('❌ YC scraper test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'YC scraper test failed'
    }, { status: 500 });
  }
}