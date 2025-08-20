/**
 * GitHub Data Sync API Endpoint
 * 
 * CRITICAL FIX: This endpoint will sync existing GitHub repository associations
 * to the companies.github_repos JSONB field so your website can display them.
 * 
 * Usage: POST /api/sync/github
 */

import { NextRequest, NextResponse } from 'next/server';
import { dataSyncService } from '@/lib/data-sync-service';
import { createServiceClient } from '@/lib/supabase-server';
import { logInfo, logError } from '@/lib/logger';

// =============================================================================
// API Route Handler
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    logInfo('🔧 GitHub sync API called');

    // Verify this is not being called too frequently
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';
    
    if (!force) {
      // Check if we've synced recently (within last hour)
      // This prevents accidental multiple syncs
      const lastSync = await getLastSyncTime();
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      
      if (lastSync && lastSync > oneHourAgo) {
        return NextResponse.json({
          success: false,
          message: 'GitHub data was synced recently. Use ?force=true to override.',
          lastSyncTime: new Date(lastSync).toISOString()
        }, { status: 429 }); // Too Many Requests
      }
    }

    // Perform the sync
    const syncResult = await dataSyncService.syncGitHubDataToCompanies();
    
    // Get updated status
    const status = await dataSyncService.getSyncStatus();
    
    // Verify consistency
    const consistency = await dataSyncService.verifyDataConsistency();

    // Record sync time
    await recordSyncTime();

    // Prepare response
    const response = {
      success: syncResult.success,
      message: syncResult.success 
        ? `✅ Successfully synced GitHub data for ${syncResult.companiesUpdated} companies`
        : `❌ Sync completed with ${syncResult.errors.length} errors`,
      data: {
        syncResult,
        status,
        consistency,
        timestamp: new Date().toISOString()
      }
    };

    const httpStatus = syncResult.success ? 200 : 207; // 207 = Multi-Status (partial success)

    if (syncResult.success) {
      logInfo('✅ GitHub sync completed successfully', {
        companiesUpdated: syncResult.companiesUpdated,
        processingTime: syncResult.processingTime
      });
    } else {
      logError('⚠️ GitHub sync completed with errors', {
        companiesUpdated: syncResult.companiesUpdated,
        errors: syncResult.errors.length
      });
    }

    return NextResponse.json(response, { status: httpStatus });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    logError('❌ GitHub sync API error', { error: errorMessage });
    
    return NextResponse.json({
      success: false,
      message: 'GitHub sync failed',
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    logInfo('📊 GitHub sync status check');

    // Get current sync status
    const status = await dataSyncService.getSyncStatus();
    const consistency = await dataSyncService.verifyDataConsistency();
    const lastSync = await getLastSyncTime();

    return NextResponse.json({
      success: true,
      message: 'GitHub sync status retrieved',
      data: {
        status,
        consistency,
        lastSyncTime: lastSync ? new Date(lastSync).toISOString() : null,
        needsSync: status.githubDataPercentage < 100 || !consistency.githubConsistent
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    logError('❌ GitHub status API error', { error: errorMessage });
    
    return NextResponse.json({
      success: false,
      message: 'Failed to get GitHub sync status',
      error: errorMessage
    }, { status: 500 });
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

async function getLastSyncTime(): Promise<number | null> {
  try {
    // In a production app, you'd store this in Redis or database
    // For now, we'll check the updated_at timestamp of companies with github_repos
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('companies')
      .select('updated_at')
      .not('github_repos', 'eq', JSON.stringify([]))
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    return data ? new Date(data.updated_at).getTime() : null;
  } catch {
    return null;
  }
}

async function recordSyncTime(): Promise<void> {
  try {
    // In production, store this in a dedicated sync_logs table or Redis
    // For now, the updated_at timestamps on companies serve as our record
    logInfo('Sync time recorded via company updated_at timestamps');
  } catch (error) {
    logError('Failed to record sync time', { error });
  }
}