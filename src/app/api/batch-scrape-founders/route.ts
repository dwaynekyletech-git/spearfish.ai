/**
 * Batch Scrape Founders API Route
 * 
 * Scrape and save founder data for multiple companies
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createFounderScraperService } from '@/lib/founder-scraper-service';
import { createFounderDatabaseService } from '@/lib/founder-database-service';

export async function POST(request: NextRequest) {
  try {
    const { limit = 10, skip_existing = true } = await request.json();
    
    console.log(`🚀 Starting batch founder scraping for up to ${limit} companies...`);
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const scraperService = createFounderScraperService();
    const founderDbService = createFounderDatabaseService();
    
    // Get companies that need founder data (exclude test companies)
    const { data: allCompanies, error: companiesError } = await supabase
      .from('companies')
      .select('id, name, slug, website_url, yc_url, batch')
      .not('name', 'ilike', '%test%')
      .not('name', 'ilike', '%example%')
      .not('slug', 'eq', 'test-ai-startup')
      .limit(50); // Get a larger pool to check

    if (companiesError) {
      throw new Error(`Failed to fetch companies: ${companiesError.message}`);
    }

    // Check each company for existing founders
    const companies = [];
    for (const company of allCompanies || []) {
      if (skip_existing) {
        const { data: existingFounders, error: foundersError } = await supabase
          .from('founders')
          .select('id')
          .eq('company_id', company.id)
          .limit(1);
        
        if (foundersError) {
          console.warn(`Error checking founders for ${company.name}:`, foundersError);
          continue;
        }
        
        // Skip if founders already exist
        if (existingFounders && existingFounders.length > 0) {
          console.log(`⏭️ Skipping ${company.name} - already has founders`);
          continue;
        }
      }
      
      companies.push(company);
      if (companies.length >= limit) break;
    }

    if (companies.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No companies need founder scraping',
        data: {
          results: [],
          summary: {
            total_companies: 0,
            successful_scrapes: 0,
            failed_scrapes: 0,
            total_founders_found: 0,
            success_rate: '0%'
          }
        }
      });
    }
    
    console.log(`📈 Processing ${companies.length} companies that need founder data`);
    
    const results = [];
    
    for (const company of companies) {
      try {
        console.log(`🔍 Scraping: ${company.name}`);
        
        // Convert to the format expected by scraper
        const companyData = {
          id: company.id,
          name: company.name,
          slug: company.slug,
          website_url: company.website_url,
          yc_url: company.yc_url,
          batch: company.batch,
          status: 'Active' as const,
          tags: [],
          regions: [],
          is_hiring: false,
          github_repos: [],
          huggingface_models: []
        };
        
        // Scrape founder data
        const teamData = await scraperService.scrapeCompanyData(companyData);
        const cleanedData = scraperService.cleanTeamData(teamData);
        
        // Save to database if we found data
        if (cleanedData.founders.length > 0) {
          await founderDbService.saveTeamData(company.id, cleanedData);
          console.log(`✅ Saved ${cleanedData.founders.length} founders for ${company.name}`);
        } else {
          console.log(`⚠️ No founders found for ${company.name}`);
        }
        
        results.push({
          company: {
            id: company.id,
            name: company.name,
            website_url: company.website_url,
            yc_url: company.yc_url
          },
          scraping_results: cleanedData,
          saved_to_db: cleanedData.founders.length > 0,
          success: true
        });
        
        // Brief pause between companies to be respectful
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ Error processing ${company.name}:`, error);
        results.push({
          company: {
            id: company.id,
            name: company.name,
            website_url: company.website_url,
            yc_url: company.yc_url
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
    
    console.log('📊 Batch scraping summary:', summary);
    
    return NextResponse.json({
      success: true,
      message: 'Batch founder scraping completed',
      data: {
        results,
        summary
      }
    });
    
  } catch (error) {
    console.error('❌ Batch founder scraping failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Batch founder scraping failed'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '5');
    
    // Trigger batch scraping with default parameters
    const response = await fetch(request.url.replace('/GET', ''), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit, skip_existing: true })
    });
    
    return response;
    
  } catch (error) {
    console.error('❌ Batch scraping GET failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Batch scraping failed'
    }, { status: 500 });
  }
}