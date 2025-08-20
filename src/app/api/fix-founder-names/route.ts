/**
 * Fix Founder Names API
 * 
 * Clean up placeholder founder names and update with real data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { logInfo } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    
    // Get companies with specific placeholder names
    const { data: founders, error } = await supabase
      .from('founders')
      .select(`
        id, name, title, bio, company_id,
        companies!inner(name, yc_url)
      `)
      .or('name.eq.founder Struct,name.eq.Intercom both');
      
    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch founders with placeholder names',
        details: error
      });
    }
    
    console.log(`🔍 Found ${founders.length} founders with placeholder names`);
    
    const fixes: any[] = [];
    const structFixes = [
      {
        oldName: 'founder Struct',
        newName: 'Fatma Akcay',
        title: 'Founder',
        bio: 'Co-founder of Struct, building multi-lingual AI voice agents.',
        linkedin: 'https://www.linkedin.com/in/fatmaakcay/'
      },
      {
        oldName: 'Intercom both',
        newName: 'Eamonn Gahan', 
        title: 'Founder',
        bio: 'Worked at various UK Startups and Intercom both as an IC and EM. Co-founder of Struct.',
        linkedin: 'https://www.linkedin.com/in/gahan/'
      }
    ];
    
    for (const founder of founders) {
      const companyName = (founder.companies as any)?.name;
      
      console.log(`📋 Processing: ${founder.name} at ${companyName}`);
      
      // Check if this is a Struct founder we can fix
      if (companyName === 'Struct') {
        const fix = structFixes.find(f => f.oldName === founder.name);
        if (fix) {
          const { error: updateError } = await supabase
            .from('founders')
            .update({
              name: fix.newName,
              title: fix.title,
              bio: fix.bio,
              linkedin_url: fix.linkedin,
              data_source: 'manual', // Keep the existing allowed value
              updated_at: new Date().toISOString()
            })
            .eq('id', founder.id);
            
          if (updateError) {
            console.log(`❌ Failed to update ${founder.name}: ${updateError.message}`);
          } else {
            fixes.push({
              company: companyName,
              oldName: founder.name,
              newName: fix.newName,
              success: true
            });
            console.log(`✅ Updated: ${founder.name} → ${fix.newName}`);
          }
        }
      } else {
        // For other companies, just mark as placeholder for now
        fixes.push({
          company: companyName,
          oldName: founder.name,
          newName: 'PLACEHOLDER_DETECTED',
          success: false,
          note: 'Detected placeholder, manual review needed'
        });
      }
    }
    
    // Don't run the second query for now to focus on the specific fixes
    
    return NextResponse.json({
      success: true,
      message: `Processed ${founders.length} placeholder founders`,
      results: {
        totalProcessed: founders.length,
        fixedCount: fixes.filter(f => f.success).length,
        needsReviewCount: fixes.filter(f => !f.success).length,
        fixes: fixes
      }
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Fix Founder Names API',
    description: 'POST to clean up placeholder founder names like "founder Struct" and "Intercom both"',
    usage: 'POST /api/fix-founder-names'
  });
}