/**
 * API Route: Migrate Company Industries
 * 
 * Admin endpoint to update existing companies with industry information
 * extracted from their tags and descriptions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '../../../../lib/supabase-server';
import { extractIndustry, extractMultipleIndustries } from '../../../../lib/industry-extraction-service';

interface MigrationStats {
  totalCompanies: number;
  processedCompanies: number;
  updatedCompanies: number;
  skippedCompanies: number;
  errors: string[];
  industryDistribution: Record<string, number>;
  processingTimeMs: number;
}

/**
 * POST /api/admin/migrate-industries
 * Migrate industry data for companies
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const startTime = Date.now();
    const body = await request.json();
    const {
      dryRun = true,
      limit = 10,
      onlyMissing = true,
      batchFilter = null
    } = body;

    const stats: MigrationStats = {
      totalCompanies: 0,
      processedCompanies: 0,
      updatedCompanies: 0,
      skippedCompanies: 0,
      errors: [],
      industryDistribution: {},
      processingTimeMs: 0
    };

    const supabase = createServiceClient();

    // Build query
    let query = supabase
      .from('companies')
      .select('id, name, tags, one_liner, long_description, industry, industries, batch');

    if (onlyMissing) {
      query = query.or('industry.is.null,industry.eq.');
    }

    if (batchFilter && Array.isArray(batchFilter)) {
      query = query.in('batch', batchFilter);
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data: companies, error: fetchError } = await query;

    if (fetchError) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch companies: ${fetchError.message}` },
        { status: 500 }
      );
    }

    if (!companies || companies.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No companies found to process',
        stats
      });
    }

    stats.totalCompanies = companies.length;

    // Process each company
    for (const company of companies) {
      stats.processedCompanies++;

      try {
        // Parse tags
        let tags: string[] = [];
        if (company.tags) {
          if (Array.isArray(company.tags)) {
            tags = company.tags;
          } else if (typeof company.tags === 'string') {
            try {
              tags = JSON.parse(company.tags);
            } catch (e) {
              tags = [];
            }
          }
        }

        // Skip if no data to work with
        if (tags.length === 0 && !company.one_liner && !company.long_description) {
          stats.skippedCompanies++;
          continue;
        }

        // Extract industry information
        const industryResult = extractIndustry(
          tags,
          company.one_liner || company.long_description,
          company.name
        );

        const allIndustries = extractMultipleIndustries(
          tags,
          company.one_liner || company.long_description,
          company.name
        );

        // Check if update is needed
        const needsUpdate = !company.industry || 
          company.industry !== industryResult.primaryIndustry ||
          !company.industries ||
          JSON.stringify(company.industries) !== JSON.stringify(allIndustries);

        if (!needsUpdate) {
          stats.skippedCompanies++;
          continue;
        }

        // Update industry distribution stats
        stats.industryDistribution[industryResult.primaryIndustry] = 
          (stats.industryDistribution[industryResult.primaryIndustry] || 0) + 1;

        // Update database if not dry run
        if (!dryRun) {
          const { error: updateError } = await supabase
            .from('companies')
            .update({
              industry: industryResult.primaryIndustry,
              industries: allIndustries,
              updated_at: new Date().toISOString()
            })
            .eq('id', company.id);

          if (updateError) {
            stats.errors.push(`Failed to update ${company.name}: ${updateError.message}`);
            continue;
          }
        }

        stats.updatedCompanies++;

      } catch (error) {
        const errorMsg = `Error processing ${company.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        stats.errors.push(errorMsg);
      }
    }

    stats.processingTimeMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: dryRun ? 'Dry run completed successfully' : 'Migration completed successfully',
      stats,
      dryRun
    });

  } catch (error) {
    console.error('Migration API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/migrate-industries
 * Get migration status and preview
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createServiceClient();

    // Get counts
    const { count: totalCompanies } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true });

    const { count: companiesWithIndustry } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .not('industry', 'is', null)
      .neq('industry', '');

    const { count: companiesWithoutIndustry } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .or('industry.is.null,industry.eq.');

    // Get sample companies that need migration
    const { data: sampleCompanies } = await supabase
      .from('companies')
      .select('id, name, tags, one_liner, industry, batch')
      .or('industry.is.null,industry.eq.')
      .limit(5);

    return NextResponse.json({
      success: true,
      summary: {
        totalCompanies: totalCompanies || 0,
        companiesWithIndustry: companiesWithIndustry || 0,
        companiesWithoutIndustry: companiesWithoutIndustry || 0,
        sampleCompanies: sampleCompanies || []
      }
    });

  } catch (error) {
    console.error('Migration status API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}