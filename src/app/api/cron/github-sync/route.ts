/**
 * API Route: GitHub Sync Cron Job
 * 
 * Scheduled endpoint for daily GitHub data synchronization
 * This can be triggered by external cron services like Vercel Cron or GitHub Actions
 */

import { NextRequest, NextResponse } from 'next/server';
import { githubSyncService } from '@/lib/github-sync-service';

/**
 * POST /api/cron/github-sync
 * Execute daily GitHub data synchronization
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
    
    if (!authHeader || authHeader !== expectedAuth) {
      console.error('Unauthorized cron job access attempt');
      return NextResponse.json({
        success: false,
        error: 'Unauthorized - Invalid cron secret',
      }, { status: 401 });
    }

    console.log('🕐 Starting scheduled GitHub sync job...');

    // Check if sync is already running
    const status = githubSyncService.getSyncStatus();
    if (status.isRunning) {
      console.log('⚠️ Sync job already running, skipping scheduled execution');
      return NextResponse.json({
        success: false,
        error: 'Sync job already running',
        skipped: true,
        status: status,
      });
    }

    // Execute daily sync
    const result = await githubSyncService.executeDailySync();

    const logLevel = result.success ? 'info' : 'error';
    const logMessage = result.success 
      ? `✅ Scheduled sync completed: ${result.processed} repositories processed, ${result.failed} failed`
      : `❌ Scheduled sync failed: ${result.errors.join(', ')}`;
    
    console[logLevel](logMessage);

    // Return result
    return NextResponse.json({
      success: result.success,
      message: logMessage,
      data: {
        sync_log_id: result.syncLogId,
        repositories_processed: result.processed,
        repositories_failed: result.failed,
        errors: result.errors,
        rate_limit: result.rateLimit,
        execution_time: new Date().toISOString(),
      },
    }, { 
      status: result.success ? 200 : 500 
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown cron job error';
    console.error('❌ Scheduled GitHub sync failed:', errorMessage);
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      execution_time: new Date().toISOString(),
    }, { 
      status: 500 
    });
  }
}

/**
 * GET /api/cron/github-sync
 * Health check for cron job endpoint
 */
export async function GET(request: NextRequest) {
  try {
    // Get current sync status and statistics
    const [status, stats] = await Promise.all([
      githubSyncService.getSyncStatus(),
      githubSyncService.getSyncStatistics()
    ]);

    return NextResponse.json({
      success: true,
      message: 'GitHub sync cron job endpoint is healthy',
      data: {
        endpoint_status: 'healthy',
        current_sync_status: status,
        sync_statistics: stats,
        last_check: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Cron health check error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Health check failed',
      endpoint_status: 'unhealthy',
      last_check: new Date().toISOString(),
    }, { 
      status: 500 
    });
  }
}