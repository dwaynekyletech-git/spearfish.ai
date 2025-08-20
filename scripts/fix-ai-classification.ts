#!/usr/bin/env tsx

/**
 * Fix AI Classification Script
 * 
 * Re-runs AI detection on companies that may have been misclassified.
 * Updates the database with corrected AI classifications.
 */

import { createServiceClient } from '../src/lib/supabase-server';
import { AICompanyDetector } from '../src/lib/ai-company-detector';
import { logInfo, logWarn, logError } from '../src/lib/logger';

async function fixAIClassification() {
  const startTime = Date.now();
  
  try {
    logInfo('Starting AI classification fix');
    
    const supabase = createServiceClient();
    
    // Get companies that might be misclassified
    const { data: companies, error } = await supabase
      .from('companies')
      .select(`
        id, name, batch, one_liner, long_description, 
        industry, tags, is_ai_related, 
        ai_confidence_score, ai_classification_date
      `)
      .or(`
        is_ai_related.is.false,
        ai_confidence_score.is.null,
        ai_classification_date.is.null
      `)
      .limit(100);
      
    if (error) {
      throw new Error(`Failed to fetch companies: ${error.message}`);
    }
    
    if (!companies || companies.length === 0) {
      logInfo('No companies found to reclassify');
      return;
    }
    
    logInfo(`Found ${companies.length} companies to check`);
    
    let updated = 0;
    let newAICompanies = 0;
    const results = [];
    
    for (const company of companies) {
      try {
        // Run AI detection
        const detection = AICompanyDetector.detectAICompany({
          name: company.name,
          one_liner: company.one_liner || '',
          long_description: company.long_description || '',
          industry: company.industry || '',
          tags: company.tags || []
        });
        
        // Check if classification changed
        const wasAI = company.is_ai_related;
        const isNowAI = detection.isAI;
        
        if (wasAI !== isNowAI || !company.ai_confidence_score) {
          // Update the company
          const { error: updateError } = await supabase
            .from('companies')
            .update({
              is_ai_related: detection.isAI,
              ai_confidence_score: detection.confidence,
              ai_classification_date: new Date().toISOString()
            })
            .eq('id', company.id);
            
          if (updateError) {
            logWarn(`Failed to update ${company.name}:`, updateError);
            continue;
          }
          
          updated++;
          if (!wasAI && isNowAI) {
            newAICompanies++;
          }
          
          results.push({
            name: company.name,
            batch: company.batch,
            wasAI,
            isNowAI,
            confidence: detection.confidence.toFixed(2),
            tier: detection.tier,
            reasoning: detection.reasoning.slice(0, 2) // First 2 reasons
          });
          
          logInfo(`Updated ${company.name}: ${wasAI ? 'AI' : 'Non-AI'} → ${isNowAI ? 'AI' : 'Non-AI'} (${detection.confidence.toFixed(2)})`);
        }
        
      } catch (error) {
        logError(`Error processing ${company.name}:`, error);
      }
    }
    
    const duration = Date.now() - startTime;
    
    // Print summary
    console.log('\n=== AI CLASSIFICATION FIX RESULTS ===');
    console.log(`Processed: ${companies.length} companies`);
    console.log(`Updated: ${updated} companies`);
    console.log(`New AI companies found: ${newAICompanies}`);
    console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);
    
    if (results.length > 0) {
      console.log('\n=== NOTABLE CHANGES ===');
      results.forEach(result => {
        const status = result.wasAI === result.isNowAI ? '=' : result.isNowAI ? '↗️' : '↘️';
        console.log(`${status} ${result.name} (${result.batch})`);
        console.log(`   Confidence: ${result.confidence} | Tier: ${result.tier}`);
        console.log(`   Reasons: ${result.reasoning.join(', ')}`);
        console.log('');
      });
    }
    
    // Show some examples of newly found AI companies
    const newlyFoundAI = results.filter(r => !r.wasAI && r.isNowAI);
    if (newlyFoundAI.length > 0) {
      console.log(`\n🎯 NEWLY IDENTIFIED AI COMPANIES (${newlyFoundAI.length}):`);
      newlyFoundAI.forEach(company => {
        console.log(`• ${company.name} (${company.batch}) - Confidence: ${company.confidence}`);
      });
    }
    
    logInfo('AI classification fix completed successfully');
    
  } catch (error) {
    logError('AI classification fix failed:', error);
    throw error;
  }
}

// Run the script if called directly
if (require.main === module) {
  fixAIClassification()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

export { fixAIClassification };