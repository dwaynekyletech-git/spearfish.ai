import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient, createServerClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use the server client which sets user context
    const supabase = createServiceClient()
    
    // Set user context for RLS
    await supabase.rpc('set_current_user_context', { user_id: userId })

    // Get artifacts (RLS will ensure they only see their company's artifacts + templates)
    const { data: artifacts, error } = await supabase
      .from('artifacts')
      .select(`
        *,
        created_by_profile:user_profiles!artifacts_created_by_fkey (
          full_name,
          email
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching artifacts:', error)
      return NextResponse.json(
        { error: 'Failed to fetch artifacts' },
        { status: 500 }
      )
    }

    return NextResponse.json({ artifacts })
  } catch (error) {
    console.error('Error in artifacts fetch:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, title, content, metadata, isTemplate } = body

    if (!type || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: type, title' },
        { status: 400 }
      )
    }

    // Use the server client which sets user context
    const supabase = createServiceClient()
    
    // Set user context for RLS
    await supabase.rpc('set_current_user_context', { user_id: userId })

    // Get user's profile to get company_id and profile_id
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, company_id')
      .eq('clerk_user_id', userId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Create artifact (RLS will ensure it's created for their company)
    const { data: artifact, error } = await supabase
      .from('artifacts')
      .insert({
        company_id: profile.company_id,
        created_by: profile.id,
        type: type,
        title: title,
        content: content || {},
        metadata: metadata || {},
        is_template: isTemplate || false
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating artifact:', error)
      return NextResponse.json(
        { error: 'Failed to create artifact' },
        { status: 500 }
      )
    }

    return NextResponse.json({ artifact })
  } catch (error) {
    console.error('Error in artifact creation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}