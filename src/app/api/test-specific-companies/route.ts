/**
 * Test Specific Companies API
 * 
 * Updates specific companies to test the new AI classification
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { AICompanyDetector } from '@/lib/ai-company-detector';

export async function POST(request: NextRequest) {
  try {
    const { companies } = await request.json();
    const testCompanies = companies || ['Cone', 'Struct'];
    
    const supabase = createServiceClient();
    const results = [];
    
    for (const companyName of testCompanies) {
      // Get company data
      const { data: company, error } = await supabase
        .from('companies')
        .select('*')
        .eq('name', companyName)
        .single();
        
      if (error || !company) {
        results.push({
          name: companyName,
          error: 'Company not found',
          success: false
        });
        continue;
      }
      
      // Run AI detection - create minimal company object with required fields
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
      
      // Update the company with new classification
      const { error: updateError } = await supabase
        .from('companies')
        .update({
          is_ai_related: detection.isAI,
          ai_confidence_score: detection.confidence,
          ai_classification_date: new Date().toISOString()
        })
        .eq('id', company.id);
        
      if (updateError) {
        results.push({
          name: companyName,
          error: `Update failed: ${updateError.message}`,
          success: false
        });
        continue;
      }
      
      results.push({
        name: companyName,
        success: true,
        before: {
          isAI: company.is_ai_related,
          confidence: company.ai_confidence_score
        },
        after: {
          isAI: detection.isAI,
          confidence: Number(detection.confidence.toFixed(3)),
          tier: detection.tier,
          priority: detection.priority
        },
        changed: company.is_ai_related !== detection.isAI
      });
    }
    
    return NextResponse.json({
      success: true,
      message: `Updated ${testCompanies.length} companies`,
      results
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}