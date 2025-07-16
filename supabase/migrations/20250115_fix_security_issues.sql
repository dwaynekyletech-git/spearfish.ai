-- Fix Security Issues Migration
-- This migration addresses RLS disabled errors and SECURITY DEFINER view warnings

-- =============================================================================
-- 1. Enable RLS on GitHub Tables
-- =============================================================================

-- Enable RLS on GitHub repositories table
ALTER TABLE public.github_repositories ENABLE ROW LEVEL SECURITY;

-- Enable RLS on GitHub repository metrics table  
ALTER TABLE public.github_repository_metrics ENABLE ROW LEVEL SECURITY;

-- Enable RLS on GitHub repository languages table
ALTER TABLE public.github_repository_languages ENABLE ROW LEVEL SECURITY;

-- Enable RLS on company GitHub repositories association table
ALTER TABLE public.company_github_repositories ENABLE ROW LEVEL SECURITY;

-- Enable RLS on GitHub sync logs table
ALTER TABLE public.github_sync_logs ENABLE ROW LEVEL SECURITY;

-- Enable RLS on YC sync logs table
ALTER TABLE public.yc_sync_logs ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 2. Create RLS Policies for GitHub Tables
-- =============================================================================

-- GitHub repositories: Allow read access to all authenticated users
CREATE POLICY "Allow read access to github_repositories" ON public.github_repositories
    FOR SELECT USING (auth.role() = 'authenticated');

-- GitHub repository metrics: Allow read access to all authenticated users
CREATE POLICY "Allow read access to github_repository_metrics" ON public.github_repository_metrics
    FOR SELECT USING (auth.role() = 'authenticated');

-- GitHub repository languages: Allow read access to all authenticated users
CREATE POLICY "Allow read access to github_repository_languages" ON public.github_repository_languages
    FOR SELECT USING (auth.role() = 'authenticated');

-- Company GitHub repositories: Allow read access to all authenticated users
CREATE POLICY "Allow read access to company_github_repositories" ON public.company_github_repositories
    FOR SELECT USING (auth.role() = 'authenticated');

-- GitHub sync logs: Allow read access to all authenticated users (for debugging)
CREATE POLICY "Allow read access to github_sync_logs" ON public.github_sync_logs
    FOR SELECT USING (auth.role() = 'authenticated');

-- YC sync logs: Allow read access to all authenticated users (for debugging)
CREATE POLICY "Allow read access to yc_sync_logs" ON public.yc_sync_logs
    FOR SELECT USING (auth.role() = 'authenticated');

-- =============================================================================
-- 3. Fix SECURITY DEFINER Views
-- =============================================================================

-- Drop and recreate views without SECURITY DEFINER

-- Fix index_usage_stats view
DROP VIEW IF EXISTS public.index_usage_stats;
CREATE VIEW public.index_usage_stats AS
SELECT 
    schemaname,
    relname as tablename,
    indexrelname as indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Fix score_leaderboard view
DROP VIEW IF EXISTS public.score_leaderboard;
CREATE VIEW public.score_leaderboard AS
SELECT 
    c.id,
    c.name,
    c.spearfish_score,
    c.batch,
    c.regions,
    c.website_url,
    c.small_logo_thumb_url,
    ROW_NUMBER() OVER (ORDER BY c.spearfish_score DESC) as rank
FROM companies c
WHERE c.spearfish_score IS NOT NULL
ORDER BY c.spearfish_score DESC;

-- Fix table_sizes view
DROP VIEW IF EXISTS public.table_sizes;
CREATE VIEW public.table_sizes AS
SELECT 
    n.nspname as schemaname,
    c.relname as tablename,
    pg_size_pretty(pg_total_relation_size(c.oid)) as size,
    pg_total_relation_size(c.oid) as size_bytes
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
    AND c.relkind = 'r'
ORDER BY pg_total_relation_size(c.oid) DESC;

-- Fix companies_with_latest_scores view
DROP VIEW IF EXISTS public.companies_with_latest_scores;
CREATE VIEW public.companies_with_latest_scores AS
WITH latest_scores AS (
    SELECT 
        company_id,
        spearfish_score,
        score_breakdown,
        calculated_at,
        ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY calculated_at DESC) as rn
    FROM score_history
)
SELECT 
    c.id,
    c.name,
    c.one_liner,
    c.batch,
    c.regions,
    c.website_url,
    c.small_logo_thumb_url,
    c.team_size,
    c.launched_at,
    c.status,
    c.industry,
    c.is_hiring,
    COALESCE(ls.spearfish_score, c.spearfish_score) as spearfish_score,
    ls.score_breakdown,
    ls.calculated_at as last_score_update,
    c.created_at,
    c.updated_at
FROM companies c
LEFT JOIN latest_scores ls ON c.id = ls.company_id AND ls.rn = 1;

-- =============================================================================
-- 4. Grant Appropriate Permissions
-- =============================================================================

-- Grant SELECT permissions to authenticated users for the new views
GRANT SELECT ON public.index_usage_stats TO authenticated;
GRANT SELECT ON public.score_leaderboard TO authenticated;
GRANT SELECT ON public.table_sizes TO authenticated;
GRANT SELECT ON public.companies_with_latest_scores TO authenticated;

-- =============================================================================
-- 5. Add Comments for Documentation
-- =============================================================================

COMMENT ON POLICY "Allow read access to github_repositories" ON public.github_repositories IS 
'Allows authenticated users to read GitHub repository data';

COMMENT ON POLICY "Allow read access to github_repository_metrics" ON public.github_repository_metrics IS 
'Allows authenticated users to read GitHub repository metrics';

COMMENT ON POLICY "Allow read access to github_repository_languages" ON public.github_repository_languages IS 
'Allows authenticated users to read GitHub repository language data';

COMMENT ON POLICY "Allow read access to company_github_repositories" ON public.company_github_repositories IS 
'Allows authenticated users to read company-repository associations';

COMMENT ON POLICY "Allow read access to github_sync_logs" ON public.github_sync_logs IS 
'Allows authenticated users to read GitHub sync logs for debugging';

COMMENT ON POLICY "Allow read access to yc_sync_logs" ON public.yc_sync_logs IS 
'Allows authenticated users to read YC sync logs for debugging';

COMMENT ON VIEW public.index_usage_stats IS 
'Database index usage statistics view (security compliant)';

COMMENT ON VIEW public.score_leaderboard IS 
'Company scoring leaderboard view (security compliant)';

COMMENT ON VIEW public.table_sizes IS 
'Database table size statistics view (security compliant)';

COMMENT ON VIEW public.companies_with_latest_scores IS 
'Companies with their latest scoring data view (security compliant)';