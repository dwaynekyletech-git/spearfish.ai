/**
 * Test Team Data API Route
 * 
 * Test endpoint to create and retrieve team data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createFounderDatabaseService } from '@/lib/founder-database-service';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Testing team data functionality...');
    
    const founderDbService = createFounderDatabaseService();
    
    // Get sample company ID from the database
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get first company
    const { data: companies, error } = await supabase
      .from('companies')
      .select('id, name, website_url')
      .limit(1);
    
    if (error || !companies || companies.length === 0) {
      throw new Error('No companies found in database');
    }
    
    const testCompany = companies[0];
    console.log(`📈 Testing with company: ${testCompany.name} (${testCompany.id})`);
    
    // Create test founder data
    const testFounders = [
      {
        name: 'John Doe',
        title: 'CEO & Co-Founder',
        bio: 'Experienced tech entrepreneur with 10+ years in AI and machine learning.',
        linkedin_url: 'https://linkedin.com/in/johndoe',
        twitter_url: 'https://twitter.com/johndoe'
      },
      {
        name: 'Jane Smith',
        title: 'CTO & Co-Founder',
        bio: 'Former Google engineer specializing in distributed systems and AI infrastructure.',
        linkedin_url: 'https://linkedin.com/in/janesmith'
      }
    ];
    
    // Save founders
    console.log('💾 Saving test founder data...');
    for (const founder of testFounders) {
      await founderDbService.saveFounder(testCompany.id, founder, 'Test data');
    }
    
    // Save funding summary
    const testFundingData = {
      company_id: testCompany.id,
      founders: testFounders,
      funding_rounds: [],
      key_investors: ['YC', 'Sequoia Capital', 'Andreessen Horowitz'],
      total_funding: '5M',
      last_updated: new Date().toISOString(),
      sources: ['Y Combinator', 'Company Website']
    };
    
    await founderDbService.saveFundingSummary(testCompany.id, testFundingData);
    
    // Retrieve the data
    console.log('📊 Retrieving saved team data...');
    const teamData = await founderDbService.getCompanyTeamData(testCompany.id);
    
    return NextResponse.json({
      success: true,
      message: 'Team data test completed successfully',
      data: {
        test_company: testCompany,
        saved_data: testFundingData,
        retrieved_data: teamData,
        summary: {
          founders_saved: testFounders.length,
          founders_retrieved: teamData.founders.length,
          funding_data_saved: !!testFundingData.total_funding,
          funding_data_retrieved: !!teamData.funding
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Team data test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Team data test failed'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');
    
    if (!companyId) {
      return NextResponse.json({
        success: false,
        error: 'company_id parameter is required'
      }, { status: 400 });
    }
    
    console.log(`🔍 Fetching team data for company: ${companyId}`);
    
    const founderDbService = createFounderDatabaseService();
    const teamData = await founderDbService.getCompanyTeamData(companyId);
    
    return NextResponse.json({
      success: true,
      data: teamData,
      founders: teamData.founders,
      funding: teamData.funding
    });
    
  } catch (error) {
    console.error('❌ Failed to fetch team data:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to fetch team data'
    }, { status: 500 });
  }
}