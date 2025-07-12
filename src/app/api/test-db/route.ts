import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Simple connection test - try to run a basic SQL query
    const { data, error } = await supabase.rpc('version')
    
    if (error) {
      // If the RPC doesn't exist, try a simpler approach
      // Just check if we can make any request to Supabase
      const { error: pingError } = await supabase
        .from('non_existent_table')
        .select('*')
        .limit(1)
      
      // If we get a "table doesn't exist" error, that's actually good - it means we're connected!
      if (pingError && (pingError.code === 'PGRST116' || pingError.code === '42P01')) {
        return NextResponse.json({
          status: 'success',
          message: 'Successfully connected to Supabase!',
          timestamp: new Date().toISOString(),
          projectUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          details: 'Database is empty but connection is working'
        })
      }
      
      throw pingError || error
    }

    return NextResponse.json({
      status: 'success',
      message: 'Successfully connected to Supabase!',
      timestamp: new Date().toISOString(),
      projectUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      postgresVersion: data
    })
  } catch (error) {
    console.error('Database connection error:', error)
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to connect to database',
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error
      },
      { status: 500 }
    )
  }
}