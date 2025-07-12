import { createClient } from '@supabase/supabase-js'
import { useAuth } from '@clerk/nextjs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

/**
 * Custom hook to create a Supabase client with Clerk authentication
 * This client automatically includes the Clerk JWT token for authenticated requests
 */
export function useSupabaseClient() {
  const { getToken, isLoaded, userId } = useAuth()

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      // Custom fetch function that includes the Clerk token
      fetch: async (url, options = {}) => {
        // Only try to get token if Clerk is loaded and user is signed in
        if (isLoaded && userId) {
          try {
            const clerkToken = await getToken({ template: 'supabase' })
            
            if (clerkToken) {
              const headers = new Headers(options.headers)
              headers.set('Authorization', `Bearer ${clerkToken}`)
              
              return fetch(url, {
                ...options,
                headers,
              })
            }
          } catch (error) {
            console.warn('Failed to get Clerk token:', error)
            // Fall through to default fetch
          }
        }

        // Fallback to default fetch (unauthenticated)
        return fetch(url, options)
      },
    },
    auth: {
      persistSession: false, // We handle auth through Clerk
      autoRefreshToken: false,
    },
  })

  return supabase
}

/**
 * Creates a Supabase client with Clerk authentication for use in components
 * This is a synchronous version that can be used outside of React hooks
 */
export function createClerkSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      fetch: async (url, options = {}) => {
        // Check if Clerk is available on window
        if (typeof window !== 'undefined' && window.Clerk?.session) {
          try {
            const clerkToken = await window.Clerk.session.getToken({
              template: 'supabase',
            })

            if (clerkToken) {
              const headers = new Headers(options.headers)
              headers.set('Authorization', `Bearer ${clerkToken}`)

              return fetch(url, {
                ...options,
                headers,
              })
            }
          } catch (error) {
            console.warn('Failed to get Clerk token:', error)
          }
        }

        return fetch(url, options)
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

// Type for global Clerk object
declare global {
  interface Window {
    Clerk: {
      session?: {
        getToken: (options: { template: string }) => Promise<string | null>
      }
    }
  }
}

// Type exports for better TypeScript support
export type { SupabaseClient } from '@supabase/supabase-js'