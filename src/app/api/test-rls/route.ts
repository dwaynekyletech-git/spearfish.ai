import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createServerClient, createServiceClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    // First, let's create some test data using service role to test RLS properly
    const serviceClient = createServiceClient()
    
    // Create test company
    const { data: testCompany } = await serviceClient
      .from('companies')
      .upsert({
        yc_id: 'test_rls_company',
        name: 'RLS Test Company',
        batch: 'W24'
      })
      .select()
      .single()

    // Test 1: Check that RLS blocks access to existing data without authentication
    const { data: companiesPublic, error: companiesError } = await supabase
      .from('companies')
      .select('*')
      .limit(1)

    const { data: usersPublic, error: usersError } = await supabase
      .from('user_profiles')
      .select('*')
      .limit(1)

    const { data: artifactsPublic, error: artifactsError } = await supabase
      .from('artifacts')
      .select('*')
      .limit(1)

    // Clean up test data
    if (testCompany) {
      await serviceClient
        .from('companies')
        .delete()
        .eq('yc_id', 'test_rls_company')
    }

    // Test 2: Check if helper functions exist and work
    let helperTest = null
    let helperError = null
    try {
      const result = await supabase.rpc('clerk_user_id')
      helperTest = result.data
    } catch (err) {
      helperError = err instanceof Error ? err.message : 'Unknown error'
    }

    // Test 3: Try server-side client (should handle auth properly)
    let serverClientTest = null
    let serverClientError = null
    try {
      const serverClient = await createServerClient()
      const { data, error } = await serverClient
        .from('companies')
        .select('count')
        .limit(1)
      serverClientTest = { data, error: error?.message }
    } catch (err) {
      serverClientError = err instanceof Error ? err.message : 'Unknown error'
    }

    // Test 4: Test service role client (should bypass RLS)
    let serviceClientTest = null
    let serviceClientError = null
    try {
      const serviceClient = createServiceClient()
      const { data, error } = await serviceClient
        .from('companies')
        .select('count')
        .limit(1)
      serviceClientTest = { data, error: error?.message }
    } catch (err) {
      serviceClientError = err instanceof Error ? err.message : 'Unknown error'
    }

    // Test 5: Try to insert data without proper auth (should fail)
    const { data: insertTest, error: insertError } = await supabase
      .from('companies')
      .insert({
        yc_id: 'test_company_rls',
        name: 'Test RLS Company',
        batch: 'W24'
      })
      .select()

    return NextResponse.json({
      status: 'success',
      message: 'RLS policy test completed',
      tests: {
        rls_protection: {
          companies: {
            protected: !!companiesError,
            error: companiesError?.message || 'No error (potential issue)',
            data_count: companiesPublic?.length || 0
          },
          user_profiles: {
            protected: !!usersError,
            error: usersError?.message || 'No error (potential issue)',
            data_count: usersPublic?.length || 0
          },
          artifacts: {
            protected: !!artifactsError,
            error: artifactsError?.message || 'No error (potential issue)',
            data_count: artifactsPublic?.length || 0
          }
        },
        helper_functions: {
          clerk_user_id_available: !helperError,
          result: helperTest,
          error: helperError
        },
        server_client: {
          works: !serverClientError,
          result: serverClientTest,
          error: serverClientError
        },
        service_client: {
          works: !serviceClientError,
          bypasses_rls: serviceClientTest?.data !== null,
          result: serviceClientTest,
          error: serviceClientError
        },
        insert_protection: {
          blocked: !!insertError,
          error: insertError?.message || 'Insert succeeded (potential security issue)',
          data: insertTest
        }
      },
      summary: {
        rls_enabled: !!(companiesError && usersError && artifactsError),
        helper_functions_work: !helperError,
        server_auth_configured: !serverClientError,
        service_role_configured: !serviceClientError,
        insert_protection_active: !!insertError
      }
    })
  } catch (error) {
    console.error('RLS test error:', error)
    return NextResponse.json(
      {
        status: 'error',
        message: 'RLS test failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}