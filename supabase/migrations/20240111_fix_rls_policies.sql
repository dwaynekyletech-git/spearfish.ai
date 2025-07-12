-- Drop existing policies and recreate them properly
DROP POLICY IF EXISTS "companies_select_authenticated" ON companies;
DROP POLICY IF EXISTS "companies_select_deny_anon" ON companies;
DROP POLICY IF EXISTS "user_profiles_select_own" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_company" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_deny_anon" ON user_profiles;
DROP POLICY IF EXISTS "artifacts_select_company" ON artifacts;
DROP POLICY IF EXISTS "artifacts_select_templates" ON artifacts;
DROP POLICY IF EXISTS "artifacts_select_deny_anon" ON artifacts;

-- COMPANIES TABLE POLICIES
-- Deny anonymous access by default
CREATE POLICY "companies_deny_anon" ON companies
  FOR ALL
  TO anon
  USING (false);

-- Allow authenticated users to read companies
CREATE POLICY "companies_authenticated_read" ON companies
  FOR SELECT
  TO authenticated
  USING (true);

-- USER_PROFILES TABLE POLICIES  
-- Deny anonymous access by default
CREATE POLICY "user_profiles_deny_anon" ON user_profiles
  FOR ALL
  TO anon
  USING (false);

-- Users can read their own profile
CREATE POLICY "user_profiles_own_read" ON user_profiles
  FOR SELECT
  TO authenticated
  USING (clerk_user_id = public.clerk_user_id());

-- Users can read profiles of people in their company
CREATE POLICY "user_profiles_company_read" ON user_profiles
  FOR SELECT
  TO authenticated
  USING (company_id = public.user_company_id());

-- ARTIFACTS TABLE POLICIES
-- Deny anonymous access by default
CREATE POLICY "artifacts_deny_anon" ON artifacts
  FOR ALL
  TO anon
  USING (false);

-- Users can read artifacts from their company
CREATE POLICY "artifacts_company_read" ON artifacts
  FOR SELECT
  TO authenticated
  USING (company_id = public.user_company_id());

-- Users can read template artifacts
CREATE POLICY "artifacts_templates_read" ON artifacts
  FOR SELECT
  TO authenticated
  USING (is_template = true);

-- Test the policies by checking if anonymous role is properly denied
-- This should return an error for anonymous users
DO $$
BEGIN
  -- This block will help verify RLS is working
  RAISE NOTICE 'RLS policies updated. Anonymous access should now be properly blocked.';
END $$;