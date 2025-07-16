/**
 * Check Table Structure API Route
 * 
 * Check the current structure of the companies table
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Try to get a sample record to see the structure
    const { data: sampleData, error: sampleError } = await supabase
      .from('companies')
      .select('*')
      .limit(1);
    
    // Try to describe the table
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('describe_table', { table_name: 'companies' });
    
    return NextResponse.json({
      success: true,
      data: {
        sample_record: sampleData?.[0] || null,
        sample_error: sampleError?.message || null,
        table_info: tableInfo || null,
        table_error: tableError?.message || null,
        available_columns: sampleData?.[0] ? Object.keys(sampleData[0]) : []
      }
    });
    
  } catch (error) {
    console.error('❌ Check failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}