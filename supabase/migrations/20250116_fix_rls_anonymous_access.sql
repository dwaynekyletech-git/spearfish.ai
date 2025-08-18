-- Fix RLS Anonymous Access Issues
-- This migration adds explicit policies to block anonymous access where needed

-- =============================================================================
-- STEP 1: Add explicit anonymous blocking policies
-- =============================================================================

-- Block anonymous access to user_profiles
CREATE POLICY "user_profiles_block_anon" ON user_profiles
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- Block anonymous access to artifacts
CREATE POLICY "artifacts_block_anon" ON artifacts
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- Block anonymous access to research sessions
CREATE POLICY "research_sessions_block_anon" ON company_research_sessions
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- Block anonymous access to research findings
CREATE POLICY "research_findings_block_anon" ON research_findings
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- Block anonymous access to project artifacts
CREATE POLICY "project_artifacts_block_anon" ON project_artifacts
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- Block anonymous access to email campaigns
CREATE POLICY "email_campaigns_block_anon" ON email_campaigns
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- Block anonymous access to score history
CREATE POLICY "score_history_block_anon" ON score_history
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- Block anonymous access to score batch logs
CREATE POLICY "score_batch_logs_block_anon" ON score_batch_logs
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- Block anonymous access to sync logs
CREATE POLICY "github_sync_logs_block_anon" ON github_sync_logs
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "yc_sync_logs_block_anon" ON yc_sync_logs
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- Block anonymous access to github repository languages
CREATE POLICY "github_repo_languages_block_anon" ON github_repository_languages
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- Block anonymous access to company github repositories
CREATE POLICY "company_github_repos_block_anon" ON company_github_repositories
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- =============================================================================
-- STEP 2: Fix companies table policies for proper anonymous access
-- =============================================================================

-- Drop existing companies policies to recreate them properly
DROP POLICY IF EXISTS "companies_public_read" ON companies;
DROP POLICY IF EXISTS "companies_select_authenticated" ON companies;
DROP POLICY IF EXISTS "companies_select_deny_anon" ON companies;
DROP POLICY IF EXISTS "companies_update_own_admin" ON companies;
DROP POLICY IF EXISTS "companies_insert_service" ON companies;
DROP POLICY IF EXISTS "companies_delete_service" ON companies;

-- Allow public read access to companies (for discovery)
CREATE POLICY "companies_public_read" ON companies
  FOR SELECT
  USING (true);

-- Block anonymous write access to companies
CREATE POLICY "companies_block_anon_write" ON companies
  AS RESTRICTIVE
  FOR INSERT, UPDATE, DELETE
  TO anon
  USING (false)
  WITH CHECK (false);

-- Allow authenticated users to read companies
CREATE POLICY "companies_auth_read" ON companies
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role full access
CREATE POLICY "companies_service_all" ON companies
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow company admins to update their company (if needed)
CREATE POLICY "companies_admin_update" ON companies
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE clerk_user_id = auth.jwt() ->> 'clerk_user_id'
      AND role = 'admin'
      AND company_id = companies.id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE clerk_user_id = auth.jwt() ->> 'clerk_user_id'
      AND role = 'admin'
      AND company_id = companies.id
    )
  );

-- =============================================================================
-- STEP 3: Ensure founder/funding data has proper anonymous read access
-- =============================================================================

-- Drop existing founder policies to recreate them properly
DROP POLICY IF EXISTS "founders_public_read" ON founders;
DROP POLICY IF EXISTS "founders_service_write" ON founders;

-- Allow public read access to founders (for company discovery)
CREATE POLICY "founders_public_read" ON founders
  FOR SELECT
  USING (true);

-- Block anonymous write access to founders
CREATE POLICY "founders_block_anon_write" ON founders
  AS RESTRICTIVE
  FOR INSERT, UPDATE, DELETE
  TO anon
  USING (false)
  WITH CHECK (false);

-- Allow service role full access to founders
CREATE POLICY "founders_service_all" ON founders
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Same for funding rounds
DROP POLICY IF EXISTS "funding_rounds_public_read" ON funding_rounds;
DROP POLICY IF EXISTS "funding_rounds_service_write" ON funding_rounds;

CREATE POLICY "funding_rounds_public_read" ON funding_rounds
  FOR SELECT
  USING (true);

CREATE POLICY "funding_rounds_block_anon_write" ON funding_rounds
  AS RESTRICTIVE
  FOR INSERT, UPDATE, DELETE
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "funding_rounds_service_all" ON funding_rounds
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Same for company funding summary
DROP POLICY IF EXISTS "company_funding_summary_public_read" ON company_funding_summary;
DROP POLICY IF EXISTS "company_funding_summary_service_write" ON company_funding_summary;

CREATE POLICY "company_funding_summary_public_read" ON company_funding_summary
  FOR SELECT
  USING (true);

CREATE POLICY "company_funding_summary_block_anon_write" ON company_funding_summary
  AS RESTRICTIVE
  FOR INSERT, UPDATE, DELETE
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "company_funding_summary_service_all" ON company_funding_summary
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- STEP 4: Ensure GitHub public data has proper access
-- =============================================================================

-- GitHub repositories should be publicly readable
DROP POLICY IF EXISTS "Allow read access to github_repositories" ON github_repositories;

CREATE POLICY "github_repositories_public_read" ON github_repositories
  FOR SELECT
  USING (true);

CREATE POLICY "github_repositories_block_anon_write" ON github_repositories
  AS RESTRICTIVE
  FOR INSERT, UPDATE, DELETE
  TO anon
  USING (false)
  WITH CHECK (false);

-- GitHub repository metrics should be publicly readable
DROP POLICY IF EXISTS "Allow read access to github_repository_metrics" ON github_repository_metrics;

CREATE POLICY "github_repo_metrics_public_read" ON github_repository_metrics
  FOR SELECT
  USING (true);

CREATE POLICY "github_repo_metrics_block_anon_write" ON github_repository_metrics
  AS RESTRICTIVE
  FOR INSERT, UPDATE, DELETE
  TO anon
  USING (false)
  WITH CHECK (false);

-- =============================================================================
-- VERIFICATION AND LOGGING
-- =============================================================================

-- Log the migration completion
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔒 RLS ANONYMOUS ACCESS FIXES APPLIED! 🔒';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Added RESTRICTIVE policies to block anonymous access:';
  RAISE NOTICE '• user_profiles: Anonymous access blocked';
  RAISE NOTICE '• artifacts: Anonymous access blocked';
  RAISE NOTICE '• research_sessions: Anonymous access blocked';
  RAISE NOTICE '• research_findings: Anonymous access blocked';
  RAISE NOTICE '• project_artifacts: Anonymous access blocked';
  RAISE NOTICE '• email_campaigns: Anonymous access blocked';
  RAISE NOTICE '• score_history: Anonymous access blocked';
  RAISE NOTICE '• score_batch_logs: Anonymous access blocked';
  RAISE NOTICE '• sync_logs: Anonymous access blocked';
  RAISE NOTICE '• github_repository_languages: Anonymous access blocked';
  RAISE NOTICE '• company_github_repositories: Anonymous access blocked';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Fixed write access controls:';
  RAISE NOTICE '• companies: Anonymous writes blocked, reads allowed';
  RAISE NOTICE '• founders: Anonymous writes blocked, reads allowed';
  RAISE NOTICE '• funding_rounds: Anonymous writes blocked, reads allowed';
  RAISE NOTICE '• company_funding_summary: Anonymous writes blocked, reads allowed';
  RAISE NOTICE '• github_repositories: Anonymous writes blocked, reads allowed';
  RAISE NOTICE '• github_repository_metrics: Anonymous writes blocked, reads allowed';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  Important: Re-run RLS tests to verify fixes!';
  RAISE NOTICE '';
END $$;