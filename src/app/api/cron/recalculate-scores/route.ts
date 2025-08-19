/**
 * API Route: Daily Score Recalculation Cron Job
 * 
 * Automated job to recalculate spearfish scores for all companies
 * Runs daily via Vercel cron
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSpearfishDatabaseService } from '@/lib/spearfish-database-service';
import { spearfishScoringService } from '@/lib/spearfish-scoring-service';

/**
 * GET /api/cron/recalculate-scores
 * Daily cron job to recalculate all company scores
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Unauthorized - Invalid cron secret' 
        },
        { status: 401 }
      );
    }

    console.log('🔄 Starting daily score recalculation job...');
    
    const databaseService = createSpearfishDatabaseService(true, true); // Use server client with service role
    
    // Get companies that need recalculation (older than 24 hours)
    const companiesNeedingRecalculation = await databaseService.getCompaniesNeedingRecalculation({
      olderThan: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
      batchSize: 100, // Process in batches of 100
      batches: ['W22', 'S22', 'W23'], // Only target batches
    });

    console.log(`📊 Found ${companiesNeedingRecalculation.length} companies needing recalculation`);

    if (companiesNeedingRecalculation.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No companies need recalculation',
        data: {
          companiesProcessed: 0,
          processingTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Process companies in smaller chunks to avoid timeouts
    const chunkSize = 20;
    const chunks = [];
    for (let i = 0; i < companiesNeedingRecalculation.length; i += chunkSize) {
      chunks.push(companiesNeedingRecalculation.slice(i, i + chunkSize));
    }

    let totalProcessed = 0;
    let totalSuccessful = 0;
    let totalFailed = 0;
    const errors: string[] = [];

    for (const chunk of chunks) {
      try {
        const batchResult = await databaseService.batchUpdateCompanyScores(chunk);
        totalProcessed += batchResult.total_processed;
        totalSuccessful += batchResult.successful_updates;
        totalFailed += batchResult.failed_updates;
        
        console.log(`✅ Processed chunk: ${batchResult.successful_updates}/${batchResult.total_processed} successful`);
      } catch (error) {
        console.error('❌ Error processing chunk:', error);
        errors.push(`Chunk processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        totalFailed += chunk.length;
      }
    }

    // Get updated statistics
    const statistics = await databaseService.getScoringStatistics();

    const result = {
      success: totalSuccessful > 0,
      message: `Daily score recalculation completed`,
      data: {
        companiesProcessed: totalProcessed,
        successfulUpdates: totalSuccessful,
        failedUpdates: totalFailed,
        processingTime: Date.now() - startTime,
        errors: errors.length > 0 ? errors : undefined,
        statistics,
        timestamp: new Date().toISOString(),
      },
    };

    console.log(`🎯 Daily recalculation complete: ${totalSuccessful}/${totalProcessed} successful in ${Date.now() - startTime}ms`);

    return NextResponse.json(result, {
      status: totalSuccessful > 0 ? 200 : 207, // 207 = Multi-Status (partial success)
    });

  } catch (error) {
    console.error('❌ Fatal error in daily score recalculation:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/recalculate-scores
 * Manual trigger for score recalculation (for testing)
 */
export async function POST(request: NextRequest) {
  try {
    // For manual triggers, we can use a different authentication method
    // For now, let's use the same cron secret or allow authenticated users
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Unauthorized - Authentication required' 
        },
        { status: 401 }
      );
    }

    // Parse request body for custom parameters
    const body = await request.json().catch(() => ({}));
    const { 
      batchSize = 50, 
      targetBatches = ['W22', 'S22', 'W23'],
      maxAge = 24,
      forceAll = false,
      algorithmVersion = null
    } = body;

    console.log('🔄 Starting manual score recalculation job...');
    
    const databaseService = createSpearfishDatabaseService(true, true); // Use server client with service role
    
    // Get companies that need recalculation
    const companiesNeedingRecalculation = await databaseService.getCompaniesNeedingRecalculation({
      olderThan: forceAll ? undefined : new Date(Date.now() - maxAge * 60 * 60 * 1000),
      batchSize,
      batches: targetBatches,
      forceAll,
      algorithmVersion,
    });

    if (companiesNeedingRecalculation.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No companies need recalculation',
        data: {
          companiesProcessed: 0,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Process all companies in one batch for manual triggers
    const batchResult = await databaseService.batchUpdateCompanyScores(companiesNeedingRecalculation);
    
    // Get updated statistics
    const statistics = await databaseService.getScoringStatistics();

    return NextResponse.json({
      success: true,
      message: `Manual score recalculation completed`,
      data: {
        companiesProcessed: batchResult.total_processed,
        successfulUpdates: batchResult.successful_updates,
        failedUpdates: batchResult.failed_updates,
        processingTime: batchResult.processing_time_ms,
        batchId: batchResult.batch_id,
        statistics,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('❌ Error in manual score recalculation:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}