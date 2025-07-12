import { NextRequest, NextResponse } from 'next/server';
import { 
  companyDataService, 
  getValidatedTargetCompanies,
  CompanyDataValidator 
} from '@/lib/company-data-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const test = searchParams.get('test') || 'statistics';

    switch (test) {
      case 'statistics':
        // Get comprehensive statistics for target batches
        const stats = await companyDataService.getCompanyStatistics(['W22', 'S22', 'W23']);
        return NextResponse.json({
          success: true,
          test: 'statistics',
          data: stats
        });

      case 'fetch-with-validation':
        // Test enhanced fetching with validation
        const fetchResult = await companyDataService.fetchTargetBatchCompanies({
          batches: ['W23'], // Just W23 for faster testing
          validateData: true,
          includeAIClassification: true,
          maxRetries: 2
        });

        return NextResponse.json({
          success: true,
          test: 'fetch-with-validation',
          data: {
            success: fetchResult.success,
            totalFetched: fetchResult.totalFetched,
            validCount: fetchResult.validCompanies.length,
            invalidCount: fetchResult.invalidCompanies.length,
            aiRelatedCount: fetchResult.metadata.aiRelatedCount,
            processingTime: fetchResult.metadata.processingTime,
            batchBreakdown: fetchResult.metadata.batchBreakdown,
            errors: fetchResult.errors,
            sampleValid: fetchResult.validCompanies.slice(0, 3).map(c => ({
              name: c.name,
              batch: c.batch,
              normalizedBatch: c.normalizedBatch,
              industry: c.industry,
              isAIRelated: c.isAIRelated,
              aiConfidence: c.aiConfidence,
              hasValidWebsite: c.hasValidWebsite,
              tagCount: c.tagCount
            })),
            sampleInvalid: fetchResult.invalidCompanies.slice(0, 2).map(i => ({
              name: i.company.name || 'Unknown',
              errors: i.errors
            }))
          }
        });

      case 'ai-companies':
        // Test AI company fetching
        const aiCompanies = await companyDataService.fetchAICompaniesFromTargetBatches();
        
        return NextResponse.json({
          success: true,
          test: 'ai-companies',
          data: {
            totalAI: aiCompanies.length,
            byBatch: aiCompanies.reduce((acc, company) => {
              const batch = company.normalizedBatch;
              acc[batch] = (acc[batch] || 0) + 1;
              return acc;
            }, {} as Record<string, number>),
            highConfidenceAI: aiCompanies.filter(c => (c.aiConfidence || 0) > 0.7).length,
            sampleHighConfidence: aiCompanies
              .filter(c => (c.aiConfidence || 0) > 0.7)
              .slice(0, 5)
              .map(c => ({
                name: c.name,
                batch: c.normalizedBatch,
                industry: c.industry,
                aiConfidence: c.aiConfidence,
                one_liner: c.one_liner,
                aiTags: c.tags.filter(tag => 
                  ['AI', 'ML', 'Machine Learning', 'Artificial Intelligence'].some(aiTag =>
                    tag.toLowerCase().includes(aiTag.toLowerCase())
                  )
                )
              }))
          }
        });

      case 'validation-test':
        // Test data validation with sample data
        const sampleCompanies = [
          {
            id: 1,
            name: "Test AI Company",
            batch: "Winter 2023",
            website: "https://testai.com",
            one_liner: "AI-powered analytics platform",
            industry: "B2B",
            tags: ["AI", "Analytics"],
            team_size: 15,
            status: "Active"
          },
          {
            id: "invalid", // Invalid ID type
            name: "",      // Empty name
            batch: "Invalid Batch",
            website: "not-a-url",
            team_size: -5  // Invalid team size
          },
          {
            // Missing required fields
            name: "Incomplete Company"
          }
        ];

        const validationResults = sampleCompanies.map(company => ({
          input: company,
          validation: CompanyDataValidator.validate(company)
        }));

        return NextResponse.json({
          success: true,
          test: 'validation-test',
          data: {
            totalTested: validationResults.length,
            validCount: validationResults.filter(r => r.validation.isValid).length,
            results: validationResults.map(r => ({
              isValid: r.validation.isValid,
              errors: r.validation.errors,
              warnings: r.validation.warnings,
              companyName: r.input.name || 'Unknown',
              hasEnhancedData: !!r.validation.company
            }))
          }
        });

      case 'performance':
        // Test performance with timing
        const performanceStart = Date.now();
        
        const quickStats = await companyDataService.getCompanyStatistics(['W23']);
        const performanceTime = Date.now() - performanceStart;
        
        return NextResponse.json({
          success: true,
          test: 'performance',
          data: {
            totalCompanies: quickStats.total,
            aiCompanies: quickStats.aiRelated,
            processingTime: performanceTime,
            cacheInfo: companyDataService.getCacheInfo()
          }
        });

      case 'quick-validated':
        // Test the convenience function
        const validatedCompanies = await getValidatedTargetCompanies();
        
        return NextResponse.json({
          success: true,
          test: 'quick-validated',
          data: {
            totalValidated: validatedCompanies.length,
            aiCount: validatedCompanies.filter(c => c.isAIRelated).length,
            batchBreakdown: validatedCompanies.reduce((acc, company) => {
              const batch = company.normalizedBatch;
              acc[batch] = (acc[batch] || 0) + 1;
              return acc;
            }, {} as Record<string, number>),
            sampleCompanies: validatedCompanies.slice(0, 3).map(c => ({
              name: c.name,
              batch: c.normalizedBatch,
              industry: c.industry,
              aiRelated: c.isAIRelated,
              confidence: c.aiConfidence
            }))
          }
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid test parameter',
          available_tests: [
            'statistics', 
            'fetch-with-validation', 
            'ai-companies', 
            'validation-test', 
            'performance', 
            'quick-validated'
          ]
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Company data test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
    }, { status: 500 });
  }
}