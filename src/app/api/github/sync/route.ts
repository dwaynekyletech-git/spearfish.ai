/**
 * API Route: GitHub Sync
 * 
 * Manual endpoint for syncing GitHub repositories
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { githubStorageService } from '@/lib/github-storage-service';

/**
 * POST /api/github/sync
 * Manually sync a GitHub repository for a company
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { owner, repo, companyId } = body;

    if (!owner || !repo || !companyId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: owner, repo, companyId',
      }, { status: 400 });
    }

    console.log(`Syncing GitHub repository: ${owner}/${repo} for company ${companyId}`);

    // Fetch and store repository data
    const result = await githubStorageService.fetchAndStoreRepository(owner, repo);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
      }, { status: 500 });
    }

    // Associate repository with company
    const association = await githubStorageService.associateRepositoryWithCompany({
      company_id: companyId,
      repository_id: result.data?.repository.id!,
      is_primary: true,
      confidence_score: 1.0,
      discovery_method: 'manual',
    });

    if (!association.success) {
      return NextResponse.json({
        success: false,
        error: association.error,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        repositoryId: result.data?.repository.id,
        repository: `${owner}/${repo}`,
        companyId,
        message: 'Repository synced successfully',
      },
    });

  } catch (error) {
    console.error('Error syncing GitHub repository:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    }, { 
      status: 500 
    });
  }
}