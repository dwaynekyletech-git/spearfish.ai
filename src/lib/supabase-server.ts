import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

/**
 * Create a Supabase client for server-side operations with Clerk auth
 * Uses service role and sets user context via SQL
 */
export async function createServerClient() {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      // Return a basic client without auth for public operations
      return createClient(supabaseUrl!, supabaseAnonKey!)
    }

    // Use service role client and set user context
    const supabase = createServiceClient()
    
    // Set the current user context for RLS
    await supabase.rpc('set_current_user_context', { 
      user_id: userId 
    })

    return supabase
  } catch (error) {
    console.error('Error creating server client:', error)
    // Fallback to basic client
    return createClient(supabaseUrl!, supabaseAnonKey!)
  }
}

/**
 * Create a Supabase service role client for admin operations
 * WARNING: This bypasses RLS - use only in secure server-side contexts
 */
export function createServiceClient() {
  if (!supabaseServiceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(supabaseUrl!, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}