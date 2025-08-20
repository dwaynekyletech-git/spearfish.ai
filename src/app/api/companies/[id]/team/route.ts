/**
 * Company Team API Route
 * 
 * Get team members, job postings, and enrichment data for a specific company.
 * Updated to work with manual JSON import data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createFounderDatabaseService } from '@/lib/founder-database-service';
import { createServiceClient } from '@/lib/supabase-server';
import { logInfo, logWarn, logError } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const companyId = params.id;
    
    if (!companyId) {
      return NextResponse.json({
        success: false,
        error: 'Company ID is required'
      }, { status: 400 });
    }

    logInfo('Fetching enhanced team data', { companyId });
    
    const supabase = createServiceClient();
    
    // Get company information
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select(`
        id, name, batch, yc_url, website_url, 
        data_source, is_ai_related, team_size,
        last_sync_date
      `)
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      logWarn('Company not found', { companyId, error: companyError });
      return NextResponse.json({
        success: false,
        error: 'Company not found'
      }, { status: 404 });
    }

    // Get founders from database
    const { data: founders, error: foundersError } = await supabase
      .from('founders')
      .select(`
        id, name, title, bio, linkedin_url, twitter_url, 
        email, image_url, source_url, data_source, 
        created_at
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: true });

    if (foundersError) {
      logWarn('Error fetching founders', { companyId, error: foundersError });
    }

    // Get job postings from database
    const { data: jobs, error: jobsError } = await supabase
      .from('company_jobs')
      .select(`
        id, title, description, location, remote_ok,
        apply_url, job_type, experience_level, department,
        posted_at, is_active, data_source, created_at
      `)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('posted_at', { ascending: false });

    if (jobsError) {
      logWarn('Error fetching jobs', { companyId, error: jobsError });
    }

    // Determine data freshness
    const dataFreshness = determineDataFreshness(company);

    // Get legacy funding data for backward compatibility
    const founderService = createFounderDatabaseService();
    let legacyTeamData;
    try {
      legacyTeamData = await founderService.getCompanyTeamData(companyId);
    } catch (error) {
      logWarn('Error fetching legacy team data', { companyId, error });
      legacyTeamData = { founders: [], funding: null };
    }

    const responseData = {
      success: true,
      data: {
        company: {
          id: company.id,
          name: company.name,
          batch: company.batch,
          team_size: company.team_size,
          yc_url: company.yc_url,
          website_url: company.website_url,
          data_source: company.data_source,
          last_sync_date: company.last_sync_date,
          is_ai_related: company.is_ai_related
        },
        founders: founders || [],
        jobs: jobs || [],
        funding: legacyTeamData.funding, // Keep for backward compatibility
        data_info: {
          data_freshness: dataFreshness,
          data_source: company.data_source,
          last_sync_date: company.last_sync_date
        },
        stats: {
          founders_count: (founders || []).length,
          jobs_count: (jobs || []).filter(j => j.is_active).length,
          founders_with_linkedin: (founders || []).filter(f => f.linkedin_url).length,
          founders_with_bios: (founders || []).filter(f => f.bio && f.bio.length > 0).length,
          remote_jobs_count: (jobs || []).filter(j => j.remote_ok).length
        }
      },
      // Legacy format for backward compatibility
      founders: founders || [],
      funding: legacyTeamData.funding
    };

    logInfo('Team data fetched successfully', {
      companyId,
      foundersCount: (founders || []).length,
      jobsCount: (jobs || []).length,
      dataSource: company.data_source,
      dataFreshness
    });
    
    return NextResponse.json(responseData);
    
  } catch (error) {
    logError('Error fetching team data', { 
      companyId: params.id, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to fetch team data'
    }, { status: 500 });
  }
}


// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Determine data freshness status
 */
function determineDataFreshness(company: any): string {
  if (!company.last_sync_date) {
    return 'never_synced';
  }

  const syncedAt = new Date(company.last_sync_date);
  const now = new Date();
  const daysDiff = (now.getTime() - syncedAt.getTime()) / (1000 * 60 * 60 * 24);

  if (daysDiff < 1) return 'very_fresh';
  if (daysDiff < 7) return 'fresh';
  if (daysDiff < 30) return 'stale';
  return 'very_stale';
}