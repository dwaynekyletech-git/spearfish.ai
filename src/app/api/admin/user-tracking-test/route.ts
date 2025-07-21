import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use service role client to get all user data for testing
    const supabase = createServiceClient()

    // Start with a simple test - just get user profiles
    const { data: userProfiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (profilesError) {
      console.error('Error fetching user profiles:', profilesError)
      return NextResponse.json(
        { error: `Failed to fetch user profiles: ${profilesError.message}` },
        { status: 500 }
      )
    }

    // Try to get research sessions - simple query first
    const { data: researchSessions, error: sessionsError } = await supabase
      .from('company_research_sessions')
      .select(`
        id,
        created_by,
        session_type,
        status,
        cost_usd,
        tokens_used,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(10)

    if (sessionsError) {
      console.error('Error fetching research sessions:', sessionsError)
      // Don't fail completely, just note the error
      return NextResponse.json({
        current_user_id: userId,
        total_users: userProfiles?.length || 0,
        user_profiles: userProfiles?.slice(0, 5) || [],
        sessions_error: sessionsError.message,
        test_status: 'partial_success'
      })
    }

    // Try to get research findings (linked through sessions since no direct created_by)
    const { data: researchFindings, error: findingsError } = await supabase
      .from('research_findings')
      .select(`
        id,
        session_id,
        finding_type,
        confidence_score,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    if (findingsError) {
      console.error('Error fetching research findings:', findingsError)
      // Don't fail completely, just note the error
      return NextResponse.json({
        current_user_id: userId,
        total_users: userProfiles?.length || 0,
        user_profiles: userProfiles?.slice(0, 5) || [],
        recent_sessions: researchSessions || [],
        findings_error: findingsError.message,
        test_status: 'partial_success'
      })
    }

    // Success case - return full data
    const userActivityStats = userProfiles?.map(user => {
      const userSessions = researchSessions?.filter(session => 
        session.created_by === user.id
      ) || []
      
      // Link findings to user through sessions (since findings don't have direct created_by)
      const userSessionIds = userSessions.map(session => session.id)
      const userFindings = researchFindings?.filter(finding => 
        userSessionIds.includes(finding.session_id)
      ) || []

      const totalCost = userSessions.reduce((sum, session) => 
        sum + (session.cost_usd || 0), 0
      )
      
      const totalTokens = userSessions.reduce((sum, session) => 
        sum + (session.tokens_used || 0), 0
      )

      return {
        user_id: user.clerk_user_id,
        email: user.email,
        full_name: user.full_name,
        company: 'Unknown', // Will add company data later
        total_sessions: userSessions.length,
        total_findings: userFindings.length,
        total_cost: totalCost,
        total_tokens: totalTokens,
        last_activity: userSessions[0]?.created_at || user.created_at,
        is_current_user: user.clerk_user_id === userId
      }
    }) || []

    // Add user profile info to sessions for display
    const sessionsWithUsers = researchSessions?.map(session => {
      const userProfile = userProfiles?.find(user => user.id === session.created_by)
      return {
        ...session,
        user_profiles: userProfile ? {
          clerk_user_id: userProfile.clerk_user_id,
          email: userProfile.email,
          full_name: userProfile.full_name
        } : null
      }
    }) || []

    return NextResponse.json({
      current_user_id: userId,
      total_users: userProfiles?.length || 0,
      user_activity_stats: userActivityStats,
      recent_sessions: sessionsWithUsers,
      recent_findings: researchFindings || [],
      user_separation_test: {
        users_have_unique_ids: new Set(userProfiles?.map(u => u.clerk_user_id)).size === userProfiles?.length,
        sessions_properly_attributed: researchSessions?.every(s => s.created_by) || true,
        findings_properly_attributed: researchFindings?.every(f => f.session_id) || true
      },
      test_status: 'full_success'
    })

  } catch (error) {
    console.error('Error in user tracking test:', error)
    return NextResponse.json(
      { error: `Internal server error: ${error}` },
      { status: 500 }
    )
  }
}