# Star Growth Function Fix

## Problem
The `calculate_star_growth` function has an ambiguous column reference error:
```
column reference "repository_id" is ambiguous
```

## Root Cause
In the `calculate_star_growth` function, the FULL OUTER JOIN creates ambiguous column references when both tables have the same column name.

## Solution
The fix is already applied to the migration file at:
`/Users/dwaynejoseph/Projects/spearfish-ai/supabase/migrations/20250115_create_github_tables.sql`

The key change is on line 174:
```sql
-- BEFORE (ambiguous):
SELECT 
    COALESCE(bd.repository_id, repo_id) as repository_id,

-- AFTER (fixed):
SELECT 
    repo_id as repository_id,
```

## To Apply the Fix

Since we cannot execute raw SQL through the Supabase client API, you need to:

1. **Via Supabase Dashboard:**
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor
   - Execute the fixed function SQL from `supabase/migrations/20250115_fix_github_star_growth_function.sql`

2. **Via Supabase CLI:**
   ```bash
   supabase db reset
   # This will re-run all migrations including the fixed one
   ```

3. **Manual SQL Execution:**
   Connect to your database and execute:
   ```sql
   -- Drop and recreate the function
   DROP FUNCTION IF EXISTS calculate_star_growth(UUID, INTEGER);
   
   -- Then execute the corrected function from the migration file
   ```

## Verification
After applying the fix, the dashboard should load without the ambiguous column errors.

## Files Modified
- `supabase/migrations/20250115_create_github_tables.sql` - Fixed the ambiguous column reference
- `supabase/migrations/20250115_fix_github_star_growth_function.sql` - Standalone fix migration
- `apply-function-fix.js` - Script to test the function

## Impact
Once fixed, the GitHub star growth calculations will work correctly and you won't see the terminal errors when loading the dashboard.