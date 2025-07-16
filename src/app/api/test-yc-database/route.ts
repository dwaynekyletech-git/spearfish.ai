import { NextRequest, NextResponse } from 'next/server';
import { ycDatabase, createYCDatabaseService } from '@/lib/yc-database';
import { getTargetAICompanies } from '@/lib/yc-api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const test = searchParams.get('test') || 'health';

    switch (test) {
      case 'health':
        // Test database connection and health
        const health = await ycDatabase.getHealthMetrics();
        return NextResponse.json({
          success: true,
          test: 'health',
          data: health
        });

      case 'sync-stats':
        // Test sync statistics function
        const stats = await ycDatabase.getSyncStatistics();
        return NextResponse.json({
          success: true,
          test: 'sync-stats',
          data: stats
        });

      case 'upsert-sample':
        // Test upserting a sample company
        const sampleCompany = {
          id: 99999,
          name: "Test AI Startup",
          slug: "test-ai-startup",
          website: "https://testai.example.com",
          one_liner: "AI-powered testing platform",
          long_description: "A comprehensive AI testing platform that uses machine learning to automate software testing.",
          batch: "Winter 2023",
          status: "Active" as const,
          industry: "B2B",
          subindustry: "Developer Tools",
          tags: ["AI", "Testing", "Developer Tools"],
          regions: ["San Francisco Bay Area"],
          team_size: 8,
          launched_at: Date.now(),
          small_logo_thumb_url: null,
          isHiring: true
        };

        const upsertedId = await ycDatabase.upsertCompany(sampleCompany);
        
        // Verify the upsert worked
        const retrievedCompany = await ycDatabase.getCompanyById(upsertedId);
        
        return NextResponse.json({
          success: true,
          test: 'upsert-sample',
          data: {
            upsertedId,
            retrievedCompany: {
              id: retrievedCompany?.id,
              name: retrievedCompany?.name,
              yc_api_id: retrievedCompany?.yc_api_id,
              batch: retrievedCompany?.batch,
              industry: retrievedCompany?.industry,
              sync_status: retrievedCompany?.sync_status
            }
          }
        });

      case 'search-test':
        // Test search functionality
        const searchResults = await ycDatabase.searchCompanies({
          searchTerm: 'AI',
          batches: ['Winter 2023'],
          aiOnly: false,
          limit: 5
        });

        return NextResponse.json({
          success: true,
          test: 'search-test',
          data: {
            resultCount: searchResults.length,
            results: searchResults.map(company => ({
              id: company.id,
              name: company.name,
              batch: company.batch,
              industry: company.industry,
              one_liner: company.one_liner,
              is_ai_related: company.is_ai_related,
              similarity_score: company.similarity_score
            }))
          }
        });

      case 'batch-companies':
        // Test getting companies by batch
        const batchCompanies = await ycDatabase.getCompaniesByBatch(
          ['Winter 2023'],
          true, // AI only
          10,   // limit
          0     // offset
        );

        return NextResponse.json({
          success: true,
          test: 'batch-companies',
          data: {
            totalFound: batchCompanies.length,
            companies: batchCompanies.map(company => ({
              id: company.id,
              name: company.name,
              batch: company.batch,
              industry: company.industry,
              is_ai_related: company.is_ai_related,
              ai_confidence_score: company.ai_confidence_score,
              spearfish_score: company.spearfish_score
            }))
          }
        });

      case 'ai-classification':
        // Test AI classification update
        // First get a company to test with
        const testCompanies = await ycDatabase.getCompaniesByBatch(['Winter 2023'], false, 1);
        
        if (testCompanies.length === 0) {
          return NextResponse.json({
            success: false,
            test: 'ai-classification',
            error: 'No companies found to test AI classification'
          });
        }

        const testCompany = testCompanies[0];
        const originalAiStatus = testCompany.is_ai_related;
        
        // Update AI classification
        const updateResult = await ycDatabase.updateAIClassification(
          testCompany.id,
          !originalAiStatus, // Flip the status
          0.85 // High confidence score
        );

        // Get the updated company
        const updatedCompany = await ycDatabase.getCompanyById(testCompany.id);
        
        // Restore original status
        await ycDatabase.updateAIClassification(
          testCompany.id,
          originalAiStatus,
          testCompany.ai_confidence_score ?? undefined
        );

        return NextResponse.json({
          success: true,
          test: 'ai-classification',
          data: {
            updateSuccessful: updateResult,
            originalStatus: originalAiStatus,
            updatedStatus: updatedCompany?.is_ai_related,
            companyName: testCompany.name
          }
        });

      case 'sync-log':
        // Test sync logging
        const logId = await ycDatabase.createSyncLog(
          'manual',
          'Winter 2023',
          { test: true, source: 'api-test' }
        );

        // Update the log
        await ycDatabase.updateSyncLog(logId, {
          companiesProcessed: 10,
          companiesUpdated: 8,
          companiesCreated: 2,
          companiesFailed: 0,
          aiClassifications: 6,
          status: 'completed'
        });

        // Get recent logs
        const recentLogs = await ycDatabase.getRecentSyncLogs(3);

        return NextResponse.json({
          success: true,
          test: 'sync-log',
          data: {
            createdLogId: logId,
            recentLogs: recentLogs.map(log => ({
              id: log.id,
              sync_type: log.sync_type,
              batch_name: log.batch_name,
              companies_processed: log.companies_processed,
              status: log.status,
              start_time: log.start_time
            }))
          }
        });

      case 'analytics':
        // Test analytics functions
        const [batchStats, topIndustries] = await Promise.all([
          ycDatabase.getCompanyStatsByBatch(),
          ycDatabase.getTopAIIndustries(5)
        ]);

        return NextResponse.json({
          success: true,
          test: 'analytics',
          data: {
            batchStats: batchStats.slice(0, 3), // Top 3 batches
            topAIIndustries: topIndustries
          }
        });

      case 'full-integration':
        // Test full integration: fetch from API and store in database
        console.log('Starting full integration test...');
        
        // Get sample AI companies from API
        const apiCompanies = await getTargetAICompanies();
        const sampleApiCompanies = apiCompanies.slice(0, 5); // Just 5 for testing

        console.log(`Fetched ${sampleApiCompanies.length} companies from API`);

        // Create sync log
        const integrationLogId = await ycDatabase.createSyncLog(
          'manual',
          'integration-test',
          { test: true, apiCompanies: sampleApiCompanies.length }
        );

        // Upsert companies to database
        const upsertResults = await ycDatabase.upsertCompanies(sampleApiCompanies);

        // Update sync log
        await ycDatabase.updateSyncLog(integrationLogId, {
          companiesProcessed: sampleApiCompanies.length,
          companiesUpdated: upsertResults.successful.length,
          companiesFailed: upsertResults.failed.length,
          status: upsertResults.failed.length === 0 ? 'completed' : 'completed'
        });

        console.log(`Integration test complete: ${upsertResults.successful.length} successful, ${upsertResults.failed.length} failed`);

        return NextResponse.json({
          success: true,
          test: 'full-integration',
          data: {
            syncLogId: integrationLogId,
            apiCompaniesCount: sampleApiCompanies.length,
            successfulUpserts: upsertResults.successful.length,
            failedUpserts: upsertResults.failed.length,
            failedCompanies: upsertResults.failed.map(f => ({
              name: f.company.name,
              error: f.error
            })),
            sampleUpsertedIds: upsertResults.successful.slice(0, 3)
          }
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid test parameter',
          available_tests: [
            'health',
            'sync-stats', 
            'upsert-sample',
            'search-test',
            'batch-companies',
            'ai-classification',
            'sync-log',
            'analytics',
            'full-integration'
          ]
        }, { status: 400 });
    }

  } catch (error) {
    console.error('YC Database test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
    }, { status: 500 });
  }
}