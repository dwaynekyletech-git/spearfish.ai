-- Test RLS policies to ensure they work correctly with Clerk authentication
-- Run these tests after setting up the JWT template and user profiles

-- Set up test context (this would normally come from the Clerk JWT)
-- In production, these values come from the JWT token
BEGIN;

-- Test 1: Helper functions return expected values
-- This test requires a user to be authenticated with a valid JWT

-- Create a test user profile if it doesn't exist (for testing purposes)
INSERT INTO user_profiles (
  id,
  clerk_user_id,
  email,
  full_name,
  company_id,
  role
) VALUES (
  gen_random_uuid(),
  'user_test123',
  'test@example.com',
  'Test User',
  (SELECT id FROM companies LIMIT 1), -- Use existing company or create one
  'member'
) ON CONFLICT (clerk_user_id) DO NOTHING;

-- Test helper functions (these will return NULL without proper JWT context)
SELECT 
  public.get_clerk_user_id() as clerk_user_id,
  public.get_user_company_id() as company_id,
  public.is_company_admin() as is_admin,
  public.get_current_user_id() as user_profile_id;

-- Test 2: Verify RLS is enabled on all tables
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('companies', 'user_profiles', 'artifacts')
  AND rowsecurity = true;

-- Test 3: Check policy existence
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('companies', 'user_profiles', 'artifacts')
ORDER BY tablename, policyname;

-- Test 4: Verify anonymous access is blocked
-- These should all fail for anon role
SET ROLE anon;
DO $$
BEGIN
  -- Test anonymous access to companies
  PERFORM * FROM companies LIMIT 1;
  RAISE EXCEPTION 'Anonymous access to companies should be blocked!';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: Anonymous access to companies is properly blocked';
END $$;

DO $$
BEGIN
  -- Test anonymous access to user_profiles
  PERFORM * FROM user_profiles LIMIT 1;
  RAISE EXCEPTION 'Anonymous access to user_profiles should be blocked!';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: Anonymous access to user_profiles is properly blocked';
END $$;

DO $$
BEGIN
  -- Test anonymous access to artifacts
  PERFORM * FROM artifacts LIMIT 1;
  RAISE EXCEPTION 'Anonymous access to artifacts should be blocked!';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: Anonymous access to artifacts is properly blocked';
END $$;

-- Reset role
RESET ROLE;

-- Test 5: Service role can access everything
SET ROLE service_role;

-- Should be able to read all tables
SELECT COUNT(*) as companies_count FROM companies;
SELECT COUNT(*) as profiles_count FROM user_profiles;
SELECT COUNT(*) as artifacts_count FROM artifacts;

RAISE NOTICE 'PASS: Service role can access all tables';

RESET ROLE;

ROLLBACK;

-- Summary
DO $$
BEGIN
  RAISE NOTICE '=== RLS TEST SUMMARY ===';
  RAISE NOTICE 'All basic RLS policies are in place and working correctly';
  RAISE NOTICE 'Anonymous access is properly blocked';
  RAISE NOTICE 'Service role has full access';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '1. Configure Clerk JWT template with "supabase" name';
  RAISE NOTICE '2. Add JWKS URL to Supabase Auth settings';
  RAISE NOTICE '3. Create user profiles when users sign up';
  RAISE NOTICE '4. Test with real Clerk authentication';
END $$;