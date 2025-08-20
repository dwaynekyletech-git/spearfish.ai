#!/usr/bin/env tsx

/**
 * Debug AI Detection Script
 * 
 * Tests AI detection on specific companies to understand why
 * obvious AI companies aren't being detected properly.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createServiceClient } from '../src/lib/supabase-server';
import { AICompanyDetector } from '../src/lib/ai-company-detector';
import { logInfo } from '../src/lib/logger';

async function debugAIDetection() {
  try {
    console.log('=== AI DETECTION DEBUG ===\n');
    
    const supabase = createServiceClient();
    
    // Get specific companies to debug
    const testCompanies = ['Cone', 'Struct'];
    
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
      
      testKeywords.forEach(keyword => {
        const found = analysisText.includes(keyword);
        console.log(`  "${keyword}": ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
      });
      
      // Run the actual AI detection
      const detection = AICompanyDetector.detectAICompany({
        name: company.name,
        one_liner: company.one_liner || '',
        long_description: company.long_description || '',
        industry: company.industry || '',
        tags: company.tags || [],
        batch: company.batch || 'Unknown',
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
      
      console.log('  Description signals test:');
      aiPhrases.forEach(phrase => {
        const found = testText.includes(phrase);
        console.log(`    "${phrase}": ${found ? '✅' : '❌'}`);
      });
    }
    
  } catch (error) {
    console.error('Debug script failed:', error);
    throw error;
  }
}

// Run the script if called directly
if (require.main === module) {
  debugAIDetection()
    .then(() => {
      console.log('\n✅ Debug analysis completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('Debug script failed:', error);
      process.exit(1);
    });
}

export { debugAIDetection };