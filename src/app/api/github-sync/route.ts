/**
 * API Route: GitHub Sync Jobs
 * 
 * Endpoints for triggering and monitoring GitHub data synchronization
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { githubSyncService } from '@/lib/github-sync-service';

// Request schema validation
const SyncRequestSchema = z.object({
  sync_type: z.enum(['full', 'incremental', 'repository', 'metrics']).optional().default('incremental'),
  company_id: z.string().uuid().optional(),
  repository_id: z.string().uuid().optional(),
  force: z.boolean().optional().default(false),
});

/**
 * POST /api/github-sync
 * Trigger GitHub data synchronization
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication (admin/service only)
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Unauthorized - Authentication required' 
        },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const params = SyncRequestSchema.parse(body);

    console.log('GitHub sync requested:', params);

    // Check if sync is already running
    const status = githubSyncService.getSyncStatus();
    if (status.isRunning && !params.force) {
      return NextResponse.json({
        success: false,
        error: 'Sync job already running',
        status: {
          isRunning: true,
          queueSize: status.queueSize,
        },
      }, { status: 409 });
    }

    // Execute appropriate sync type
    let result;
    if (params.repository_id) {
      result = await githubSyncService.syncSingleRepository(params.repository_id);
    } else if (params.company_id) {
      result = await githubSyncService.syncCompanyRepositories(params.company_id);
    } else if (params.sync_type === 'full') {
      result = await githubSyncService.executeFullSync();
    } else {
      result = await githubSyncService.executeDailySync();
    }

    const responseStatus = result.success ? 200 : 500;

    return NextResponse.json({
      success: result.success,
      message: result.success 
        ? `Sync completed: ${result.processed} repositories processed`
        : `Sync failed: ${result.errors.join(', ')}`,
      data: {
        sync_log_id: result.syncLogId,
        repositories_processed: result.processed,
        repositories_failed: result.failed,
        errors: result.errors,
        rate_limit: result.rateLimit,
      },
      timestamp: new Date().toISOString(),
    }, { status: responseStatus });

  } catch (error) {
    console.error('GitHub sync API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request parameters',
        details: error.errors,
      }, { status: 400 });
    }
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

/**
 * GET /api/github-sync
 * Get sync status and statistics
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Unauthorized - Authentication required' 
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';

    switch (action) {
      case 'status':
        const status = githubSyncService.getSyncStatus();
        return NextResponse.json({
          success: true,
          data: {
            current_status: status,
            timestamp: new Date().toISOString(),
          },
        });

      case 'statistics':
        const stats = await githubSyncService.getSyncStatistics();
        return NextResponse.json({
          success: true,
          data: {
            statistics: stats,
            timestamp: new Date().toISOString(),
          },
        });

      case 'logs':
        const limitParam = searchParams.get('limit');
        const limit = limitParam ? parseInt(limitParam, 10) : 10;
        const logs = await githubSyncService.getRecentSyncLogs(limit);
        
        return NextResponse.json({
          success: true,
          data: {
            recent_logs: logs,
            count: logs.length,
            timestamp: new Date().toISOString(),
          },
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action parameter',
          available_actions: ['status', 'statistics', 'logs'],
        }, { status: 400 });
    }

  } catch (error) {
    console.error('GitHub sync status API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}