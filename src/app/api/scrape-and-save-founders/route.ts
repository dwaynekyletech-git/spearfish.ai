/**
 * Scrape and Save Founders API Route
 * 
 * Test endpoint to scrape founder data and save it to the database
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSpearfishDatabaseService } from '@/lib/spearfish-database-service';
import { createFounderScraperService } from '@/lib/founder-scraper-service';
import { createFounderDatabaseService } from '@/lib/founder-database-service';

export async function POST(request: NextRequest) {
  try {
    const { company_name } = await request.json();
    
    console.log(`🚀 Scraping and saving founder data for: ${company_name || 'test companies'}`);
    
    const databaseService = createSpearfishDatabaseService(true);
    const scraperService = createFounderScraperService();
    const founderDbService = createFounderDatabaseService();
    
    // Get companies to scrape
    let companies;
    if (company_name) {
      companies = await databaseService.getCompaniesWithScores({ limit: 100 });
      companies = companies.filter(c => 
        c.name.toLowerCase().includes(company_name.toLowerCase())
      );
    } else {
      // Get first few companies for testing
      companies = await databaseService.getCompaniesWithScores({
        limit: 3,
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
        
        // Scrape founder data
        const fundingData = await scraperService.scrapeCompanyData(company);
        const cleanedData = scraperService.cleanData(fundingData);
        
        // Save to database
        if (cleanedData.founders.length > 0 || (cleanedData as any).total_funding) {
          await founderDbService.saveFundingData(company.id, cleanedData);
          console.log(`✅ Saved data for ${company.name}: ${cleanedData.founders.length} founders`);
        }
        
        results.push({
          company: {
            id: company.id,
            name: company.name,
            website_url: company.website_url
          },
          scraping_results: cleanedData,
          saved_to_db: cleanedData.founders.length > 0 || !!(cleanedData as any).total_funding,
          success: true
        });
        
        // Brief pause between companies
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ Error processing ${company.name}:`, error);
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
      companies_with_data: results.filter(r => r.saved_to_db).length,
      total_founders_found: results.reduce((sum, r) => sum + (r.scraping_results?.founders?.length || 0), 0),
      success_rate: ((results.filter(r => r.success).length / companies.length) * 100).toFixed(1) + '%'
    };
    
    console.log('📊 Scraping and saving summary:', summary);
    
    return NextResponse.json({
      success: true,
      message: 'Founder data scraping and saving completed',
      data: {
        results,
        summary
      }
    });
    
  } catch (error) {
    console.error('❌ Founder scraping and saving failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Founder scraping and saving failed'
    }, { status: 500 });
  }
}