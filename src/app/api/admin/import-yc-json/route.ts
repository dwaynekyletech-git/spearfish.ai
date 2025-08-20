/**
 * API Route: Admin YC JSON Import
 * 
 * Admin endpoint for importing YC company data from JSON files.
 * Supports file upload, URL import, and various import options.
 * 
 * POST /api/admin/import-yc-json
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { createYCJSONImportService, ImportOptions } from '@/lib/yc-json-import-service';
import { createYCDatabaseService } from '@/lib/yc-database';
import { logInfo, logError } from '@/lib/logger';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';

// Request body schema
const ImportRequestSchema = z.object({
  jsonData: z.string().optional(),
  clearExisting: z.boolean().optional().default(false),
  dryRun: z.boolean().optional().default(false),
  skipDuplicates: z.boolean().optional().default(true),
  batchSize: z.number().min(1).max(100).optional().default(10),
  validateUrls: z.boolean().optional().default(true)
});

type ImportRequest = z.infer<typeof ImportRequestSchema>;

/**
 * POST /api/admin/import-yc-json
 * Import YC company data from JSON
 */
export async function POST(request: NextRequest) {
  try {
    // Skip authentication in development for testing
    let userId = 'test-user';
    
    if (process.env.NODE_ENV === 'production') {
      // Verify authentication (for now, just check if user is authenticated)
      // In production, you might want to check for admin role
      const authResult = await auth();
      if (!authResult.userId) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Unauthorized - Authentication required' 
          },
          { status: 401 }
        );
      }
      userId = authResult.userId;
    }

    // Parse request body
    const body = await request.json();
    const validatedRequest = ImportRequestSchema.parse(body);

    logInfo('Admin JSON import initiated', { 
      userId,
      options: {
        clearExisting: validatedRequest.clearExisting,
        dryRun: validatedRequest.dryRun,
        skipDuplicates: validatedRequest.skipDuplicates,
        batchSize: validatedRequest.batchSize
      }
    });

    // Validate that JSON data is provided
    if (!validatedRequest.jsonData) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing jsonData in request body'
        },
        { status: 400 }
      );
    }

    // Configure import options
    const importOptions: ImportOptions = {
      clearExisting: validatedRequest.clearExisting,
      dryRun: validatedRequest.dryRun,
      skipDuplicates: validatedRequest.skipDuplicates,
      batchSize: validatedRequest.batchSize,
      validateUrls: validatedRequest.validateUrls
    };

    // Create import service and run import
    const importService = createYCJSONImportService();
    const result = await importService.importFromJSON(validatedRequest.jsonData, importOptions);

    // Log results
    if (result.success) {
      logInfo('JSON import completed successfully', {
        userId,
        companiesImported: result.companiesImported,
        foundersImported: result.foundersImported,
        processingTimeMs: result.processingTimeMs
      });
    } else {
      logError('JSON import completed with errors', {
        userId,
        errors: result.errors,
        companiesProcessed: result.companiesProcessed,
        companiesImported: result.companiesImported
      });
    }

    // Return results
    return NextResponse.json({
      success: result.success,
      data: {
        companiesProcessed: result.companiesProcessed,
        companiesImported: result.companiesImported,
        foundersImported: result.foundersImported,
        jobsImported: result.jobsImported,
        processingTimeMs: result.processingTimeMs,
        errors: result.errors,
        warnings: result.warnings,
        skipped: result.skipped
      },
      message: result.success 
        ? `Successfully imported ${result.companiesImported} companies and ${result.foundersImported} founders`
        : `Import completed with ${result.errors.length} errors`
    });

  } catch (error) {
    logError('JSON import API error', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request format',
          details: error.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/import-yc-json
 * Get import status and database statistics
 */
export async function GET(request: NextRequest) {
  try {
    // Skip authentication in development for testing
    let userId = 'test-user';
    
    if (process.env.NODE_ENV === 'production') {
      const authResult = await auth();
      if (!authResult.userId) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Unauthorized - Authentication required' 
          },
          { status: 401 }
        );
      }
      userId = authResult.userId;
    }

    // Get database statistics
    const dbService = createYCDatabaseService();
    const health = await dbService.getHealthMetrics();
    const stats = await dbService.getSyncStatistics();

    return NextResponse.json({
      success: true,
      data: {
        health: {
          isConnected: health.isConnected,
          totalCompanies: health.totalCompanies,
          lastSyncDate: health.lastSyncDate
        },
        statistics: {
          totalCompanies: stats.total_companies,
          syncedCompanies: stats.synced_companies,
          pendingCompanies: stats.pending_companies,
          errorCompanies: stats.error_companies,
          aiCompanies: stats.ai_companies,
          lastSyncDate: stats.last_sync_date,
          avgAiConfidence: stats.avg_ai_confidence
        }
      }
    });

  } catch (error) {
    logError('Import status API error', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/import-yc-json
 * Clear existing company data
 */
export async function DELETE(request: NextRequest) {
  try {
    // Skip authentication in development for testing
    let userId = 'test-user';
    
    if (process.env.NODE_ENV === 'production') {
      const authResult = await auth();
      if (!authResult.userId) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Unauthorized - Authentication required' 
          },
          { status: 401 }
        );
      }
      userId = authResult.userId;
    }

    // Get query parameters
    const url = new URL(request.url);
    const confirmParam = url.searchParams.get('confirm');
    
    if (confirmParam !== 'yes') {
      return NextResponse.json(
        {
          success: false,
          error: 'Confirmation required. Add ?confirm=yes to the URL to proceed with data deletion.'
        },
        { status: 400 }
      );
    }

    logInfo('Admin data clearing initiated', { userId });

    // Clear all company data
    const dbService = createYCDatabaseService();
    const result = await dbService.clearAllCompanies();

    logInfo('Data clearing completed', {
      userId,
      companiesDeleted: result.companiesDeleted,
      foundersDeleted: result.foundersDeleted,
      fundingDeleted: result.fundingDeleted
    });

    return NextResponse.json({
      success: true,
      data: {
        companiesDeleted: result.companiesDeleted,
        foundersDeleted: result.foundersDeleted,
        fundingDeleted: result.fundingDeleted
      },
      message: `Successfully cleared ${result.companiesDeleted} companies and ${result.foundersDeleted} founders`
    });

  } catch (error) {
    logError('Data clearing API error', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}