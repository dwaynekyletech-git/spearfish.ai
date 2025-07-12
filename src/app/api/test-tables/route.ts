import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Test 1: Check if companies table exists
    const { count: companiesCount, error: companiesError } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })

    if (companiesError) {
      throw new Error(`Companies table error: ${companiesError.message}`)
    }

    // Test 2: Check if user_profiles table exists
    const { count: usersCount, error: usersError } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })

    if (usersError) {
      throw new Error(`User profiles table error: ${usersError.message}`)
    }

    // Test 3: Check if artifacts table exists
    const { count: artifactsCount, error: artifactsError } = await supabase
      .from('artifacts')
      .select('*', { count: 'exact', head: true })

    if (artifactsError) {
      throw new Error(`Artifacts table error: ${artifactsError.message}`)
    }

    // Test 4: Try to insert test data with relationships
    const testResult = await testTableRelationships()

    return NextResponse.json({
      status: 'success',
      message: 'All tables created successfully!',
      tables: {
        companies: { exists: true, rowCount: companiesCount || 0 },
        user_profiles: { exists: true, rowCount: usersCount || 0 },
        artifacts: { exists: true, rowCount: artifactsCount || 0 }
      },
      relationshipTest: testResult
    })
  } catch (error) {
    console.error('Table test error:', error)
    return NextResponse.json(
      {
        status: 'error',
        message: 'Table test failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function testTableRelationships() {
  try {
    // Start a transaction by using the same client
    // First, create a test company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({
        yc_id: 'test_company_001',
        name: 'Test AI Company',
        batch: 'W24',
        is_ai_related: true,
        spearfish_score: 8.5,
        github_repos: ['https://github.com/test/repo'],
        huggingface_models: ['test-model-1']
      })
      .select()
      .single()

    if (companyError) {
      return { success: false, error: `Failed to create test company: ${companyError.message}` }
    }

    // Create a test user
    const { data: user, error: userError } = await supabase
      .from('user_profiles')
      .insert({
        clerk_user_id: 'test_clerk_user_001',
        email: 'test@example.com',
        full_name: 'Test User',
        company_id: company.id,
        role: 'admin'
      })
      .select()
      .single()

    if (userError) {
      // Clean up company
      await supabase.from('companies').delete().eq('id', company.id)
      return { success: false, error: `Failed to create test user: ${userError.message}` }
    }

    // Create a test artifact
    const { data: artifact, error: artifactError } = await supabase
      .from('artifacts')
      .insert({
        company_id: company.id,
        created_by: user.id,
        type: 'pitch_deck',
        title: 'Test Pitch Deck',
        content: { slides: ['Slide 1', 'Slide 2'] },
        is_template: false
      })
      .select()
      .single()

    if (artifactError) {
      // Clean up
      await supabase.from('user_profiles').delete().eq('id', user.id)
      await supabase.from('companies').delete().eq('id', company.id)
      return { success: false, error: `Failed to create test artifact: ${artifactError.message}` }
    }

    // Clean up test data
    await supabase.from('artifacts').delete().eq('id', artifact.id)
    await supabase.from('user_profiles').delete().eq('id', user.id)
    await supabase.from('companies').delete().eq('id', company.id)

    return { 
      success: true, 
      message: 'All tables and relationships working correctly!',
      testData: {
        companyId: company.id,
        userId: user.id,
        artifactId: artifact.id
      }
    }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error in relationship test' 
    }
  }
}