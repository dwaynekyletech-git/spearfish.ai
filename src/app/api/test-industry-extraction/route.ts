/**
 * API Route: Test Industry Extraction
 * 
 * Public endpoint to test industry extraction functionality
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractIndustry, extractMultipleIndustries } from '../../../lib/industry-extraction-service';

export async function GET(request: NextRequest) {
  try {
    // Test cases
    const testCases = [
      {
        name: "OpenAI",
        tags: ["AI", "Artificial Intelligence", "LLM", "GPT"],
        description: "AI research company developing large language models"
      },
      {
        name: "Stripe",
        tags: ["Payments", "Fintech", "B2B", "API"],
        description: "Online payment processing platform"
      },
      {
        name: "Anthropic",
        tags: ["AI Safety", "LLM", "Research"],
        description: "AI safety company focused on developing safe AI systems"
      },
      {
        name: "Coinbase",
        tags: ["Cryptocurrency", "Crypto", "Trading", "Blockchain"],
        description: "Cryptocurrency exchange platform"
      },
      {
        name: "Zoom",
        tags: ["SaaS", "Video Conferencing", "Enterprise"],
        description: "Video conferencing platform"
      }
    ];

    const results = testCases.map(testCase => {
      const industryResult = extractIndustry(
        testCase.tags,
        testCase.description,
        testCase.name
      );

      const allIndustries = extractMultipleIndustries(
        testCase.tags,
        testCase.description,
        testCase.name
      );

      return {
        company: testCase.name,
        tags: testCase.tags,
        description: testCase.description,
        extraction: {
          primaryIndustry: industryResult.primaryIndustry,
          allIndustries,
          confidence: Math.round(industryResult.confidence * 100),
          method: industryResult.extractionMethod,
          matchedTags: industryResult.matchedTags
        }
      };
    });

    return NextResponse.json({
      success: true,
      message: "Industry extraction test completed successfully",
      results,
      summary: {
        totalTests: results.length,
        averageConfidence: Math.round(
          results.reduce((sum, r) => sum + r.extraction.confidence, 0) / results.length
        ),
        industriesFound: Array.from(new Set(results.map(r => r.extraction.primaryIndustry)))
      }
    });

  } catch (error) {
    console.error('Industry extraction test error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tags = [], description = '', companyName = 'Test Company' } = body;

    const industryResult = extractIndustry(tags, description, companyName);
    const allIndustries = extractMultipleIndustries(tags, description, companyName);

    return NextResponse.json({
      success: true,
      result: {
        company: companyName,
        tags,
        description,
        extraction: {
          primaryIndustry: industryResult.primaryIndustry,
          allIndustries,
          confidence: Math.round(industryResult.confidence * 100),
          method: industryResult.extractionMethod,
          matchedTags: industryResult.matchedTags,
          subIndustries: industryResult.subIndustries
        }
      }
    });

  } catch (error) {
    console.error('Custom industry extraction error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}