/**
 * Debug Companies Table API Route
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
    
    // Get table structure
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_name', 'companies')
      .eq('table_schema', 'public');
    
    if (columnsError) {
      throw new Error(`Failed to get columns: ${columnsError.message}`);
    }

    // Get enum types if they exist
    const { data: enums, error: enumsError } = await supabase
      .from('information_schema.routines')
      .select('*')
      .eq('routine_schema', 'public')
      .like('routine_name', '%company%');
    
    // Try to get enum values for status column
    const { data: enumValues, error: enumValuesError } = await supabase
      .rpc('get_enum_values', { enum_name: 'company_status' })
      .single();
    
    const statusColumn = columns?.find(c => c.column_name === 'status');
    
    return NextResponse.json({
      success: true,
      data: {
        columns: columns || [],
        status_column: statusColumn,
        enum_values: enumValues || null,
        enum_values_error: enumValuesError?.message || null,
        column_count: columns?.length || 0
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