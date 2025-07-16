/**
 * List Companies API Route
 * 
 * List all companies in the database with their IDs
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
    
    const { data: companies, error } = await supabase
      .from('companies')
      .select('id, name, slug, website_url, batch')
      .order('name');
    
    if (error) {
      throw new Error(`Failed to fetch companies: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        companies: companies || [],
        count: companies?.length || 0
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to list companies:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to list companies'
    }, { status: 500 });
  }
}