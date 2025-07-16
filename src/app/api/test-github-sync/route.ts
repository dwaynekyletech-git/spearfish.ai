/**
 * API Route: Test GitHub Sync Service
 * 
 * Test endpoint to verify GitHub synchronization job functionality
 */

import { NextRequest, NextResponse } from 'next/server';
import { githubSyncService } from '@/lib/github-sync-service';
import { githubService } from '@/lib/github-service';

export async function GET(request: NextRequest) {
  try {
    console.log('Testing GitHub sync service...');

    // Test 1: Check rate limit
    const rateLimit = await githubService.getRateLimit();
    console.log('Rate limit:', rateLimit.remaining, 'remaining');

    if (rateLimit.remaining < 50) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient GitHub API rate limit for sync testing',
        rateLimit: rateLimit,
        timestamp: new Date().toISOString(),
      }, { status: 429 });
    }

    // Test 2: Get sync service status
    const initialStatus = githubSyncService.getSyncStatus();
    console.log('Initial sync status:', initialStatus);

    // Test 3: Get sync statistics
    const stats = await githubSyncService.getSyncStatistics();
    console.log('Sync statistics:', stats);

    // Test 4: Execute a small test sync (single repository if available)
    const { createServiceClient } = await import('@/lib/supabase-server');
    const supabase = createServiceClient();
    
    // Find a test repository to sync
    const { data: testRepo } = await supabase
      .from('github_repositories')
      .select('id, full_name')
      .eq('archived', false)
      .eq('disabled', false)
      .limit(1)
      .single();

    let syncResult = null;
    if (testRepo) {
      console.log(`Testing sync with repository: ${testRepo.full_name}`);
      syncResult = await githubSyncService.syncSingleRepository(testRepo.id);
      console.log('✅ Single repository sync result:', syncResult.success ? 'SUCCESS' : 'FAILED');
    } else {
      console.log('⚠️ No test repository found, skipping sync test');
    }

    // Test 5: Get recent sync logs
    const recentLogs = await githubSyncService.getRecentSyncLogs(5);
    console.log('Recent sync logs:', recentLogs.length, 'entries');

    // Test 6: Check final status
    const finalStatus = githubSyncService.getSyncStatus();
    const finalRateLimit = await githubService.getRateLimit();

    return NextResponse.json({
      success: true,
      message: 'GitHub sync service testing completed',
      data: {
        rateLimit: {
          initial: rateLimit.remaining,
          final: finalRateLimit.remaining,
          used: rateLimit.remaining - finalRateLimit.remaining,
        },
        syncStatus: {
          initial: initialStatus,
          final: finalStatus,
          wasRunning: initialStatus.isRunning,
          isRunning: finalStatus.isRunning,
        },
        statistics: {
          totalSyncs: stats.totalSyncs,
          successfulSyncs: stats.successfulSyncs,
          failedSyncs: stats.failedSyncs,
          averageDuration: Math.round(stats.averageDuration),
          repositoriesTracked: stats.repositoriesTracked,
          lastSyncAt: stats.lastSyncAt,
        },
        testSync: testRepo ? {
          repository: testRepo.full_name,
          success: syncResult?.success || false,
          processed: syncResult?.processed || 0,
          failed: syncResult?.failed || 0,
          syncLogId: syncResult?.syncLogId,
          errors: syncResult?.errors || [],
        } : 'No test repository available',
        recentLogs: {
          count: recentLogs.length,
          lastLogStatus: recentLogs[0]?.status || 'none',
          lastLogAt: recentLogs[0]?.started_at || 'none',
        },
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('GitHub sync test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    }, { 
      status: 500 
    });
  }
}