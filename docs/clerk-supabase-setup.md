# Clerk + Supabase RLS Setup Guide

This guide explains how to configure Clerk authentication to work with Supabase Row Level Security (RLS) policies.

## Prerequisites

1. A Clerk application set up with your project
2. A Supabase project with the database migrations applied
3. Environment variables configured in `.env.local`:

```env
# Clerk Configuration
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ... # Only for server-side admin operations
```

## Step 1: Configure Clerk JWT Template

1. Go to your [Clerk Dashboard](https://dashboard.clerk.com)
2. Navigate to **JWT Templates** in the sidebar
3. Click **+ New template**
4. Name it `supabase`
5. Configure the template with these settings:

### JWT Template Configuration

```json
{
  "aud": "authenticated",
  "sub": "{{user.id}}",
  "email": "{{user.primary_email_address}}",
  "clerk_user_id": "{{user.id}}",
  "app_metadata": {
    "provider": "clerk"
  },
  "user_metadata": {
    "full_name": "{{user.full_name}}"
  }
}
```

### JWT Template Settings

- **Lifetime**: 60 seconds (or your preferred duration)
- **Algorithm**: RS256
- **Include default claims**: Unchecked

## Step 2: Configure Supabase to Accept Clerk JWTs

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Navigate to **Authentication** → **Providers**
3. Scroll down to **JWT Configuration**
4. Add your Clerk JWT configuration:

### Get Clerk's JWKS URL

1. In Clerk Dashboard, go to **API Keys**
2. Find your **Frontend API URL** (e.g., `https://your-app.clerk.accounts.dev`)
3. Your JWKS URL will be: `https://your-app.clerk.accounts.dev/.well-known/jwks.json`

### Configure in Supabase

- **JWT Secret**: Leave empty (we'll use JWKS)
- **JWKS URL**: `https://your-app.clerk.accounts.dev/.well-known/jwks.json`
- **JWT Audience**: `authenticated`
- **JWT Issuer**: Your Clerk Frontend API URL

## Step 3: Update Your Application Code

### Server-Side Supabase Client

The server-side client is already configured in `/src/lib/supabase-server.ts` to:
1. Get the Clerk user token
2. Pass it to Supabase for authentication

```typescript
const clerkToken = await getToken({ template: 'supabase' })
```

### Client-Side Supabase Client

For client-side operations, create a new file `/src/lib/supabase-client.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'
import { useAuth } from '@clerk/nextjs'

export function useSupabaseClient() {
  const { getToken } = useAuth()
  
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      async accessToken() {
        const token = await getToken({ template: 'supabase' })
        return token ?? ''
      },
    }
  )
}
```

## Step 4: Test the Integration

### 1. Create a Test User

Sign up a new user through your Clerk-powered application.

### 2. Create User Profile

When a user signs up, create their profile in Supabase:

```typescript
// In your sign-up flow or webhook handler
const supabase = createServiceClient() // Uses service role for admin operations

const { data, error } = await supabase
  .from('user_profiles')
  .insert({
    clerk_user_id: userId, // From Clerk
    email: emailAddress,
    full_name: fullName,
    company_id: companyId, // Assign to a company
    role: 'member'
  })
```

### 3. Test RLS Policies

Try to access data as the authenticated user:

```typescript
// This should only return data from the user's company
const { data: artifacts } = await supabase
  .from('artifacts')
  .select('*')

// This should only return the user's profile and teammates
const { data: profiles } = await supabase
  .from('user_profiles')
  .select('*')
```

## RLS Policy Overview

The Row Level Security policies enforce:

1. **Companies Table**
   - All authenticated users can view companies (for discovery)
   - Only company admins can update their company
   - Anonymous users are blocked

2. **User Profiles Table**
   - Users can view their own profile
   - Users can view profiles of teammates in their company
   - Users can update only their own profile
   - Anonymous users are blocked

3. **Artifacts Table**
   - Users can CRUD artifacts within their company
   - All authenticated users can view template artifacts
   - Company admins can update/delete any artifact in their company
   - Anonymous users are blocked

## Troubleshooting

### "JWT verification failed"

- Ensure your Clerk JWT template is named exactly `supabase`
- Verify the JWKS URL is correct in Supabase
- Check that the audience claim is set to `authenticated`

### "Permission denied" errors

- Verify the user has a profile in `user_profiles` table
- Check that the `clerk_user_id` matches the Clerk user ID
- Ensure the user is assigned to a company

### Debug RLS Policies

Test your RLS policies in Supabase SQL editor:

```sql
-- Check what user ID is being extracted
SELECT public.get_clerk_user_id();

-- Check user's company
SELECT public.get_user_company_id();

-- Check if user is admin
SELECT public.is_company_admin();
```

## Security Best Practices

1. **Never expose the service role key** to the client
2. **Always use RLS** for user-facing operations
3. **Use service role only** for admin operations in secure server-side code
4. **Validate all inputs** before database operations
5. **Audit sensitive operations** using Supabase's audit logs

## Next Steps

1. Set up Clerk webhooks to sync user data
2. Implement real-time subscriptions with RLS
3. Add more granular permissions as needed
4. Monitor RLS policy performance