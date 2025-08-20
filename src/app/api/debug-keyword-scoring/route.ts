/**
 * Debug Keyword Scoring API Route
 * 
 * Deep dive into keyword scoring to understand confidence calculation
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

// Copy the keyword configuration from ai-company-detector.ts
const AI_KEYWORDS = {
  // Tier 1: Core AI/ML (highest confidence)
  FOUNDATION_MODELS: {
    keywords: [
      'foundation model', 'large language model', 'llm', 'gpt', 'transformer',
      'generative ai', 'chatgpt', 'anthropic', 'openai', 'neural network',
      'deep learning', 'artificial general intelligence', 'agi'
    ],
    weight: 1.0,
    tier: 'TIER_1'
  },
  
  // Tier 2: AI Infrastructure & Tools (high confidence)
  AI_INFRASTRUCTURE: {
    keywords: [
      'machine learning platform', 'ml platform', 'ai infrastructure',
      'model deployment', 'mlops', 'ai development', 'neural architecture',
      'computer vision', 'natural language processing', 'nlp', 'cv',
      'reinforcement learning', 'supervised learning', 'unsupervised learning'
    ],
    weight: 0.8,
    tier: 'TIER_2'
  },
  
  // Tier 3: AI-enabled (medium confidence)
  AI_ENABLED: {
    keywords: [
      'artificial intelligence', 'machine learning', 'ai powered', 'ai-powered',
      'intelligent automation', 'predictive analytics', 'smart automation',
      'automated', 'algorithm', 'data science', 'analytics platform',
      'workflow automation', 'intelligent workflow', 'ai-driven', 'ai driven'
    ],
    weight: 0.6,
    tier: 'TIER_3'
  },
  
  // Context keywords (lower weight but important for context)
  CONTEXT: {
    keywords: [
      'recommendation engine', 'personalization', 'optimization',
      'fraud detection', 'anomaly detection', 'pattern recognition',
      'speech recognition', 'image recognition', 'text analysis'
    ],
    weight: 0.4,
    tier: 'TIER_3'
  }
};

function analyzeKeywordWeights(text: string): {
  totalWeight: number;
  maxWeight: number;
  categoryBreakdown: any[];
  finalScore: number;
} {
  let totalWeight = 0;
  let maxWeight = 0;
  const categoryBreakdown: any[] = [];

  Object.entries(AI_KEYWORDS).forEach(([categoryName, category]) => {
    const matchedKeywords = category.keywords.filter(keyword => 
      text.includes(keyword.toLowerCase())
    );
    
    const matchCount = matchedKeywords.length;
    
    if (matchCount > 0) {
      const categoryWeight = Math.min(1.0, matchCount * 0.2) * category.weight;
      totalWeight += categoryWeight;
      maxWeight = Math.max(maxWeight, category.weight);
      
      categoryBreakdown.push({
        category: categoryName,
        tier: category.tier,
        weight: category.weight,
        matchedKeywords,
        matchCount,
        categoryWeight: Number(categoryWeight.toFixed(3))
      });
    }
  });

  // Normalize by maximum possible weight
  const finalScore = Math.min(1.0, totalWeight / 2.0);
  
  return {
    totalWeight: Number(totalWeight.toFixed(3)),
    maxWeight,
    categoryBreakdown,
    finalScore: Number(finalScore.toFixed(3))
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyName = searchParams.get('company') || 'Cone';
    
    const supabase = createServiceClient();
    
    // Get company data
    const { data: company, error } = await supabase
      .from('companies')
      .select('*')
      .eq('name', companyName)
      .single();
      
    if (error || !company) {
      return NextResponse.json({
        error: `Company not found: ${companyName}`
      }, { status: 404 });
    }
    
    const text = `${company.one_liner || ''} ${company.long_description || ''}`.toLowerCase();
    
    console.log(`\n🔍 KEYWORD SCORING DEBUG FOR: ${companyName}`);
    console.log('='.repeat(60));
    console.log(`Text: "${text}"`);
    console.log(`Length: ${text.length} characters\n`);
    
    const keywordAnalysis = analyzeKeywordWeights(text);
    
    console.log('📊 KEYWORD ANALYSIS BREAKDOWN:');
    console.log(`Total Weight: ${keywordAnalysis.totalWeight}`);
    console.log(`Max Weight: ${keywordAnalysis.maxWeight}`);
    console.log(`Final Score: ${keywordAnalysis.finalScore}`);
    console.log(`Final Score * 0.3 (confidence contribution): ${(keywordAnalysis.finalScore * 0.3).toFixed(3)}\n`);
    
    keywordAnalysis.categoryBreakdown.forEach((category, index) => {
      console.log(`${index + 1}. ${category.category} (${category.tier})`);
      console.log(`   Weight: ${category.weight}`);
      console.log(`   Matched keywords: [${category.matchedKeywords.join(', ')}]`);
      console.log(`   Match count: ${category.matchCount}`);
      console.log(`   Category weight: ${category.categoryWeight}`);
      console.log('');
    });
    
    // Calculate full confidence score manually
    let fullConfidence = 0;
    
    // Industry (none for Cone - B2B)
    console.log('🏭 INDUSTRY ANALYSIS:');
    console.log(`Industry: "${company.industry}"`);
    console.log('No AI industry match - 0 points\n');
    
    // Tags 
    console.log('🏷️  TAG ANALYSIS:');
    console.log(`Tags: ${JSON.stringify(company.tags)}`);
    
    const AI_TAGS = {
      HIGH_CONFIDENCE: [
        'AI', 'Machine Learning', 'ML', 'Artificial Intelligence',
        'Deep Learning', 'Neural Networks', 'Computer Vision', 'NLP',
        'LLM', 'Generative AI', 'Foundation Model'
      ],
      MEDIUM_CONFIDENCE: [
        'Analytics', 'Data Science', 'Automation', 'Intelligent',
        'Predictive', 'Smart', 'Algorithm', 'Big Data'
      ]
    };
    
    const hasHighConfidenceTags = AI_TAGS.HIGH_CONFIDENCE.some(tag =>
      company.tags.some((companyTag: string) => 
        companyTag.toLowerCase().includes(tag.toLowerCase())
      )
    );
    
    const tagScore = hasHighConfidenceTags ? 0.3 : 0.15;
    fullConfidence += tagScore;
    console.log(`High confidence tags: ${hasHighConfidenceTags}`);
    console.log(`Tag score: ${tagScore}\n`);
    
    // Keywords
    console.log('🔤 KEYWORD SCORING:');
    const keywordContribution = keywordAnalysis.finalScore * 0.3;
    fullConfidence += keywordContribution;
    console.log(`Keyword score contribution: ${keywordContribution.toFixed(3)}\n`);
    
    console.log('📈 FINAL CONFIDENCE CALCULATION:');
    console.log(`Industry: 0`);
    console.log(`Tags: ${tagScore}`);
    console.log(`Keywords: ${keywordContribution.toFixed(3)}`);
    console.log(`Total: ${fullConfidence.toFixed(3)}`);
    
    return NextResponse.json({
      success: true,
      company: companyName,
      text,
      keywordAnalysis,
      confidence: {
        industryScore: 0,
        tagScore,
        keywordScore: keywordContribution,
        total: Number(fullConfidence.toFixed(3))
      },
      issues: [
        "Industry 'B2B' not recognized as AI-related (0 points)",
        "Tags don't include high-confidence AI terms (only 0.15 points)",
        `Keyword 'ai-powered' only contributes ${keywordContribution.toFixed(3)} points`
      ],
      recommendations: [
        "Add 'AI' or 'Machine Learning' to tags for higher confidence",
        "Consider industry classification update",
        "Keyword weighting might need adjustment for 'ai-powered'"
      ]
    });
    
  } catch (error) {
    console.error('Keyword scoring debug failed:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}