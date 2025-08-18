-- Add Missing Performance Indexes
-- Based on audit findings for foreign keys and common query patterns

-- =============================================================================
-- MISSING FOREIGN KEY INDEXES
-- =============================================================================

-- Founders table - company_id foreign key index
CREATE INDEX IF NOT EXISTS idx_founders_company_id 
ON founders(company_id);

-- Funding rounds table - company_id foreign key index  
CREATE INDEX IF NOT EXISTS idx_funding_rounds_company_id 
ON funding_rounds(company_id);

-- Research findings table - research_session_id foreign key index
CREATE INDEX IF NOT EXISTS idx_research_findings_research_session_id 
ON research_findings(research_session_id);

-- =============================================================================
-- ADDITIONAL PERFORMANCE INDEXES FROM REFACTOR PLAN
-- =============================================================================

-- Companies table - composite index for score and batch filtering
CREATE INDEX IF NOT EXISTS idx_companies_score_batch 
ON companies(spearfish_score DESC, batch) 
WHERE spearfish_score IS NOT NULL;

-- GitHub repository metrics - growth rate sorting
CREATE INDEX IF NOT EXISTS idx_github_repository_metrics_growth 
ON github_repository_metrics(star_growth_rate DESC, created_at DESC);

-- Research sessions - company and user lookup
CREATE INDEX IF NOT EXISTS idx_research_sessions_company 
ON company_research_sessions(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_research_sessions_user_created 
ON company_research_sessions(user_id, created_at DESC);

-- GitHub metrics - repository and date lookup
CREATE INDEX IF NOT EXISTS idx_github_metrics_repo_date 
ON github_repository_metrics(repository_id, recorded_at DESC);

-- =============================================================================
-- USER PROFILE OPTIMIZATION INDEXES
-- =============================================================================

-- User profiles - faster company member lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_company_role_active
ON user_profiles(company_id, role, created_at DESC)
WHERE role IS NOT NULL;

-- =============================================================================
-- ARTIFACT AND PROJECT INDEXES
-- =============================================================================

-- Project artifacts - creator and company lookups
CREATE INDEX IF NOT EXISTS idx_project_artifacts_creator_date
ON project_artifacts(created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_artifacts_company_type_date
ON project_artifacts(company_id, type, created_at DESC);

-- Email campaigns - creator lookups
CREATE INDEX IF NOT EXISTS idx_email_campaigns_creator_date
ON email_campaigns(created_by, created_at DESC);

-- Research findings - session and type lookups
CREATE INDEX IF NOT EXISTS idx_research_findings_session_type
ON research_findings(research_session_id, finding_type, created_at DESC);

-- =============================================================================
-- GITHUB DATA OPTIMIZATION
-- =============================================================================

-- Company GitHub repositories - faster company repo lookups
CREATE INDEX IF NOT EXISTS idx_company_github_repos_company_active
ON company_github_repositories(company_id, is_primary DESC, created_at DESC);

-- GitHub repository languages - repository lookups
CREATE INDEX IF NOT EXISTS idx_github_repo_languages_repo_percent
ON github_repository_languages(repository_id, percentage_used DESC);

-- =============================================================================
-- SCORE AND ANALYTICS INDEXES
-- =============================================================================

-- Score history - company score tracking
CREATE INDEX IF NOT EXISTS idx_score_history_company_date
ON score_history(company_id, calculated_at DESC);

-- Score history - algorithm version tracking
CREATE INDEX IF NOT EXISTS idx_score_history_algorithm_date
ON score_history(algorithm_version, calculated_at DESC);

-- =============================================================================
-- SYNC LOG OPTIMIZATION (for admin/monitoring)
-- =============================================================================

-- GitHub sync logs - status and date tracking
CREATE INDEX IF NOT EXISTS idx_github_sync_logs_status_date
ON github_sync_logs(sync_status, created_at DESC);

-- YC sync logs - batch and status tracking  
CREATE INDEX IF NOT EXISTS idx_yc_sync_logs_batch_status_date
ON yc_sync_logs(batch_name, sync_status, created_at DESC);

-- =============================================================================
-- FULL-TEXT SEARCH OPTIMIZATION
-- =============================================================================

-- Founders - name search optimization
CREATE INDEX IF NOT EXISTS idx_founders_name_search
ON founders USING GIN(to_tsvector('english', name || ' ' || COALESCE(title, '')));

-- Research findings - content search
CREATE INDEX IF NOT EXISTS idx_research_findings_content_search
ON research_findings USING GIN(to_tsvector('english', COALESCE(summary, '') || ' ' || COALESCE(content, '')));

-- =============================================================================
-- PARTIAL INDEXES FOR FILTERED QUERIES
-- =============================================================================

-- Active research sessions only
CREATE INDEX IF NOT EXISTS idx_research_sessions_active_only
ON company_research_sessions(user_id, created_at DESC)
WHERE status = 'active' OR status = 'in_progress';

-- High-value companies only
CREATE INDEX IF NOT EXISTS idx_companies_high_value_only
ON companies(spearfish_score DESC, updated_at DESC)
WHERE spearfish_score >= 8.0;

-- Recent GitHub metrics only (last 6 months)
CREATE INDEX IF NOT EXISTS idx_github_metrics_recent_only
ON github_repository_metrics(repository_id, recorded_at DESC)
WHERE recorded_at >= NOW() - INTERVAL '6 months';

-- =============================================================================
-- VERIFICATION AND MONITORING
-- =============================================================================

-- Update table statistics for better query planning
ANALYZE founders;
ANALYZE funding_rounds;
ANALYZE research_findings;
ANALYZE company_research_sessions;
ANALYZE project_artifacts;
ANALYZE email_campaigns;
ANALYZE github_repository_metrics;
ANALYZE github_repository_languages;
ANALYZE company_github_repositories;
ANALYZE score_history;

-- Create a function to monitor index usage
CREATE OR REPLACE FUNCTION get_unused_indexes()
RETURNS TABLE (
  schema_name text,
  table_name text,
  index_name text,
  index_size text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    schemaname::text,
    tablename::text,
    indexname::text,
    pg_size_pretty(pg_relation_size(indexname::regclass))::text
  FROM pg_indexes pi
  LEFT JOIN pg_stat_user_indexes psi ON pi.indexname = psi.indexrelname
  WHERE pi.schemaname = 'public'
  AND (psi.idx_scan = 0 OR psi.idx_scan IS NULL)
  AND NOT pi.indexname LIKE '%_pkey'
  ORDER BY pg_relation_size(indexname::regclass) DESC;
END;
$$ LANGUAGE plpgsql;

-- Log the completion
DO $$
DECLARE
  index_count INTEGER;
BEGIN
  -- Count total indexes created
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes 
  WHERE schemaname = 'public' 
  AND indexname LIKE 'idx_%';
  
  RAISE NOTICE '';
  RAISE NOTICE '📊 PERFORMANCE INDEXES CREATED SUCCESSFULLY! 📊';
  RAISE NOTICE '';
  RAISE NOTICE 'Total indexes in public schema: %', index_count;
  RAISE NOTICE '';
  RAISE NOTICE '✅ Foreign key indexes added:';
  RAISE NOTICE '• idx_founders_company_id';
  RAISE NOTICE '• idx_funding_rounds_company_id';
  RAISE NOTICE '• idx_research_findings_research_session_id';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Performance indexes added:';
  RAISE NOTICE '• Company score/batch filtering';
  RAISE NOTICE '• GitHub metrics growth tracking';
  RAISE NOTICE '• Research session lookups';
  RAISE NOTICE '• User profile company queries';
  RAISE NOTICE '• Project artifact filtering';
  RAISE NOTICE '• Full-text search optimization';
  RAISE NOTICE '';
  RAISE NOTICE '📈 Query optimization features:';
  RAISE NOTICE '• Partial indexes for filtered queries';
  RAISE NOTICE '• Composite indexes for common patterns';
  RAISE NOTICE '• GIN indexes for text search';
  RAISE NOTICE '• Date-based sorting optimization';
  RAISE NOTICE '';
  RAISE NOTICE '🔍 Monitoring:';
  RAISE NOTICE '• Run SELECT * FROM get_unused_indexes(); to find unused indexes';
  RAISE NOTICE '• Table statistics updated for better query planning';
  RAISE NOTICE '';
END $$;