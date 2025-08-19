import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { spearfishScoringService } from '@/lib/spearfish-scoring-service';
import { createSpearfishDatabaseService } from '@/lib/spearfish-database-service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const companyId = params.id;
    
    // Parse request body for options
    const body = await request.json().catch(() => ({}));
    const { forceRecalculate = false } = body;

    // Use service role for proper database access
    const databaseService = createSpearfishDatabaseService(true, true);
    
    // Get company data from database
    const companies = await databaseService.getCompaniesWithScores({
      limit: 1000, // Get more companies to find the specific one
      offset: 0
    });
    
    const company = companies.find((c: any) => c.id === companyId);
    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    // Check if company already has a recent score
    if (company.spearfish_score && !forceRecalculate) {
      return NextResponse.json({
        success: true,
        data: {
          companyId,
          score: company.spearfish_score,
          message: 'Score already exists. Use forceRecalculate=true to recalculate.',
          lastCalculated: (company as any).updated_at || new Date().toISOString()
        }
      });
    }

    // Calculate new spearfish score
    const scoringResult = spearfishScoringService.calculateScore(company);
    
    // Update company score in database
    const updateSuccess = await databaseService.updateCompanyScore(
      companyId,
      scoringResult
    );

    if (!updateSuccess) {
      throw new Error('Failed to update company score in database');
    }

    // Extract raw data metrics for transparency
    const rawDataSummary = {
      batch: company.batch,
      launchedAt: company.launched_at ? new Date(company.launched_at * 1000).toISOString() : null,
      isHiring: company.is_hiring,
      githubRepos: {
        count: (company.github_repos || []).length,
        totalStars: (company.github_repos || []).reduce((sum: number, repo: any) => sum + (repo.stars_count || 0), 0),
        totalForks: (company.github_repos || []).reduce((sum: number, repo: any) => sum + (repo.forks_count || 0), 0),
      },
      huggingfaceModels: {
        count: (company.huggingface_models || []).length,
        totalDownloads: (company.huggingface_models || []).reduce((sum: number, model: any) => sum + (model.downloads || 0), 0),
        totalLikes: (company.huggingface_models || []).reduce((sum: number, model: any) => sum + (model.likes || 0), 0),
      },
      oneLiner: company.one_liner,
      tags: company.tags
    };

    return NextResponse.json({
      success: true,
      data: {
        companyId,
        score: scoringResult.totalScore,
        normalizedScore: scoringResult.normalizedScore,
        breakdown: scoringResult.breakdown,
        confidence: scoringResult.confidence,
        algorithmVersion: scoringResult.algorithmVersion,
        calculatedAt: scoringResult.calculatedAt,
        metadata: scoringResult.metadata,
        rawDataSummary
      },
      metadata: {
        timestamp: new Date().toISOString(),
        forceRecalculate
      }
    });

  } catch (error) {
    console.error('Error calculating spearfish score:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to calculate spearfish score',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}