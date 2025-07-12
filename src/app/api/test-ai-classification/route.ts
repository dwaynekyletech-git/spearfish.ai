import { NextRequest, NextResponse } from 'next/server';
import { 
  aiClassificationService, 
  classifyCompanyAI,
  classifyCompaniesBatchAI 
} from '@/lib/ai-classification-service';
import { getTargetAICompanies } from '@/lib/yc-api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const test = searchParams.get('test') || 'connection';

    switch (test) {
      case 'connection':
        // Test AI SDK connection
        const isConnected = await aiClassificationService.testConnection();
        const modelInfo = aiClassificationService.getModelInfo();
        
        return NextResponse.json({
          success: true,
          test: 'connection',
          data: {
            connected: isConnected,
            ...modelInfo
          }
        });

      case 'single-company':
        // Test classifying a single company
        const sampleCompany = {
          id: 1,
          name: "Anthropic",
          slug: "anthropic",
          website: "https://anthropic.com",
          one_liner: "AI safety company building safe, beneficial, and understandable AI systems",
          long_description: "Anthropic is an AI safety company that builds large language models and AI systems with a focus on safety, interpretability, and robustness. We conduct research to understand and address potential risks from AI systems.",
          batch: "Winter 2021",
          status: "Active" as const,
          industry: "Artificial Intelligence",
          subindustry: "AI Safety",
          tags: ["AI", "Machine Learning", "Safety"],
          regions: ["San Francisco"],
          team_size: 150,
          launched_at: Date.now(),
          small_logo_thumb_url: null,
          isHiring: true
        };

        const result = await classifyCompanyAI(sampleCompany);
        
        return NextResponse.json({
          success: true,
          test: 'single-company',
          data: {
            company: {
              name: sampleCompany.name,
              one_liner: sampleCompany.one_liner,
              industry: sampleCompany.industry
            },
            classification: result
          }
        });

      case 'batch-sample':
        // Test batch classification with sample companies
        const testCompanies = [
          {
            id: 1,
            name: "OpenAI",
            slug: "openai",
            website: "https://openai.com",
            one_liner: "AI research and deployment company",
            long_description: "OpenAI is an artificial intelligence research laboratory consisting of the for-profit corporation OpenAI LP and its parent company, the non-profit OpenAI Inc. The company conducts research in the field of artificial intelligence with the stated aim of promoting and developing friendly AI in such a way as to benefit humanity as a whole.",
            batch: "Winter 2016",
            status: "Active" as const,
            industry: "Artificial Intelligence",
            tags: ["AI", "Research", "GPT"],
            regions: ["San Francisco"],
            team_size: 500,
            launched_at: Date.now(),
            isHiring: true
          },
          {
            id: 2,
            name: "Stripe",
            slug: "stripe",
            website: "https://stripe.com",
            one_liner: "Payment processing for internet businesses",
            long_description: "Stripe is a technology company that builds economic infrastructure for the internet. Businesses of every size—from new startups to public companies—use our software to accept payments and manage their businesses online.",
            batch: "Summer 2009",
            status: "Active" as const,
            industry: "Fintech",
            tags: ["Payments", "API", "E-commerce"],
            regions: ["San Francisco"],
            team_size: 4000,
            launched_at: Date.now(),
            isHiring: true
          },
          {
            id: 3,
            name: "Hugging Face",
            slug: "hugging-face",
            website: "https://huggingface.co",
            one_liner: "The AI community building the future",
            long_description: "Hugging Face is a company that develops tools for building applications using machine learning. We're building a community where everyone can explore, experiment, and build with AI.",
            batch: "Winter 2019",
            status: "Active" as const,
            industry: "Machine Learning",
            tags: ["ML", "NLP", "Transformers", "Open Source"],
            regions: ["New York"],
            team_size: 200,
            launched_at: Date.now(),
            isHiring: true
          }
        ];

        const batchResults = await classifyCompaniesBatchAI(testCompanies);
        const stats = aiClassificationService.calculateClassificationStats(batchResults);
        
        return NextResponse.json({
          success: true,
          test: 'batch-sample',
          data: {
            totalCompanies: testCompanies.length,
            results: batchResults.map(r => ({
              company: r.companyName,
              isAIRelated: r.result.isAIRelated,
              confidence: r.result.confidence,
              reasoning: r.result.reasoning,
              aiDomains: r.result.aiDomains,
              processingTime: r.result.processingTime,
              error: r.error
            })),
            statistics: stats
          }
        });

      case 'real-companies':
        // Test with real YC companies from our API
        console.log('Fetching real YC companies for classification test...');
        
        const realCompanies = await getTargetAICompanies();
        const sampleRealCompanies = realCompanies.slice(0, 3); // Just 3 for testing
        
        console.log(`Testing AI classification on ${sampleRealCompanies.length} real companies`);
        
        const realResults = await classifyCompaniesBatchAI(sampleRealCompanies);
        const realStats = aiClassificationService.calculateClassificationStats(realResults);
        
        return NextResponse.json({
          success: true,
          test: 'real-companies',
          data: {
            totalCompanies: sampleRealCompanies.length,
            results: realResults.map(r => ({
              company: r.companyName,
              isAIRelated: r.result.isAIRelated,
              confidence: r.result.confidence,
              reasoning: r.result.reasoning.substring(0, 200) + '...', // Truncate for readability
              aiDomains: r.result.aiDomains,
              keywords: r.result.keywords,
              processingTime: r.result.processingTime,
              error: r.error
            })),
            statistics: realStats
          }
        });

      case 'performance':
        // Test classification performance
        const perfStart = Date.now();
        
        const quickCompany = {
          id: 999,
          name: "Test AI Company",
          slug: "test-ai",
          website: "https://test.ai",
          one_liner: "Machine learning platform for developers",
          long_description: "We provide machine learning APIs and tools for developers to integrate AI into their applications.",
          batch: "Winter 2023",
          status: "Active" as const,
          industry: "B2B",
          tags: ["AI", "API", "Developer Tools"],
          regions: ["San Francisco"],
          team_size: 25,
          launched_at: Date.now(),
          isHiring: true
        };

        const perfResult = await classifyCompanyAI(quickCompany);
        const totalTime = Date.now() - perfStart;
        
        return NextResponse.json({
          success: true,
          test: 'performance',
          data: {
            company: quickCompany.name,
            classification: perfResult,
            totalTime,
            sdkOverhead: totalTime - perfResult.processingTime
          }
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid test parameter',
          available_tests: [
            'connection',
            'single-company',
            'batch-sample',
            'real-companies',
            'performance'
          ]
        }, { status: 400 });
    }

  } catch (error) {
    console.error('AI Classification test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
    }, { status: 500 });
  }
}