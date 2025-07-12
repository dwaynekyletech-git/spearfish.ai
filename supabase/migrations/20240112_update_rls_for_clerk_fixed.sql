-- Update RLS policies to work with Clerk authentication
-- This migration updates the helper functions and policies to properly integrate with Clerk JWT tokens

-- STEP 1: Drop all existing policies first (so we can drop the functions they depend on)

-- Drop Companies policies
DROP POLICY IF EXISTS "companies_deny_anon" ON companies;
DROP POLICY IF EXISTS "companies_authenticated_read" ON companies;
DROP POLICY IF EXISTS "companies_update_own_admin" ON companies;
DROP POLICY IF EXISTS "companies_insert_service" ON companies;
DROP POLICY IF EXISTS "companies_delete_service" ON companies;
DROP POLICY IF EXISTS "companies_select_authenticated" ON companies;
DROP POLICY IF EXISTS "companies_select_deny_anon" ON companies;

-- Drop User profiles policies
DROP POLICY IF EXISTS "user_profiles_deny_anon" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_own_read" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_company_read" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_own" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_all_service" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_own" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_company" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_deny_anon" ON user_profiles;

-- Drop Artifacts policies
DROP POLICY IF EXISTS "artifacts_deny_anon" ON artifacts;
DROP POLICY IF EXISTS "artifacts_company_read" ON artifacts;
DROP POLICY IF EXISTS "artifacts_templates_read" ON artifacts;
DROP POLICY IF EXISTS "artifacts_insert_company" ON artifacts;
DROP POLICY IF EXISTS "artifacts_update_own" ON artifacts;
DROP POLICY IF EXISTS "artifacts_update_admin" ON artifacts;
DROP POLICY IF EXISTS "artifacts_delete_own" ON artifacts;
DROP POLICY IF EXISTS "artifacts_delete_admin" ON artifacts;
DROP POLICY IF EXISTS "artifacts_select_company" ON artifacts;
DROP POLICY IF EXISTS "artifacts_select_templates" ON artifacts;
DROP POLICY IF EXISTS "artifacts_select_deny_anon" ON artifacts;

-- STEP 2: Now drop the old helper functions
DROP FUNCTION IF EXISTS public.user_id();
DROP FUNCTION IF EXISTS public.clerk_user_id();
DROP FUNCTION IF EXISTS public.user_company_id();
DROP FUNCTION IF EXISTS public.is_company_admin();

-- STEP 3: Create new helper functions

-- Create a function to extract Clerk user ID from JWT
-- This works with session variables (for service role) and JWT claims
CREATE OR REPLACE FUNCTION public.get_clerk_user_id() 
RETURNS TEXT AS $$
BEGIN
  -- First check if we have a session variable set (for service role operations)
  DECLARE
    session_user_id TEXT;
  BEGIN
    session_user_id := current_setting('app.current_clerk_user_id', true);
    IF session_user_id IS NOT NULL AND session_user_id != '' THEN
      RETURN session_user_id;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- Continue to other methods
      NULL;
  END;

  -- Try to get from Supabase auth (if using Supabase auth)
  IF auth.uid() IS NOT NULL THEN
    RETURN auth.uid()::text;
  END IF;
  
  -- Otherwise try to get from JWT claims (for direct Clerk integration)
  RETURN NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::text;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Create a function to set user context (for service role operations)
CREATE OR REPLACE FUNCTION public.set_current_user_context(user_id TEXT)
RETURNS VOID AS $$
BEGIN
  -- Set a session variable with the current user ID
  PERFORM set_config('app.current_clerk_user_id', user_id, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get the current user's profile
CREATE OR REPLACE FUNCTION public.get_current_user_profile() 
RETURNS user_profiles AS $$
DECLARE
  profile user_profiles;
BEGIN
  SELECT * INTO profile
  FROM user_profiles
  WHERE clerk_user_id = public.get_clerk_user_id();
  
  RETURN profile;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Create a function to get the current user's company ID
CREATE OR REPLACE FUNCTION public.get_user_company_id() 
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT company_id FROM public.get_current_user_profile());
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Create a function to check if the current user is a company admin
CREATE OR REPLACE FUNCTION public.is_company_admin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE((SELECT role = 'admin' FROM public.get_current_user_profile()), false);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Create a function to get the current user's profile ID
CREATE OR REPLACE FUNCTION public.get_current_user_id() 
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT id FROM public.get_current_user_profile());
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- STEP 4: Create new RLS policies

-- COMPANIES TABLE POLICIES
-- Policy 1: Block all anonymous access
CREATE POLICY "companies_no_anon_access" ON companies
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- Policy 2: Allow authenticated users to read all companies
CREATE POLICY "companies_authenticated_select" ON companies
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy 3: Allow company admins to update their company
CREATE POLICY "companies_admin_update" ON companies
  FOR UPDATE
  TO authenticated
  USING (
    id = public.get_user_company_id() 
    AND public.is_company_admin() = true
  )
  WITH CHECK (
    id = public.get_user_company_id() 
    AND public.is_company_admin() = true
  );

-- Policy 4: Service role can do everything
CREATE POLICY "companies_service_role_all" ON companies
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- USER_PROFILES TABLE POLICIES
-- Policy 1: Block all anonymous access
CREATE POLICY "user_profiles_no_anon_access" ON user_profiles
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- Policy 2: Users can read their own profile
CREATE POLICY "user_profiles_select_own" ON user_profiles
  FOR SELECT
  TO authenticated
  USING (clerk_user_id = public.get_clerk_user_id());

-- Policy 3: Users can read profiles of people in their company
CREATE POLICY "user_profiles_select_same_company" ON user_profiles
  FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id());

-- Policy 4: Users can update their own profile
CREATE POLICY "user_profiles_update_own" ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (clerk_user_id = public.get_clerk_user_id())
  WITH CHECK (clerk_user_id = public.get_clerk_user_id());

-- Policy 5: Service role can do everything
CREATE POLICY "user_profiles_service_role_all" ON user_profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ARTIFACTS TABLE POLICIES
-- Policy 1: Block all anonymous access
CREATE POLICY "artifacts_no_anon_access" ON artifacts
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- Policy 2: Users can read artifacts from their company
CREATE POLICY "artifacts_select_company" ON artifacts
  FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id());

-- Policy 3: All authenticated users can read public templates
CREATE POLICY "artifacts_select_public_templates" ON artifacts
  FOR SELECT
  TO authenticated
  USING (is_template = true);

-- Policy 4: Users can create artifacts for their company
CREATE POLICY "artifacts_insert_own_company" ON artifacts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND created_by = public.get_current_user_id()
  );

-- Policy 5: Users can update their own artifacts
CREATE POLICY "artifacts_update_own" ON artifacts
  FOR UPDATE
  TO authenticated
  USING (created_by = public.get_current_user_id())
  WITH CHECK (created_by = public.get_current_user_id());

-- Policy 6: Company admins can update any artifact in their company
CREATE POLICY "artifacts_update_company_admin" ON artifacts
  FOR UPDATE
  TO authenticated
  USING (
    company_id = public.get_user_company_id() 
    AND public.is_company_admin() = true
  )
  WITH CHECK (
    company_id = public.get_user_company_id() 
    AND public.is_company_admin() = true
  );

-- Policy 7: Users can delete their own artifacts
CREATE POLICY "artifacts_delete_own" ON artifacts
  FOR DELETE
  TO authenticated
  USING (created_by = public.get_current_user_id());

-- Policy 8: Company admins can delete any artifact in their company
CREATE POLICY "artifacts_delete_company_admin" ON artifacts
  FOR DELETE
  TO authenticated
  USING (
    company_id = public.get_user_company_id() 
    AND public.is_company_admin() = true
  );

-- Policy 9: Service role can do everything
CREATE POLICY "artifacts_service_role_all" ON artifacts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- STEP 5: Add helpful comments and indexes

COMMENT ON FUNCTION public.get_clerk_user_id() IS 'Extracts the Clerk user ID from session variable or JWT token';
COMMENT ON FUNCTION public.set_current_user_context(TEXT) IS 'Sets the current user context for service role operations';
COMMENT ON FUNCTION public.get_current_user_profile() IS 'Returns the full user profile for the current authenticated user';
COMMENT ON FUNCTION public.get_user_company_id() IS 'Returns the company ID for the current authenticated user';
COMMENT ON FUNCTION public.is_company_admin() IS 'Checks if the current user is an admin of their company';
COMMENT ON FUNCTION public.get_current_user_id() IS 'Returns the user profile ID for the current authenticated user';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_clerk_user_id ON user_profiles(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_company_id ON artifacts(company_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_created_by ON artifacts(created_by);
CREATE INDEX IF NOT EXISTS idx_artifacts_is_template ON artifacts(is_template) WHERE is_template = true;

-- STEP 6: Verify the setup
DO $$
BEGIN
  RAISE NOTICE 'RLS policies have been updated for Clerk authentication integration';
  RAISE NOTICE 'Use the service role client with set_current_user_context() to set user context';
  RAISE NOTICE 'All existing policies have been replaced with new ones';
END $$;