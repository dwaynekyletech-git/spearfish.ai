/**
 * Debug AI Detection API Route
 * 
 * Tests AI detection on specific companies to understand why
 * obvious AI companies aren't being detected properly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { AICompanyDetector } from '@/lib/ai-company-detector';

export async function GET(request: NextRequest) {
  try {
    console.log('=== AI DETECTION DEBUG API ===\n');
    
    const supabase = createServiceClient();
    
    // Get specific companies to debug from URL params or use defaults
    const { searchParams } = new URL(request.url);
    const companiesParam = searchParams.get('companies');
    const testCompanies = companiesParam ? companiesParam.split(',') : ['Cone', 'Struct'];
    
    const results = [];
    
    for (const companyName of testCompanies) {
      console.log(`\n🔍 DEBUGGING: ${companyName}`);
      console.log('='.repeat(50));
      
      // Get company data from database
      const { data: company, error } = await supabase
        .from('companies')
        .select('*')
        .eq('name', companyName)
        .single();
        
      if (error || !company) {
        console.log(`❌ Could not find company: ${companyName}`);
        results.push({
          company: companyName,
          error: `Company not found: ${companyName}`,
          found: false
        });
        continue;
      }
      
      console.log('📋 COMPANY DATA:');
      console.log(`  Name: ${company.name}`);
      console.log(`  Industry: ${company.industry || 'N/A'}`);
      console.log(`  One-liner: ${company.one_liner || 'N/A'}`);
      console.log(`  Long description: ${company.long_description || 'N/A'}`);
      console.log(`  Tags: ${JSON.stringify(company.tags || [])}`);
      console.log(`  Current is_ai_related: ${company.is_ai_related}`);
      console.log(`  Current confidence: ${company.ai_confidence_score}`);
      
      // Test AI detection with detailed logging
      console.log('\n🤖 AI DETECTION ANALYSIS:');
      
      // Create the text that will be analyzed
      const analysisText = `${company.one_liner || ''} ${company.long_description || ''}`.toLowerCase();
      console.log(`  Analysis text: "${analysisText}"`);
      console.log(`  Analysis text length: ${analysisText.length} characters`);
      
      // Check for specific keywords manually
      console.log('\n🔎 KEYWORD ANALYSIS:');
      const testKeywords = [
        'ai-powered', 'ai powered', 'artificial intelligence', 'machine learning',
        'ai', 'intelligent', 'automated', 'work operating system', 'operating system'
      ];
      
      const keywordResults: any = {};
      testKeywords.forEach(keyword => {
        const found = analysisText.includes(keyword);
        keywordResults[keyword] = found;
        console.log(`  "${keyword}": ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
      });
      
      // Run the actual AI detection - create minimal company object with required fields
      const detection = AICompanyDetector.detectAICompany({
        id: company.id,
        name: company.name,
        batch: company.batch || 'Unknown',
        status: 'Active' as const,
        one_liner: company.one_liner || '',
        long_description: company.long_description || '',
        industry: company.industry || '',
        tags: company.tags || [],
        regions: [],
        is_hiring: false,
        github_repos: [],
        huggingface_models: [],
        team_size: company.team_size
      });
      
      console.log('\n📊 DETECTION RESULTS:');
      console.log(`  Is AI: ${detection.isAI}`);
      console.log(`  Confidence: ${detection.confidence.toFixed(3)}`);
      console.log(`  Tier: ${detection.tier}`);
      console.log(`  Priority: ${detection.priority}`);
      
      console.log('\n🔬 SIGNAL BREAKDOWN:');
      console.log(`  Has AI Industry: ${detection.signals.hasAIIndustry}`);
      console.log(`  Has AI Tags: ${detection.signals.hasAITags}`);
      console.log(`  Has AI Keywords: ${detection.signals.hasAIKeywords}`);
      console.log(`  Has AI in Description: ${detection.signals.hasAIInDescription}`);
      console.log(`  Has Generative AI Signals: ${detection.signals.hasGenerativeAISignals}`);
      console.log(`  Has ML Infrastructure Signals: ${detection.signals.hasMLInfrastructureSignals}`);
      console.log(`  Has Advanced AI Signals: ${detection.signals.hasAdvancedAISignals}`);
      
      console.log('\n💭 REASONING:');
      detection.reasoning.forEach((reason, index) => {
        console.log(`  ${index + 1}. ${reason}`);
      });
      
      // Test individual signal detection methods
      console.log('\n🧪 INDIVIDUAL SIGNAL TESTS:');
      
      // Test description signals specifically
      const testText = analysisText;
      const aiPhrases = [
        'ai-powered', 'ai-driven', 'machine learning', 'artificial intelligence',
        'deep learning', 'neural network', 'computer vision', 'natural language'
      ];
      
      const phraseResults: any = {};
      console.log('  Description signals test:');
      aiPhrases.forEach(phrase => {
        const found = testText.includes(phrase);
        phraseResults[phrase] = found;
        console.log(`    "${phrase}": ${found ? '✅' : '❌'}`);
      });
      
      // Store result for API response
      results.push({
        company: companyName,
        found: true,
        data: {
          name: company.name,
          industry: company.industry,
          one_liner: company.one_liner,
          long_description: company.long_description,
          tags: company.tags,
          current_is_ai_related: company.is_ai_related,
          current_confidence: company.ai_confidence_score,
        },
        analysis: {
          analysisText,
          textLength: analysisText.length,
          keywordTests: keywordResults,
          phraseTests: phraseResults
        },
        detection: {
          isAI: detection.isAI,
          confidence: Number(detection.confidence.toFixed(3)),
          tier: detection.tier,
          priority: detection.priority,
          signals: detection.signals,
          reasoning: detection.reasoning
        }
      });
    }
    
    return NextResponse.json({
      success: true,
      message: `Debug analysis completed for ${testCompanies.length} companies`,
      companies: testCompanies,
      results: results
    });
    
  } catch (error) {
    console.error('Debug API failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'AI detection debug failed'
    }, { status: 500 });
  }
}