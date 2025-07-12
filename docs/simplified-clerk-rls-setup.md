# Simplified Clerk + Supabase RLS Setup

This approach works around Supabase's current limitations with external JWT configuration by using the service role and session variables.

## How It Works

1. **Clerk** handles user authentication in your app
2. **Service Role** bypasses RLS but sets user context
3. **Session Variables** tell RLS which user is making the request
4. **RLS Policies** enforce data isolation based on the session variable

## Implementation Steps

### 1. Apply the Database Migration

```bash
# Apply the new RLS policies
supabase db reset  # This will run all migrations including the new one
```

### 2. Set Up Environment Variables

Add to your `.env.local`:

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Supabase  
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Required for this approach
```

### 3. Create User Profiles When Users Sign Up

Add this to your Clerk webhook handler or sign-up flow:

```typescript
import { createServiceClient } from '@/lib/supabase-server'

// When a user signs up through Clerk
export async function createUserProfile(clerkUserId: string, email: string, fullName: string) {
  const supabase = createServiceClient()
  
  const { data, error } = await supabase
    .from('user_profiles')
    .insert({
      clerk_user_id: clerkUserId,
      email: email,
      full_name: fullName,
      company_id: 'some-company-uuid', // Assign to a company
      role: 'member'
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating user profile:', error)
    throw error
  }

  return data
}
```

### 4. Use the Server Client in Your API Routes

```typescript
// In your API routes or server components
import { createServerClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createServerClient()
  
  // This will automatically apply RLS based on the current Clerk user
  const { data: artifacts, error } = await supabase
    .from('artifacts')
    .select('*')
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json({ artifacts })
}
```

### 5. For Client-Side Operations

For now, use the service role approach on the server and expose safe endpoints:

```typescript
// app/api/artifacts/route.ts
import { createServerClient } from '@/lib/supabase-server'
import { auth } from '@clerk/nextjs/server'

export async function GET() {
  const { userId } = await auth()
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServerClient()
  
  const { data, error } = await supabase
    .from('artifacts')
    .select('*')
  
  return NextResponse.json({ data, error })
}
```

## What This Achieves

✅ **Row Level Security**: Users only see their company's data  
✅ **Clerk Integration**: Works with Clerk's user management  
✅ **No JWT Configuration**: Bypasses Supabase's external JWT limitations  
✅ **Secure**: Service role is only used server-side  

## Security Notes

- **Service role is only used server-side** - never expose it to the client
- **RLS still applies** - the session variables ensure proper data isolation
- **All client requests** should go through your API routes for security

## Testing

1. Sign up a user through Clerk
2. Create their user profile in Supabase
3. Make API calls to fetch artifacts
4. Verify they only see their company's data

## Next Steps

Once Supabase adds external JWT configuration support, you can migrate to the full JWT approach without changing your RLS policies.