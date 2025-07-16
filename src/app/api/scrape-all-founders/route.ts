/**
 * Scrape All Founders API Route
 * 
 * Scrapes founder information for all companies and stores in database
 */

import { NextRequest, NextResponse } from 'next/server';
import { createFounderScraperService } from '@/lib/founder-scraper-service';
import { createFounderDatabaseService } from '@/lib/founder-database-service';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting founder scraping for all companies...');
    
    const scraperService = createFounderScraperService();
    const founderDbService = createFounderDatabaseService();
    
    // Get companies from the list endpoint
    const response = await fetch(`${request.nextUrl.origin}/api/list-companies`);
    if (!response.ok) {
      throw new Error('Failed to fetch companies');
    }
    
    const companiesData = await response.json();
    const companies = companiesData.data.companies;
    
    if (companies.length === 0) {
      throw new Error('No companies found');
    }
    
    console.log(`📈 Processing ${companies.length} companies`);
    
    const results = [];
    
    for (const company of companies) {
      try {
        console.log(`🔍 Scraping founders for: ${company.name}`);
        
        // Convert company to the format expected by scraper
        const scrapingCompany = {
          id: company.id,
          name: company.name,
          batch: company.batch || 'Unknown',
          status: 'Active' as const,
          tags: [],
          regions: ['usa'],
          is_hiring: false,
          github_repos: [],
          huggingface_models: [],
          website_url: company.website_url,
          description: `${company.name} company`,
          one_liner: company.name,
          team_size: 10,
          location: 'San Francisco',
          founded_year: 2020
        };
        
        const teamData = await scraperService.scrapeCompanyData(scrapingCompany);
        
        if (teamData.founders && teamData.founders.length > 0) {
          // Save team data to database
          await founderDbService.saveTeamData(company.id, teamData);
          
          console.log(`✅ Saved ${teamData.founders.length} founders for ${company.name}`);
        } else {
          console.log(`❌ No founders found for ${company.name}`);
        }
        
        results.push({
          company: {
            id: company.id,
            name: company.name,
            website_url: company.website_url
          },
          founders_found: teamData.founders?.length || 0,
          founders: teamData.founders || [],
          sources: teamData.sources,
          success: (teamData.founders?.length || 0) > 0
        });
        
        // Brief pause between companies to be respectful
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ Error scraping ${company.name}:`, error);
        results.push({
          company: {
            id: company.id,
            name: company.name,
            website_url: company.website_url
          },
          founders_found: 0,
          founders: [],
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false
        });
      }
    }
    
    const summary = {
      total_companies: companies.length,
      successful_scrapes: results.filter(r => r.success).length,
      failed_scrapes: results.filter(r => !r.success).length,
      total_founders_found: results.reduce((sum, r) => sum + r.founders_found, 0),
      average_founders_per_company: (results.reduce((sum, r) => sum + r.founders_found, 0) / companies.length).toFixed(1),
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