/**
 * Fix AI Classification API Route
 * 
 * Re-runs AI detection on companies that may have been misclassified.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { AICompanyDetector } from '@/lib/ai-company-detector';
import { logInfo, logWarn, logError } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    logInfo('Starting AI classification fix via API');
    
    const supabase = createServiceClient();
    
    // Get companies that might be misclassified
    const { data: companies, error } = await supabase
      .from('companies')
      .select(`
        id, name, batch, one_liner, long_description, 
        industry, tags, is_ai_related, 
        ai_confidence_score, ai_classification_date
      `)
      .or('is_ai_related.is.false,ai_confidence_score.is.null,ai_classification_date.is.null')
      .limit(50);
      
    if (error) {
      throw new Error(`Failed to fetch companies: ${error.message}`);
    }
    
    if (!companies || companies.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No companies found to reclassify',
        results: {
          processed: 0,
          updated: 0,
          newAICompanies: 0
        }
      });
    }
    
    logInfo(`Found ${companies.length} companies to check`);
    
    let updated = 0;
    let newAICompanies = 0;
    const results = [];
    
    for (const company of companies) {
      try {
        // Run AI detection - create minimal company object with required fields
        const detection = AICompanyDetector.detectAICompany({
          id: company.id,
          name: company.name,
          batch: company.batch || '',
          status: 'Active' as const,
          one_liner: company.one_liner || '',
          long_description: company.long_description || '',
          industry: company.industry || '',
          tags: company.tags || [],
          regions: [],
          is_hiring: false,
          github_repos: [],
          huggingface_models: []
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
            confidence: Number(detection.confidence.toFixed(3)),
            tier: detection.tier,
            reasoning: detection.reasoning.slice(0, 2)
          });
          
          logInfo(`Updated ${company.name}: ${wasAI ? 'AI' : 'Non-AI'} → ${isNowAI ? 'AI' : 'Non-AI'} (${detection.confidence.toFixed(3)})`);
        }
        
      } catch (error) {
        logError(`Error processing ${company.name}:`, error);
      }
    }
    
    const duration = Date.now() - startTime;
    
    // Get newly found AI companies for display
    const newlyFoundAI = results.filter(r => !r.wasAI && r.isNowAI);
    
    return NextResponse.json({
      success: true,
      message: `AI classification fix completed. Found ${newAICompanies} new AI companies.`,
      results: {
        processed: companies.length,
        updated: updated,
        newAICompanies: newAICompanies,
        duration: `${(duration / 1000).toFixed(1)}s`,
        notable_changes: results.slice(0, 10), // First 10 changes
        newly_found_ai: newlyFoundAI.map(c => ({
          name: c.name,
          batch: c.batch,
          confidence: c.confidence,
          tier: c.tier
        }))
      }
    });
    
  } catch (error) {
    logError('AI classification fix failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'AI classification fix failed'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'AI Classification Fix Endpoint',
    description: 'POST to this endpoint to re-run AI classification on misclassified companies',
    usage: 'POST /api/admin/fix-ai-classification'
  });
}