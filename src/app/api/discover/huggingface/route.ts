/**
 * HuggingFace Model Discovery API Endpoint
 * 
 * Automatically discovers HuggingFace models for companies that don't have any yet
 * 
 * Usage: POST /api/discover/huggingface?limit=5
 */

import { NextRequest, NextResponse } from 'next/server';
import { huggingfaceDiscoveryService } from '@/lib/huggingface-discovery-service';
import { dataSyncService } from '@/lib/data-sync-service';
import { createServiceClient } from '@/lib/supabase-server';
import { logInfo, logError } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '5', 10), 20); // Max 20 at a time

    logInfo('🤗 HuggingFace model discovery started', { limit });

    // Step 1: Discover models
    const discoveryResult = await huggingfaceDiscoveryService.discoverModelsForCompanies(limit);

    // Step 2: Sync the newly discovered data to companies table
    if (discoveryResult.totalModelsStored > 0) {
      logInfo('🔄 Syncing newly discovered models to companies table...');
      const syncResult = await dataSyncService.syncHuggingFaceDataToCompanies();
      
      return NextResponse.json({
        success: true,
        message: `🎉 Discovered ${discoveryResult.totalModelsFound} models for ${discoveryResult.companiesProcessed} companies`,
        data: {
          discovery: discoveryResult,
          sync: syncResult,
          summary: {
            companiesProcessed: discoveryResult.companiesProcessed,
            modelsFound: discoveryResult.totalModelsFound,
            modelsStored: discoveryResult.totalModelsStored,
            companiesUpdated: syncResult.companiesUpdated,
            rateLimitRemaining: discoveryResult.rateLimitRemaining
          }
        }
      });
    } else {
      return NextResponse.json({
        success: true,
        message: `✅ Discovery complete - no new models found for ${discoveryResult.companiesProcessed} companies`,
        data: {
          discovery: discoveryResult,
          summary: {
            companiesProcessed: discoveryResult.companiesProcessed,
            modelsFound: 0,
            rateLimitRemaining: discoveryResult.rateLimitRemaining
          }
        }
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    logError('❌ HuggingFace discovery API error', { error: errorMessage });
    
    return NextResponse.json({
      success: false,
      message: 'HuggingFace model discovery failed',
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
      .eq('huggingface_models', JSON.stringify([]))
      .order('name');

    if (error) {
      throw new Error(`Failed to fetch companies: ${error.message}`);
    }

    const status = await dataSyncService.getSyncStatus();

    return NextResponse.json({
      success: true,
      message: 'HuggingFace discovery status retrieved',
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
    
    logError('❌ HuggingFace discovery status error', { error: errorMessage });
    
    return NextResponse.json({
      success: false,
      message: 'Failed to get discovery status',
      error: errorMessage
    }, { status: 500 });
  }
}

// Optional: Add a PUT endpoint for reprocessing specific companies
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyIds, reprocessAll = false } = body;

    if (!companyIds && !reprocessAll) {
      return NextResponse.json({
        success: false,
        message: 'Must provide companyIds array or set reprocessAll=true'
      }, { status: 400 });
    }

    logInfo('🔄 Reprocessing HuggingFace discovery', { 
      companyIds: companyIds?.length || 'all', 
      reprocessAll 
    });

    // If reprocessAll, clear existing HF data first
    if (reprocessAll) {
      const supabase = createServiceClient();
      await supabase
        .from('companies')
        .update({ huggingface_models: [] })
        .neq('id', 'never-match'); // Update all companies
    }

    // Process specific companies or use discovery limit
    const limit = companyIds ? companyIds.length : 10;
    const discoveryResult = await huggingfaceDiscoveryService.discoverModelsForCompanies(limit);

    if (discoveryResult.totalModelsStored > 0) {
      const syncResult = await dataSyncService.syncHuggingFaceDataToCompanies();
      
      return NextResponse.json({
        success: true,
        message: `🔄 Reprocessed ${discoveryResult.companiesProcessed} companies`,
        data: {
          discovery: discoveryResult,
          sync: syncResult
        }
      });
    } else {
      return NextResponse.json({
        success: true,
        message: `✅ Reprocessing complete - no models found`,
        data: { discovery: discoveryResult }
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    logError('❌ HuggingFace reprocessing error', { error: errorMessage });
    
    return NextResponse.json({
      success: false,
      message: 'HuggingFace reprocessing failed',
      error: errorMessage
    }, { status: 500 });
  }
}