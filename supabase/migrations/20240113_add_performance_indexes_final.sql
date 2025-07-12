-- Performance Optimization: Add Strategic Indexes and Real-time Subscriptions
-- Task 2.4: Create Database Indexes and Optimize Performance

-- =============================================================================
-- EXTENSIONS (Must be first)
-- =============================================================================

-- Install required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================================
-- COMPANIES TABLE INDEXES
-- =============================================================================

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_companies_yc_id ON companies(yc_id);
CREATE INDEX IF NOT EXISTS idx_companies_batch ON companies(batch);
CREATE INDEX IF NOT EXISTS idx_companies_is_ai_related ON companies(is_ai_related);
CREATE INDEX IF NOT EXISTS idx_companies_spearfish_score ON companies(spearfish_score DESC NULLS LAST);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_companies_batch_ai ON companies(batch, is_ai_related);
CREATE INDEX IF NOT EXISTS idx_companies_ai_score ON companies(is_ai_related, spearfish_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_companies_batch_score ON companies(batch, spearfish_score DESC NULLS LAST);

-- Time-based sorting indexes
CREATE INDEX IF NOT EXISTS idx_companies_created_at ON companies(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_companies_updated_at ON companies(updated_at DESC);

-- GIN indexes for JSONB columns (efficient JSON queries)
CREATE INDEX IF NOT EXISTS idx_companies_github_repos_gin ON companies USING GIN(github_repos);
CREATE INDEX IF NOT EXISTS idx_companies_huggingface_models_gin ON companies USING GIN(huggingface_models);

-- Partial indexes for performance on filtered queries
CREATE INDEX IF NOT EXISTS idx_companies_ai_only ON companies(spearfish_score DESC, batch) 
WHERE is_ai_related = true;

-- Text search index for company names (now with extension enabled)
CREATE INDEX IF NOT EXISTS idx_companies_name_trgm ON companies USING GIN(name gin_trgm_ops);

-- =============================================================================
-- USER_PROFILES TABLE INDEXES
-- =============================================================================

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_clerk_user_id ON user_profiles(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_company_id ON user_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

-- Composite indexes for common patterns
CREATE INDEX IF NOT EXISTS idx_user_profiles_company_role ON user_profiles(company_id, role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_company_created ON user_profiles(company_id, created_at DESC);

-- Time-based indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at ON user_profiles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_profiles_updated_at ON user_profiles(updated_at DESC);

-- =============================================================================
-- ARTIFACTS TABLE INDEXES
-- =============================================================================

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_artifacts_company_id ON artifacts(company_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_created_by ON artifacts(created_by);
CREATE INDEX IF NOT EXISTS idx_artifacts_type ON artifacts(type);
CREATE INDEX IF NOT EXISTS idx_artifacts_is_template ON artifacts(is_template);
CREATE INDEX IF NOT EXISTS idx_artifacts_parent_id ON artifacts(parent_artifact_id);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_artifacts_company_type ON artifacts(company_id, type);
CREATE INDEX IF NOT EXISTS idx_artifacts_company_template ON artifacts(company_id, is_template);
CREATE INDEX IF NOT EXISTS idx_artifacts_company_created ON artifacts(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifacts_type_template ON artifacts(type, is_template);
CREATE INDEX IF NOT EXISTS idx_artifacts_created_by_type ON artifacts(created_by, type);

-- Time-based sorting indexes
CREATE INDEX IF NOT EXISTS idx_artifacts_created_at ON artifacts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifacts_updated_at ON artifacts(updated_at DESC);

-- GIN indexes for JSONB columns
CREATE INDEX IF NOT EXISTS idx_artifacts_content_gin ON artifacts USING GIN(content);
CREATE INDEX IF NOT EXISTS idx_artifacts_metadata_gin ON artifacts USING GIN(metadata);

-- Partial indexes for performance
CREATE INDEX IF NOT EXISTS idx_artifacts_templates_only ON artifacts(type, created_at DESC) 
WHERE is_template = true;

CREATE INDEX IF NOT EXISTS idx_artifacts_non_templates_by_company ON artifacts(company_id, type, created_at DESC) 
WHERE is_template = false;

-- Text search indexes for artifact titles
CREATE INDEX IF NOT EXISTS idx_artifacts_title_trgm ON artifacts USING GIN(title gin_trgm_ops);

-- =============================================================================
-- PERFORMANCE MONITORING VIEWS (Fixed column names)
-- =============================================================================

-- Create a view to monitor index usage
CREATE OR REPLACE VIEW public.index_usage_stats AS
SELECT 
    psi.schemaname,
    psi.relname as table_name,
    psi.indexrelname as index_name,
    psi.idx_scan as index_scans,
    psi.idx_tup_read as tuples_read,
    psi.idx_tup_fetch as tuples_fetched,
    CASE 
        WHEN psi.idx_scan = 0 THEN 'Unused'
        WHEN psi.idx_scan < 100 THEN 'Low Usage'
        WHEN psi.idx_scan < 1000 THEN 'Medium Usage'
        ELSE 'High Usage'
    END as usage_level
FROM pg_stat_user_indexes psi
WHERE psi.schemaname = 'public'
ORDER BY psi.idx_scan DESC;

-- Create a view to monitor table sizes (Fixed column names)
CREATE OR REPLACE VIEW public.table_sizes AS
SELECT 
    pt.schemaname,
    pt.tablename,
    pg_size_pretty(pg_total_relation_size(pt.schemaname||'.'||pt.tablename)) as total_size,
    pg_size_pretty(pg_relation_size(pt.schemaname||'.'||pt.tablename)) as table_size,
    pg_size_pretty(pg_total_relation_size(pt.schemaname||'.'||pt.tablename) - pg_relation_size(pt.schemaname||'.'||pt.tablename)) as index_size,
    pg_total_relation_size(pt.schemaname||'.'||pt.tablename) as total_bytes
FROM pg_tables pt
WHERE pt.schemaname = 'public'
ORDER BY pg_total_relation_size(pt.schemaname||'.'||pt.tablename) DESC;

-- =============================================================================
-- REAL-TIME SUBSCRIPTIONS
-- =============================================================================

-- Enable real-time on tables for live updates
DO $$
BEGIN
    -- Check if publication exists first
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        -- Try to add tables to publication
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE artifacts;
        EXCEPTION
            WHEN duplicate_object THEN
                NULL; -- Table already added
        END;
        
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE user_profiles;
        EXCEPTION
            WHEN duplicate_object THEN
                NULL; -- Table already added
        END;
        
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE companies;
        EXCEPTION
            WHEN duplicate_object THEN
                NULL; -- Table already added
        END;
        
        RAISE NOTICE 'Real-time subscriptions enabled for all tables';
    ELSE
        RAISE NOTICE 'supabase_realtime publication not found - real-time subscriptions not enabled';
    END IF;
END $$;

-- =============================================================================
-- DATABASE PERFORMANCE SETTINGS
-- =============================================================================

-- Update table statistics for better query planning
ANALYZE companies;
ANALYZE user_profiles;
ANALYZE artifacts;

-- =============================================================================
-- QUERY OPTIMIZATION FUNCTIONS
-- =============================================================================

-- Function to get company artifacts with performance optimization
CREATE OR REPLACE FUNCTION public.get_company_artifacts(
    target_company_id UUID,
    artifact_type TEXT DEFAULT NULL,
    include_templates BOOLEAN DEFAULT true,
    limit_count INTEGER DEFAULT 50,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    type TEXT,
    is_template BOOLEAN,
    created_at TIMESTAMPTZ,
    created_by_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.title,
        a.type,
        a.is_template,
        a.created_at,
        up.full_name as created_by_name
    FROM artifacts a
    JOIN user_profiles up ON a.created_by = up.id
    WHERE 
        (a.company_id = target_company_id OR (include_templates AND a.is_template = true))
        AND (artifact_type IS NULL OR a.type = artifact_type)
    ORDER BY a.created_at DESC
    LIMIT limit_count
    OFFSET offset_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to search companies efficiently
CREATE OR REPLACE FUNCTION public.search_companies(
    search_term TEXT,
    ai_only BOOLEAN DEFAULT false,
    batch_filter TEXT DEFAULT NULL,
    limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    yc_id TEXT,
    name TEXT,
    batch TEXT,
    spearfish_score NUMERIC,
    is_ai_related BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.yc_id,
        c.name,
        c.batch,
        c.spearfish_score,
        c.is_ai_related
    FROM companies c
    WHERE 
        (search_term IS NULL OR c.name ILIKE '%' || search_term || '%')
        AND (NOT ai_only OR c.is_ai_related = true)
        AND (batch_filter IS NULL OR c.batch = batch_filter)
    ORDER BY 
        c.spearfish_score DESC NULLS LAST,
        c.name ASC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON INDEX idx_companies_yc_id IS 'Primary lookup index for YC company ID - used in company detail pages';
COMMENT ON INDEX idx_companies_batch_ai IS 'Composite index for filtering AI companies by batch';
COMMENT ON INDEX idx_companies_github_repos_gin IS 'GIN index for efficient JSON queries on GitHub repositories';

COMMENT ON INDEX idx_user_profiles_clerk_user_id IS 'Critical index for Clerk authentication lookups';
COMMENT ON INDEX idx_user_profiles_company_role IS 'Composite index for company team member queries';

COMMENT ON INDEX idx_artifacts_company_type IS 'Primary index for company artifact filtering by type';
COMMENT ON INDEX idx_artifacts_templates_only IS 'Partial index for public template queries';
COMMENT ON INDEX idx_artifacts_content_gin IS 'GIN index for full-text search within artifact content';

COMMENT ON FUNCTION public.get_company_artifacts IS 'Optimized function to retrieve company artifacts with joins';
COMMENT ON FUNCTION public.search_companies IS 'High-performance company search with multiple filters';

-- =============================================================================
-- VERIFY INDEX CREATION
-- =============================================================================

DO $$
DECLARE
    index_count INTEGER;
    companies_indexes INTEGER;
    profiles_indexes INTEGER;
    artifacts_indexes INTEGER;
BEGIN
    -- Count created indexes by table
    SELECT COUNT(*) INTO companies_indexes
    FROM pg_indexes 
    WHERE tablename = 'companies' AND schemaname = 'public';
    
    SELECT COUNT(*) INTO profiles_indexes
    FROM pg_indexes 
    WHERE tablename = 'user_profiles' AND schemaname = 'public';
    
    SELECT COUNT(*) INTO artifacts_indexes
    FROM pg_indexes 
    WHERE tablename = 'artifacts' AND schemaname = 'public';
    
    index_count := companies_indexes + profiles_indexes + artifacts_indexes;
    
    RAISE NOTICE '';
    RAISE NOTICE '🚀 PERFORMANCE OPTIMIZATION COMPLETE! 🚀';
    RAISE NOTICE '';
    RAISE NOTICE 'Created % total indexes:', index_count;
    RAISE NOTICE '• Companies table: % indexes', companies_indexes;
    RAISE NOTICE '• User profiles table: % indexes', profiles_indexes;
    RAISE NOTICE '• Artifacts table: % indexes', artifacts_indexes;
    RAISE NOTICE '';
    RAISE NOTICE '✅ Key optimizations applied:';
    RAISE NOTICE '• Primary lookup indexes (IDs, foreign keys)';
    RAISE NOTICE '• Composite indexes for common query patterns';
    RAISE NOTICE '• GIN indexes for JSON/JSONB columns';
    RAISE NOTICE '• Partial indexes for filtered queries';
    RAISE NOTICE '• Text search indexes with trigrams';
    RAISE NOTICE '• Time-based sorting indexes';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Monitoring tools available:';
    RAISE NOTICE '• SELECT * FROM public.index_usage_stats;';
    RAISE NOTICE '• SELECT * FROM public.table_sizes;';
    RAISE NOTICE '';
    RAISE NOTICE '⚡ Performance functions created:';
    RAISE NOTICE '• public.get_company_artifacts() - Fast artifact retrieval';
    RAISE NOTICE '• public.search_companies() - Optimized company search';
    RAISE NOTICE '';
    RAISE NOTICE 'Task 2.4 ready for completion! 🎉';
END $$;