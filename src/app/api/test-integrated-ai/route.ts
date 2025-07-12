import { NextRequest, NextResponse } from 'next/server';
import { integratedAIService, processYCCompaniesWithAI } from '@/lib/integrated-ai-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const test = searchParams.get('test') || 'summary';
    const limit = parseInt(searchParams.get('limit') || '5');

    switch (test) {
      case 'summary':
        // Get classification summary and statistics
        const summary = await integratedAIService.getClassificationSummary();
        
        return NextResponse.json({
          success: true,
          test: 'summary',
          data: summary
        });

      case 'process-sample':
        // Test processing a small batch of YC companies
        console.log(`Processing ${limit} YC companies with AI classification...`);
        
        const result = await processYCCompaniesWithAI({
          limit,
          forceReclassify: false,
          strictMode: true,
          includeExistingData: true
        });

        return NextResponse.json({
          success: true,
          test: 'process-sample',
          data: {
            syncLogId: result.syncLogId,
            summary: {
              companiesProcessed: result.companiesProcessed,
              companiesClassified: result.companiesClassified,
              companiesStoredInDB: result.companiesStoredInDB,
              aiRelatedFound: result.aiRelatedFound,
              errorCount: result.errors.length,
              processingTimeMs: result.processingTime
            },
            classificationStats: result.classificationStats,
            errors: result.errors.length > 0 ? result.errors.slice(0, 3) : []
          }
        });

      case 'classify-existing':
        // Test classifying existing companies in database
        console.log(`Classifying ${limit} existing companies in database...`);
        
        const existingResult = await integratedAIService.classifyExistingCompanies(limit);

        return NextResponse.json({
          success: true,
          test: 'classify-existing',
          data: {
            syncLogId: existingResult.syncLogId,
            summary: {
              companiesProcessed: existingResult.companiesProcessed,
              companiesClassified: existingResult.companiesClassified,
              companiesStoredInDB: existingResult.companiesStoredInDB,
              aiRelatedFound: existingResult.aiRelatedFound,
              errorCount: existingResult.errors.length,
              processingTimeMs: existingResult.processingTime
            },
            classificationStats: existingResult.classificationStats,
            errors: existingResult.errors.length > 0 ? existingResult.errors.slice(0, 3) : []
          }
        });

      case 'full-workflow':
        // Test the complete workflow with a larger batch
        console.log('Testing full AI classification workflow...');
        
        const fullResult = await processYCCompaniesWithAI({
          limit: Math.min(limit, 10), // Cap at 10 for testing
          forceReclassify: false,
          strictMode: false,
          includeExistingData: true
        });

        // Get updated summary after processing
        const updatedSummary = await integratedAIService.getClassificationSummary();

        return NextResponse.json({
          success: true,
          test: 'full-workflow',
          data: {
            processing: {
              syncLogId: fullResult.syncLogId,
              companiesProcessed: fullResult.companiesProcessed,
              companiesClassified: fullResult.companiesClassified,
              companiesStoredInDB: fullResult.companiesStoredInDB,
              aiRelatedFound: fullResult.aiRelatedFound,
              processingTimeMs: fullResult.processingTime,
              errorCount: fullResult.errors.length
            },
            classificationStats: fullResult.classificationStats,
            projectOverview: updatedSummary.overview,
            errors: fullResult.errors.length > 0 ? fullResult.errors.slice(0, 5) : []
          }
        });

      case 'performance':
        // Test classification performance and timing
        console.log('Running performance test...');
        
        const perfStart = Date.now();
        const perfResult = await processYCCompaniesWithAI({
          limit: 3,
          forceReclassify: true,
          strictMode: true
        });
        const totalTime = Date.now() - perfStart;

        return NextResponse.json({
          success: true,
          test: 'performance',
          data: {
            totalProcessingTime: totalTime,
            apiProcessingTime: perfResult.processingTime,
            overhead: totalTime - perfResult.processingTime,
            averageTimePerCompany: perfResult.companiesProcessed > 0 ? 
              Math.round(perfResult.processingTime / perfResult.companiesProcessed) : 0,
            classificationStats: perfResult.classificationStats,
            companiesProcessed: perfResult.companiesProcessed,
            aiRelatedFound: perfResult.aiRelatedFound
          }
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid test parameter',
          available_tests: [
            'summary - Get classification overview',
            'process-sample - Process YC companies with AI (default 5)',
            'classify-existing - Classify existing DB companies (default 5)', 
            'full-workflow - Complete workflow test (default 5, max 10)',
            'performance - Performance and timing test (3 companies)'
          ]
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Integrated AI test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
    }, { status: 500 });
  }
}