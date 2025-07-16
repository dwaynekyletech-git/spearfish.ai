/**
 * Test YC Re-sync API Route
 * 
 * Test endpoint to verify YC data re-sync with new fields
 */

import { NextRequest, NextResponse } from 'next/server';
import { createYCClient } from '@/lib/yc-api';
import { createYCDatabaseService } from '@/lib/yc-database';

export async function GET(request: NextRequest) {
  try {
    console.log('🚀 Testing YC data re-sync with new fields...');
    
    // Initialize services
    const ycClient = createYCClient();
    const dbService = createYCDatabaseService();
    
    // Test database connection
    console.log('📊 Testing database connection...');
    const isConnected = await dbService.testConnection();
    if (!isConnected) {
      throw new Error('Database connection failed');
    }
    console.log('✅ Database connection successful');
    
    // Get a small sample of companies from YC API
    console.log('🔍 Fetching sample companies from YC API...');
    const companies = await ycClient.getCompanies({ limit: 5 });
    console.log(`📈 Found ${companies.length} companies from YC API`);
    
    // Show what new fields we're getting
    const sampleCompany = companies[0];
    const newFieldsData = {
      name: sampleCompany.name,
      former_names: sampleCompany.former_names,
      all_locations: sampleCompany.all_locations,
      industries: sampleCompany.industries,
      tags_highlighted: sampleCompany.tags_highlighted,
      nonprofit: sampleCompany.nonprofit,
      top_company: sampleCompany.top_company,
      demo_day_video_public: sampleCompany.demo_day_video_public,
      app_video_public: sampleCompany.app_video_public,
      yc_url: sampleCompany.url,
      yc_api_url: sampleCompany.api,
    };
    
    console.log('📋 Sample company with new fields:', newFieldsData);
    
    // Test upserting the sample companies
    console.log('🔄 Testing upsert with new fields...');
    const results = await dbService.upsertCompanies(companies);
    
    const summary = {
      database_connected: isConnected,
      companies_fetched: companies.length,
      sample_new_fields: newFieldsData,
      upsert_results: {
        successful: results.successful.length,
        failed: results.failed.length,
        errors: results.failed.map(f => ({
          company: f.company.name,
          error: f.error
        }))
      }
    };
    
    console.log('📊 Test Results:', summary);
    
    return NextResponse.json({
      success: true,
      message: 'YC re-sync test completed successfully',
      data: summary
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'YC re-sync test failed'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { full_sync } = await request.json();
    
    console.log('🚀 Starting YC data re-sync...');
    
    // Initialize services
    const ycClient = createYCClient();
    const dbService = createYCDatabaseService();
    
    // Test database connection
    const isConnected = await dbService.testConnection();
    if (!isConnected) {
      throw new Error('Database connection failed');
    }
    
    // Get companies (limit for testing unless full_sync is true)
    const limit = full_sync ? undefined : 50;
    const companies = await ycClient.getCompanies({ limit });
    console.log(`📈 Found ${companies.length} companies from YC API`);
    
    // Process companies in batches
    const batchSize = 25;
    const batches = [];
    for (let i = 0; i < companies.length; i += batchSize) {
      batches.push(companies.slice(i, i + batchSize));
    }
    
    console.log(`📦 Processing ${batches.length} batches of ${batchSize} companies each`);
    
    let totalSuccess = 0;
    let totalFailed = 0;
    const errors = [];
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`🔄 Processing batch ${i + 1}/${batches.length} (${batch.length} companies)...`);
      
      try {
        const results = await dbService.upsertCompanies(batch);
        totalSuccess += results.successful.length;
        totalFailed += results.failed.length;
        
        if (results.failed.length > 0) {
          errors.push(...results.failed.map(f => ({
            company: f.company.name,
            error: f.error
          })));
        }
        
        // Brief pause between batches
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Batch ${i + 1} failed completely:`, error);
        totalFailed += batch.length;
        errors.push({
          batch: i + 1,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    // Get updated sync statistics
    const stats = await dbService.getSyncStatistics();
    
    const summary = {
      total_companies: companies.length,
      successful: totalSuccess,
      failed: totalFailed,
      success_rate: ((totalSuccess / companies.length) * 100).toFixed(1) + '%',
      database_stats: {
        total_companies: stats.total_companies,
        last_sync_date: stats.last_sync_date,
        ai_companies: stats.ai_companies
      },
      errors: errors.slice(0, 10) // Show first 10 errors
    };
    
    console.log('📊 Re-sync Summary:', summary);
    
    return NextResponse.json({
      success: true,
      message: 'YC data re-sync completed',
      data: summary
    });
    
  } catch (error) {
    console.error('❌ Re-sync failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'YC data re-sync failed'
    }, { status: 500 });
  }
}