-- Enable Row Level Security on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's profile
CREATE OR REPLACE FUNCTION public.user_id() 
RETURNS UUID AS $$
  SELECT (auth.jwt() ->> 'sub')::UUID
$$ LANGUAGE SQL SECURITY DEFINER;

-- Helper function to get current user's Clerk ID
CREATE OR REPLACE FUNCTION public.clerk_user_id() 
RETURNS TEXT AS $$
  SELECT auth.jwt() ->> 'clerk_user_id'
$$ LANGUAGE SQL SECURITY DEFINER;

-- Helper function to check if user belongs to a company
CREATE OR REPLACE FUNCTION public.user_company_id() 
RETURNS UUID AS $$
  SELECT company_id 
  FROM user_profiles 
  WHERE clerk_user_id = public.clerk_user_id()
$$ LANGUAGE SQL SECURITY DEFINER;

-- Helper function to check if user is admin of their company
CREATE OR REPLACE FUNCTION public.is_company_admin() 
RETURNS BOOLEAN AS $$
  SELECT role = 'admin' 
  FROM user_profiles 
  WHERE clerk_user_id = public.clerk_user_id()
$$ LANGUAGE SQL SECURITY DEFINER;

-- COMPANIES TABLE POLICIES
-- Allow all authenticated users to read companies (for discovery)
CREATE POLICY "companies_select_authenticated" ON companies
  FOR SELECT
  TO authenticated
  USING (true);

-- Block anonymous access to companies
CREATE POLICY "companies_select_deny_anon" ON companies
  FOR SELECT
  TO anon
  USING (false);

-- Allow company admins to update their company
CREATE POLICY "companies_update_own_admin" ON companies
  FOR UPDATE
  TO authenticated
  USING (
    id = public.user_company_id() 
    AND public.is_company_admin()
  );

-- Only allow service role to insert/delete companies
CREATE POLICY "companies_insert_service" ON companies
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "companies_delete_service" ON companies
  FOR DELETE
  TO service_role
  USING (true);

-- USER_PROFILES TABLE POLICIES
-- Users can read their own profile
CREATE POLICY "user_profiles_select_own" ON user_profiles
  FOR SELECT
  TO authenticated
  USING (clerk_user_id = public.clerk_user_id());

-- Users can read profiles of people in their company
CREATE POLICY "user_profiles_select_company" ON user_profiles
  FOR SELECT
  TO authenticated
  USING (company_id = public.user_company_id());

-- Block anonymous access to user profiles
CREATE POLICY "user_profiles_select_deny_anon" ON user_profiles
  FOR SELECT
  TO anon
  USING (false);

-- Users can update their own profile
CREATE POLICY "user_profiles_update_own" ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (clerk_user_id = public.clerk_user_id())
  WITH CHECK (clerk_user_id = public.clerk_user_id());

-- Service role can manage all user profiles
CREATE POLICY "user_profiles_all_service" ON user_profiles
  FOR ALL
  TO service_role
  USING (true);

-- ARTIFACTS TABLE POLICIES
-- Users can read artifacts from their company
CREATE POLICY "artifacts_select_company" ON artifacts
  FOR SELECT
  TO authenticated
  USING (company_id = public.user_company_id());

-- Users can read template artifacts (is_template = true)
CREATE POLICY "artifacts_select_templates" ON artifacts
  FOR SELECT
  TO authenticated
  USING (is_template = true);

-- Block anonymous access to artifacts
CREATE POLICY "artifacts_select_deny_anon" ON artifacts
  FOR SELECT
  TO anon
  USING (false);

-- Users can create artifacts for their company
CREATE POLICY "artifacts_insert_company" ON artifacts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.user_company_id()
    AND created_by = (
      SELECT id FROM user_profiles 
      WHERE clerk_user_id = public.clerk_user_id()
    )
  );

-- Users can update artifacts they created
CREATE POLICY "artifacts_update_own" ON artifacts
  FOR UPDATE
  TO authenticated
  USING (
    created_by = (
      SELECT id FROM user_profiles 
      WHERE clerk_user_id = public.clerk_user_id()
    )
  );

-- Company admins can update any artifact in their company
CREATE POLICY "artifacts_update_admin" ON artifacts
  FOR UPDATE
  TO authenticated
  USING (
    company_id = public.user_company_id() 
    AND public.is_company_admin()
  );

-- Users can delete artifacts they created
CREATE POLICY "artifacts_delete_own" ON artifacts
  FOR DELETE
  TO authenticated
  USING (
    created_by = (
      SELECT id FROM user_profiles 
      WHERE clerk_user_id = public.clerk_user_id()
    )
  );

-- Company admins can delete any artifact in their company
CREATE POLICY "artifacts_delete_admin" ON artifacts
  FOR DELETE
  TO authenticated
  USING (
    company_id = public.user_company_id() 
    AND public.is_company_admin()
  );

-- Add comments for documentation
COMMENT ON POLICY "companies_select_authenticated" ON companies IS 'All authenticated users can view companies for discovery';
COMMENT ON POLICY "companies_update_own_admin" ON companies IS 'Company admins can update their own company';
COMMENT ON POLICY "user_profiles_select_own" ON user_profiles IS 'Users can view their own profile';
COMMENT ON POLICY "user_profiles_select_company" ON user_profiles IS 'Users can view profiles of teammates';
COMMENT ON POLICY "artifacts_select_templates" ON artifacts IS 'All users can view template artifacts';
COMMENT ON POLICY "artifacts_select_company" ON artifacts IS 'Users can view artifacts from their company';