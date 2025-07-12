import { NextRequest, NextResponse } from 'next/server';
import { ycApi, getTargetBatchCompanies, getTargetAICompanies } from '@/lib/yc-api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const test = searchParams.get('test') || 'meta';

    switch (test) {
      case 'meta':
        // Test API metadata
        const meta = await ycApi.getMeta();
        return NextResponse.json({
          success: true,
          test: 'meta',
          data: {
            last_updated: meta.last_updated,
            total_companies: meta.total_companies,
            batches: Object.keys(meta.batches).length,
            sample_batches: Object.keys(meta.batches).slice(-10), // Last 10 batches
            ai_companies: meta.tags['AI'] || 'Not found',
            w22_companies: meta.batches['W22'] || 'Not found',
            s22_companies: meta.batches['S22'] || 'Not found',
            w23_companies: meta.batches['W23'] || 'Not found'
          }
        });

      case 'target-batches':
        // Test fetching companies from target batches
        const targetCompanies = await getTargetBatchCompanies();
        return NextResponse.json({
          success: true,
          test: 'target-batches',
          data: {
            total_companies: targetCompanies.length,
            batches: [...new Set(targetCompanies.map(c => c.batch))],
            sample_companies: targetCompanies.slice(0, 5).map(c => ({
              name: c.name,
              batch: c.batch,
              industry: c.industry,
              one_liner: c.one_liner,
              tags: c.tags.slice(0, 3) // First 3 tags
            }))
          }
        });

      case 'ai-potential':
        // Test AI company detection
        const aiCompanies = await getTargetAICompanies();
        return NextResponse.json({
          success: true,
          test: 'ai-potential',
          data: {
            total_ai_companies: aiCompanies.length,
            by_batch: aiCompanies.reduce((acc, company) => {
              acc[company.batch] = (acc[company.batch] || 0) + 1;
              return acc;
            }, {} as Record<string, number>),
            sample_ai_companies: aiCompanies.slice(0, 10).map(c => ({
              name: c.name,
              batch: c.batch,
              industry: c.industry,
              one_liner: c.one_liner,
              ai_tags: c.tags.filter(tag => 
                tag.toLowerCase().includes('ai') || 
                tag.toLowerCase().includes('machine learning') ||
                tag.toLowerCase().includes('ml')
              )
            }))
          }
        });

      case 'batch-specific':
        // Test specific batch
        const batch = searchParams.get('batch') || 'W23';
        const batchCompanies = await ycApi.getCompaniesByBatch(batch);
        return NextResponse.json({
          success: true,
          test: 'batch-specific',
          batch,
          data: {
            total_companies: batchCompanies.length,
            industries: [...new Set(batchCompanies.map(c => c.industry))].slice(0, 10),
            sample_companies: batchCompanies.slice(0, 5).map(c => ({
              name: c.name,
              industry: c.industry,
              one_liner: c.one_liner,
              team_size: c.team_size,
              status: c.status
            }))
          }
        });

      case 'cache-info':
        // Test cache functionality
        return NextResponse.json({
          success: true,
          test: 'cache-info',
          data: ycApi.getCacheInfo()
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid test parameter',
          available_tests: ['meta', 'target-batches', 'ai-potential', 'batch-specific', 'cache-info']
        }, { status: 400 });
    }

  } catch (error) {
    console.error('YC API test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
    }, { status: 500 });
  }
}