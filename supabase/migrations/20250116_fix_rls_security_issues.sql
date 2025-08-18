-- Fix RLS Security Issues Found in Audit
-- This migration addresses the high-priority security findings where tables
-- are unexpectedly publicly accessible

-- =============================================================================
-- STEP 1: Fix User Profiles - Should be restricted to users/admins only
-- =============================================================================

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "user_profiles_select_authenticated" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_company" ON user_profiles;

-- Create restrictive policy: users can only see their own profile
CREATE POLICY "user_profiles_select_own" ON user_profiles
  FOR SELECT
  TO authenticated
  USING (clerk_user_id = auth.jwt() ->> 'clerk_user_id');

-- Allow company admins to see profiles in their company (if needed)
CREATE POLICY "user_profiles_select_company_admin" ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles admin_profile
      WHERE admin_profile.clerk_user_id = auth.jwt() ->> 'clerk_user_id'
      AND admin_profile.role = 'admin'
      AND admin_profile.company_id = user_profiles.company_id
    )
  );

-- =============================================================================
-- STEP 2: Fix Artifacts - Should be restricted to creators/company members
-- =============================================================================

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "artifacts_select_authenticated" ON artifacts;

-- Users can only see artifacts they created or are in their company
CREATE POLICY "artifacts_select_own_company" ON artifacts
  FOR SELECT
  TO authenticated
  USING (
    created_by = (
      SELECT id FROM user_profiles 
      WHERE clerk_user_id = auth.jwt() ->> 'clerk_user_id'
    )
    OR company_id = (
      SELECT company_id FROM user_profiles 
      WHERE clerk_user_id = auth.jwt() ->> 'clerk_user_id'
    )
    OR is_template = true  -- Allow templates to be visible to all
  );

-- =============================================================================
-- STEP 3: Fix Research Sessions - Should be user-specific
-- =============================================================================

-- Drop any existing permissive policies
DROP POLICY IF EXISTS "company_research_sessions_select_all" ON company_research_sessions;

-- Users can only see their own research sessions
CREATE POLICY "research_sessions_select_own" ON company_research_sessions
  FOR SELECT
  TO authenticated
  USING (
    user_id = (
      SELECT id FROM user_profiles 
      WHERE clerk_user_id = auth.jwt() ->> 'clerk_user_id'
    )
  );

-- =============================================================================
-- STEP 4: Fix Research Findings - Should be user-specific
-- =============================================================================

-- Drop any existing permissive policies
DROP POLICY IF EXISTS "research_findings_select_all" ON research_findings;

-- Users can only see findings from their research sessions
CREATE POLICY "research_findings_select_own" ON research_findings
  FOR SELECT
  TO authenticated
  USING (
    research_session_id IN (
      SELECT id FROM company_research_sessions
      WHERE user_id = (
        SELECT id FROM user_profiles 
        WHERE clerk_user_id = auth.jwt() ->> 'clerk_user_id'
      )
    )
  );

-- =============================================================================
-- STEP 5: Fix Project Artifacts - Should be user-specific
-- =============================================================================

-- Drop any existing permissive policies
DROP POLICY IF EXISTS "project_artifacts_select_all" ON project_artifacts;

-- Users can only see project artifacts they created
CREATE POLICY "project_artifacts_select_own" ON project_artifacts
  FOR SELECT
  TO authenticated
  USING (
    created_by = (
      SELECT id FROM user_profiles 
      WHERE clerk_user_id = auth.jwt() ->> 'clerk_user_id'
    )
  );

-- =============================================================================
-- STEP 6: Fix Email Campaigns - Should be user-specific
-- =============================================================================

-- Drop any existing permissive policies
DROP POLICY IF EXISTS "email_campaigns_select_all" ON email_campaigns;

-- Users can only see email campaigns they created
CREATE POLICY "email_campaigns_select_own" ON email_campaigns
  FOR SELECT
  TO authenticated
  USING (
    created_by = (
      SELECT id FROM user_profiles 
      WHERE clerk_user_id = auth.jwt() ->> 'clerk_user_id'
    )
  );

-- =============================================================================
-- STEP 7: Fix Score History - Should be read-only for authenticated users
-- =============================================================================

-- Drop any existing permissive policies
DROP POLICY IF EXISTS "score_history_read_policy" ON score_history;

-- Allow authenticated users to read score history (for transparency)
CREATE POLICY "score_history_select_authenticated" ON score_history
  FOR SELECT
  TO authenticated
  USING (true);

-- Block anonymous access to score history
CREATE POLICY "score_history_no_anon" ON score_history
  FOR ALL
  TO anon
  USING (false);

-- =============================================================================
-- STEP 8: Fix Score Batch Logs - Should be admin only
-- =============================================================================

-- Drop any existing permissive policies
DROP POLICY IF EXISTS "score_batch_logs_select_all" ON score_batch_logs;

-- Only allow service role to access batch logs
CREATE POLICY "score_batch_logs_service_only" ON score_batch_logs
  FOR ALL
  TO service_role
  USING (true);

-- Block all other access
CREATE POLICY "score_batch_logs_no_access" ON score_batch_logs
  FOR ALL
  TO authenticated, anon
  USING (false);

-- =============================================================================
-- STEP 9: Fix Sync Logs - Should be admin/service only
-- =============================================================================

-- GitHub sync logs
DROP POLICY IF EXISTS "github_sync_logs_select_all" ON github_sync_logs;

CREATE POLICY "github_sync_logs_service_only" ON github_sync_logs
  FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "github_sync_logs_no_access" ON github_sync_logs
  FOR ALL
  TO authenticated, anon
  USING (false);

-- YC sync logs
DROP POLICY IF EXISTS "yc_sync_logs_select_all" ON yc_sync_logs;

CREATE POLICY "yc_sync_logs_service_only" ON yc_sync_logs
  FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "yc_sync_logs_no_access" ON yc_sync_logs
  FOR ALL
  TO authenticated, anon
  USING (false);

-- =============================================================================
-- STEP 10: Keep Public Access for Appropriate Tables
-- =============================================================================

-- Verify that companies table allows public read (should already exist)
-- This is correct - companies should be publicly discoverable

-- Verify GitHub-related public tables have appropriate access
-- github_repositories, github_repository_metrics should remain public
-- but github_repository_languages and company_github_repositories should be restricted

-- Fix github_repository_languages - make it authenticated only
DROP POLICY IF EXISTS "github_repository_languages_select_all" ON github_repository_languages;

CREATE POLICY "github_repository_languages_authenticated" ON github_repository_languages
  FOR SELECT
  TO authenticated
  USING (true);

-- Fix company_github_repositories - make it authenticated only  
DROP POLICY IF EXISTS "company_github_repositories_select_all" ON company_github_repositories;

CREATE POLICY "company_github_repositories_authenticated" ON company_github_repositories
  FOR SELECT
  TO authenticated
  USING (true);

-- =============================================================================
-- STEP 11: Fix Founders and Funding Data
-- =============================================================================

-- Founders should be public (for company discovery) but not editable by users
DROP POLICY IF EXISTS "founders_select_all" ON founders;

CREATE POLICY "founders_public_read" ON founders
  FOR SELECT
  USING (true);  -- Public read for company discovery

CREATE POLICY "founders_service_write" ON founders
  FOR INSERT, UPDATE, DELETE
  TO service_role
  USING (true);

-- Funding rounds should be public read
DROP POLICY IF EXISTS "funding_rounds_select_all" ON funding_rounds;

CREATE POLICY "funding_rounds_public_read" ON funding_rounds
  FOR SELECT
  USING (true);  -- Public read for company discovery

CREATE POLICY "funding_rounds_service_write" ON funding_rounds
  FOR INSERT, UPDATE, DELETE
  TO service_role
  USING (true);

-- Funding summary should be public read
DROP POLICY IF EXISTS "company_funding_summary_select_all" ON company_funding_summary;

CREATE POLICY "company_funding_summary_public_read" ON company_funding_summary
  FOR SELECT
  USING (true);  -- Public read for company discovery

CREATE POLICY "company_funding_summary_service_write" ON company_funding_summary
  FOR INSERT, UPDATE, DELETE
  TO service_role
  USING (true);

-- =============================================================================
-- VERIFICATION AND LOGGING
-- =============================================================================

-- Log the migration completion
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔒 RLS SECURITY FIXES APPLIED SUCCESSFULLY! 🔒';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Fixed table access policies:';
  RAISE NOTICE '• user_profiles: Now restricted to own profile + company admins';
  RAISE NOTICE '• artifacts: Now restricted to creators/company members + templates';
  RAISE NOTICE '• research_sessions: Now restricted to creators only';
  RAISE NOTICE '• research_findings: Now restricted to session creators';
  RAISE NOTICE '• project_artifacts: Now restricted to creators only';
  RAISE NOTICE '• email_campaigns: Now restricted to creators only';
  RAISE NOTICE '• score_history: Now authenticated users only';
  RAISE NOTICE '• score_batch_logs: Now service role only';
  RAISE NOTICE '• sync_logs: Now service role only';
  RAISE NOTICE '• github_repository_languages: Now authenticated only';
  RAISE NOTICE '• company_github_repositories: Now authenticated only';
  RAISE NOTICE '';
  RAISE NOTICE '🌐 Public access maintained for:';
  RAISE NOTICE '• companies: Public discovery (correct)';
  RAISE NOTICE '• github_repositories: Public discovery (correct)';
  RAISE NOTICE '• github_repository_metrics: Public discovery (correct)';
  RAISE NOTICE '• founders: Public discovery (correct)';
  RAISE NOTICE '• funding_rounds: Public discovery (correct)';
  RAISE NOTICE '• company_funding_summary: Public discovery (correct)';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  Important: Re-run security audit to verify fixes!';
  RAISE NOTICE '';
END $$;