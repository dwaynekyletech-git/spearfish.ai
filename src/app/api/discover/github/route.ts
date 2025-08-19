/**
 * GitHub Repository Discovery API Endpoint
 * 
 * Automatically discovers GitHub repositories for companies that don't have any yet
 * 
 * Usage: POST /api/discover/github?limit=5
 */

import { NextRequest, NextResponse } from 'next/server';
import { githubDiscoveryService } from '@/lib/github-discovery-service';
import { dataSyncService } from '@/lib/data-sync-service';
import { createServiceClient } from '@/lib/supabase-server';
import { logInfo, logError } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '5', 10), 20); // Max 20 at a time

    logInfo('🔍 GitHub repository discovery started', { limit });

    // Step 1: Discover repositories
    const discoveryResult = await githubDiscoveryService.discoverRepositoriesForCompanies(limit);

    // Step 2: Sync the newly discovered data to companies table
    if (discoveryResult.totalReposStored > 0) {
      logInfo('🔄 Syncing newly discovered repos to companies table...');
      const syncResult = await dataSyncService.syncGitHubDataToCompanies();
      
      return NextResponse.json({
        success: true,
        message: `🎉 Discovered ${discoveryResult.totalReposFound} repos for ${discoveryResult.companiesProcessed} companies`,
        data: {
          discovery: discoveryResult,
          sync: syncResult,
          summary: {
            companiesProcessed: discoveryResult.companiesProcessed,
            reposFound: discoveryResult.totalReposFound,
            reposStored: discoveryResult.totalReposStored,
            companiesUpdated: syncResult.companiesUpdated,
            rateLimitRemaining: discoveryResult.rateLimitRemaining
          }
        }
      });
    } else {
      return NextResponse.json({
        success: true,
        message: `✅ Discovery complete - no new repositories found for ${discoveryResult.companiesProcessed} companies`,
        data: {
          discovery: discoveryResult,
          summary: {
            companiesProcessed: discoveryResult.companiesProcessed,
            reposFound: 0,
            rateLimitRemaining: discoveryResult.rateLimitRemaining
          }
        }
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    logError('❌ GitHub discovery API error', { error: errorMessage });
    
    return NextResponse.json({
      success: false,
      message: 'GitHub repository discovery failed',
      error: errorMessage
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get status of companies needing discovery
    const supabase = createServiceClient();
    const { data: companiesNeedingDiscovery, error } = await supabase
      .from('companies')
      .select('id, name, website_url')
      .eq('github_repos', JSON.stringify([]))
      .order('name');

    if (error) {
      throw new Error(`Failed to fetch companies: ${error.message}`);
    }

    const status = await dataSyncService.getSyncStatus();

    return NextResponse.json({
      success: true,
      message: 'GitHub discovery status retrieved',
      data: {
        companiesNeedingDiscovery: companiesNeedingDiscovery?.length || 0,
        companyList: companiesNeedingDiscovery?.map(c => ({
          id: c.id,
          name: c.name,
          hasWebsite: !!c.website_url
        })) || [],
        currentStatus: status
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    logError('❌ GitHub discovery status error', { error: errorMessage });
    
    return NextResponse.json({
      success: false,
      message: 'Failed to get discovery status',
      error: errorMessage
    }, { status: 500 });
  }
}