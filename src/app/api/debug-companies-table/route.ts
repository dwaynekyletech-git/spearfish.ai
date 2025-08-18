/**
 * Debug Companies Table API Route
 * 
 * Check the current structure of the companies table
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get table structure by querying a sample row instead
    const { data: sample, error: sampleError } = await supabase
      .from('companies')
      .select('*')
      .limit(1);
    
    if (sampleError) {
      throw new Error(`Failed to query companies table: ${sampleError.message}`);
    }

    // Get count of companies
    const { count, error: countError } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true });
    
    return NextResponse.json({
      success: true,
      data: {
        table_exists: true,
        sample_row: sample?.[0] || null,
        total_companies: count || 0,
        columns: sample?.[0] ? Object.keys(sample[0]) : [],
        column_count: sample?.[0] ? Object.keys(sample[0]).length : 0
      }
    });
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}