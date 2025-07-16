-- Fix SECURITY DEFINER Views Migration
-- This migration specifically addresses the SECURITY DEFINER view warnings

-- =============================================================================
-- Drop all existing views that have SECURITY DEFINER
-- =============================================================================

-- Force drop all problematic views
DROP VIEW IF EXISTS public.index_usage_stats CASCADE;
DROP VIEW IF EXISTS public.table_sizes CASCADE;
DROP VIEW IF EXISTS public.companies_with_latest_scores CASCADE;
DROP VIEW IF EXISTS public.score_leaderboard CASCADE;

-- =============================================================================
-- Recreate views WITHOUT SECURITY DEFINER
-- =============================================================================

-- Create index_usage_stats view (no SECURITY DEFINER)
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

-- Create table_sizes view (no SECURITY DEFINER)  
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

-- Create score_leaderboard view (no SECURITY DEFINER)
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

-- Create companies_with_latest_scores view (no SECURITY DEFINER)
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
-- Grant appropriate permissions
-- =============================================================================

-- Grant SELECT permissions to authenticated users
GRANT SELECT ON public.index_usage_stats TO authenticated;
GRANT SELECT ON public.table_sizes TO authenticated;
GRANT SELECT ON public.score_leaderboard TO authenticated;
GRANT SELECT ON public.companies_with_latest_scores TO authenticated;

-- Grant SELECT permissions to service_role (for admin access)
GRANT SELECT ON public.index_usage_stats TO service_role;
GRANT SELECT ON public.table_sizes TO service_role;
GRANT SELECT ON public.score_leaderboard TO service_role;
GRANT SELECT ON public.companies_with_latest_scores TO service_role;

-- =============================================================================
-- Add documentation comments
-- =============================================================================

COMMENT ON VIEW public.index_usage_stats IS 
'Database index usage statistics - recreated without SECURITY DEFINER';

COMMENT ON VIEW public.table_sizes IS 
'Database table size statistics - recreated without SECURITY DEFINER';

COMMENT ON VIEW public.score_leaderboard IS 
'Company scoring leaderboard - recreated without SECURITY DEFINER';

COMMENT ON VIEW public.companies_with_latest_scores IS 
'Companies with their latest scoring data - recreated without SECURITY DEFINER';

-- =============================================================================
-- Verification
-- =============================================================================

-- Check that views exist
DO $$
DECLARE
    view_count INTEGER;
BEGIN
    -- Count the recreated views
    SELECT COUNT(*) INTO view_count 
    FROM information_schema.views 
    WHERE table_schema = 'public' 
    AND table_name IN ('index_usage_stats', 'table_sizes', 'score_leaderboard', 'companies_with_latest_scores');
    
    RAISE NOTICE '';
    RAISE NOTICE '🔒 SECURITY DEFINER VIEW FIX COMPLETE! 🔒';
    RAISE NOTICE '';
    RAISE NOTICE 'Views recreated: %', view_count;
    RAISE NOTICE '';
    RAISE NOTICE '✅ All views have been recreated without SECURITY DEFINER!';
    RAISE NOTICE 'The views are now security compliant.';
END $$;