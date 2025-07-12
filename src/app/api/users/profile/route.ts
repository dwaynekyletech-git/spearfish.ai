import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient, createServerClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { email, fullName, companyId } = body

    if (!email || !fullName || !companyId) {
      return NextResponse.json(
        { error: 'Missing required fields: email, fullName, companyId' },
        { status: 400 }
      )
    }

    // Use service role client to create user profile
    const supabase = createServiceClient()

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('clerk_user_id', userId)
      .single()

    if (existingProfile) {
      return NextResponse.json(
        { error: 'User profile already exists' },
        { status: 409 }
      )
    }

    // Create new user profile
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .insert({
        clerk_user_id: userId,
        email: email,
        full_name: fullName,
        company_id: companyId,
        role: 'member' // Default role
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating user profile:', error)
      return NextResponse.json(
        { error: 'Failed to create user profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Error in profile creation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

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

    // Get user profile (RLS will ensure they only see their own)
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select(`
        *,
        companies (
          id,
          name,
          batch
        )
      `)
      .eq('clerk_user_id', userId)
      .single()

    if (error) {
      console.error('Error fetching user profile:', error)
      return NextResponse.json(
        { error: 'Failed to fetch user profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Error in profile fetch:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}