-- Enhance Companies Table for Y Combinator API Data Integration
-- Task 3.4: Build Supabase database schema and data storage layer

-- =============================================================================
-- ENHANCE COMPANIES TABLE SCHEMA
-- =============================================================================

-- Add missing columns for comprehensive YC data storage
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS slug TEXT,
ADD COLUMN IF NOT EXISTS one_liner TEXT,
ADD COLUMN IF NOT EXISTS long_description TEXT,
ADD COLUMN IF NOT EXISTS industry TEXT,
ADD COLUMN IF NOT EXISTS subindustry TEXT,
ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS regions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Acquired', 'Public', 'Inactive')),
ADD COLUMN IF NOT EXISTS launched_at BIGINT,
ADD COLUMN IF NOT EXISTS small_logo_thumb_url TEXT,
ADD COLUMN IF NOT EXISTS is_hiring BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS yc_api_id INTEGER UNIQUE,
ADD COLUMN IF NOT EXISTS ai_confidence_score NUMERIC(3, 2) CHECK (ai_confidence_score >= 0 AND ai_confidence_score <= 1),
ADD COLUMN IF NOT EXISTS ai_classification_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_sync_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'error', 'manual'));

-- Update existing columns if needed
ALTER TABLE companies 
ALTER COLUMN yc_id DROP NOT NULL;  -- YC ID might not be available for all companies

-- Add constraints for new fields
ALTER TABLE companies 
ADD CONSTRAINT chk_launched_at_positive CHECK (launched_at IS NULL OR launched_at > 0),
ADD CONSTRAINT chk_yc_api_id_positive CHECK (yc_api_id IS NULL OR yc_api_id > 0);

-- =============================================================================
-- CREATE INDEXES FOR YC DATA QUERIES
-- =============================================================================

-- Indexes for YC API specific fields
CREATE INDEX IF NOT EXISTS idx_companies_yc_api_id ON companies(yc_api_id);
CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);
CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry);
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);
CREATE INDEX IF NOT EXISTS idx_companies_launched_at ON companies(launched_at);
CREATE INDEX IF NOT EXISTS idx_companies_is_hiring ON companies(is_hiring);
CREATE INDEX IF NOT EXISTS idx_companies_sync_status ON companies(sync_status);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_companies_batch_industry ON companies(batch, industry);
CREATE INDEX IF NOT EXISTS idx_companies_status_batch ON companies(status, batch);
CREATE INDEX IF NOT EXISTS idx_companies_ai_confidence ON companies(is_ai_related, ai_confidence_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_companies_sync_date ON companies(last_sync_date DESC);

-- GIN indexes for JSONB array columns
CREATE INDEX IF NOT EXISTS idx_companies_tags_gin ON companies USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_companies_regions_gin ON companies USING GIN(regions);

-- Text search indexes for company search
CREATE INDEX IF NOT EXISTS idx_companies_name_trgm ON companies USING GIN(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_companies_one_liner_trgm ON companies USING GIN(one_liner gin_trgm_ops);

-- =============================================================================
-- CREATE YC COMPANIES DATA ACCESS FUNCTIONS
-- =============================================================================

-- Function to upsert company data from YC API
CREATE OR REPLACE FUNCTION upsert_yc_company(
    p_yc_api_id INTEGER,
    p_name TEXT,
    p_slug TEXT DEFAULT NULL,
    p_website_url TEXT DEFAULT NULL,
    p_one_liner TEXT DEFAULT NULL,
    p_long_description TEXT DEFAULT NULL,
    p_batch TEXT DEFAULT NULL,
    p_status TEXT DEFAULT 'Active',
    p_industry TEXT DEFAULT NULL,
    p_subindustry TEXT DEFAULT NULL,
    p_tags JSONB DEFAULT '[]'::jsonb,
    p_regions JSONB DEFAULT '[]'::jsonb,
    p_team_size INTEGER DEFAULT NULL,
    p_launched_at BIGINT DEFAULT NULL,
    p_small_logo_thumb_url TEXT DEFAULT NULL,
    p_is_hiring BOOLEAN DEFAULT false,
    p_is_ai_related BOOLEAN DEFAULT false,
    p_ai_confidence_score NUMERIC(3, 2) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    company_id UUID;
    existing_id UUID;
BEGIN
    -- Check if company already exists
    SELECT id INTO existing_id 
    FROM companies 
    WHERE yc_api_id = p_yc_api_id 
       OR (p_slug IS NOT NULL AND slug = p_slug)
       OR name = p_name;

    IF existing_id IS NOT NULL THEN
        -- Update existing company
        UPDATE companies SET
            yc_api_id = COALESCE(p_yc_api_id, yc_api_id),
            name = COALESCE(p_name, name),
            slug = COALESCE(p_slug, slug),
            website_url = COALESCE(p_website_url, website_url),
            one_liner = COALESCE(p_one_liner, one_liner),
            long_description = COALESCE(p_long_description, long_description),
            batch = COALESCE(p_batch, batch),
            status = COALESCE(p_status, status),
            industry = COALESCE(p_industry, industry),
            subindustry = COALESCE(p_subindustry, subindustry),
            tags = COALESCE(p_tags, tags),
            regions = COALESCE(p_regions, regions),
            team_size = COALESCE(p_team_size, team_size),
            launched_at = COALESCE(p_launched_at, launched_at),
            small_logo_thumb_url = COALESCE(p_small_logo_thumb_url, small_logo_thumb_url),
            is_hiring = COALESCE(p_is_hiring, is_hiring),
            is_ai_related = COALESCE(p_is_ai_related, is_ai_related),
            ai_confidence_score = COALESCE(p_ai_confidence_score, ai_confidence_score),
            ai_classification_date = CASE 
                WHEN p_is_ai_related IS NOT NULL THEN NOW() 
                ELSE ai_classification_date 
            END,
            last_sync_date = NOW(),
            sync_status = 'synced',
            updated_at = NOW()
        WHERE id = existing_id;
        
        company_id := existing_id;
    ELSE
        -- Insert new company
        INSERT INTO companies (
            yc_api_id, name, slug, website_url, one_liner, long_description,
            batch, status, industry, subindustry, tags, regions, team_size,
            launched_at, small_logo_thumb_url, is_hiring, is_ai_related,
            ai_confidence_score, ai_classification_date, last_sync_date, sync_status
        ) VALUES (
            p_yc_api_id, p_name, p_slug, p_website_url, p_one_liner, p_long_description,
            p_batch, p_status, p_industry, p_subindustry, p_tags, p_regions, p_team_size,
            p_launched_at, p_small_logo_thumb_url, p_is_hiring, p_is_ai_related,
            p_ai_confidence_score, 
            CASE WHEN p_is_ai_related IS NOT NULL THEN NOW() ELSE NULL END,
            NOW(), 'synced'
        ) RETURNING id INTO company_id;
    END IF;

    RETURN company_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get companies by batch
CREATE OR REPLACE FUNCTION get_companies_by_batch(
    p_batches TEXT[] DEFAULT NULL,
    p_ai_only BOOLEAN DEFAULT false,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    yc_api_id INTEGER,
    name TEXT,
    slug TEXT,
    batch TEXT,
    industry TEXT,
    one_liner TEXT,
    is_ai_related BOOLEAN,
    ai_confidence_score NUMERIC,
    spearfish_score NUMERIC,
    team_size INTEGER,
    status TEXT,
    tags JSONB,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id, c.yc_api_id, c.name, c.slug, c.batch, c.industry, c.one_liner,
        c.is_ai_related, c.ai_confidence_score, c.spearfish_score, c.team_size,
        c.status, c.tags, c.created_at
    FROM companies c
    WHERE 
        (p_batches IS NULL OR c.batch = ANY(p_batches))
        AND (NOT p_ai_only OR c.is_ai_related = true)
        AND c.sync_status = 'synced'
    ORDER BY 
        c.spearfish_score DESC NULLS LAST,
        c.ai_confidence_score DESC NULLS LAST,
        c.name ASC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Drop any existing conflicting functions first
DROP FUNCTION IF EXISTS search_companies(TEXT, BOOLEAN, TEXT, INTEGER);
DROP FUNCTION IF EXISTS search_companies(TEXT, TEXT[], TEXT[], BOOLEAN, INTEGER);

-- Function to search companies with enhanced parameters
CREATE OR REPLACE FUNCTION search_yc_companies(
    p_search_term TEXT DEFAULT NULL,
    p_batches TEXT[] DEFAULT NULL,
    p_industries TEXT[] DEFAULT NULL,
    p_ai_only BOOLEAN DEFAULT false,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    yc_api_id INTEGER,
    name TEXT,
    slug TEXT,
    batch TEXT,
    industry TEXT,
    one_liner TEXT,
    is_ai_related BOOLEAN,
    ai_confidence_score NUMERIC,
    spearfish_score NUMERIC,
    similarity_score REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id, c.yc_api_id, c.name, c.slug, c.batch, c.industry, c.one_liner,
        c.is_ai_related, c.ai_confidence_score, c.spearfish_score,
        CASE 
            WHEN p_search_term IS NULL THEN 0.0
            ELSE GREATEST(
                similarity(c.name, p_search_term),
                similarity(COALESCE(c.one_liner, ''), p_search_term),
                similarity(COALESCE(c.long_description, ''), p_search_term)
            )
        END as similarity_score
    FROM companies c
    WHERE 
        c.sync_status = 'synced'
        AND (p_search_term IS NULL OR (
            c.name ILIKE '%' || p_search_term || '%' OR
            c.one_liner ILIKE '%' || p_search_term || '%' OR
            c.long_description ILIKE '%' || p_search_term || '%'
        ))
        AND (p_batches IS NULL OR c.batch = ANY(p_batches))
        AND (p_industries IS NULL OR c.industry = ANY(p_industries))
        AND (NOT p_ai_only OR c.is_ai_related = true)
    ORDER BY 
        similarity_score DESC,
        c.spearfish_score DESC NULLS LAST,
        c.ai_confidence_score DESC NULLS LAST
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to update AI classification
CREATE OR REPLACE FUNCTION update_ai_classification(
    p_company_id UUID,
    p_is_ai_related BOOLEAN,
    p_ai_confidence_score NUMERIC(3, 2) DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE companies 
    SET 
        is_ai_related = p_is_ai_related,
        ai_confidence_score = p_ai_confidence_score,
        ai_classification_date = NOW(),
        updated_at = NOW()
    WHERE id = p_company_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to get sync statistics
CREATE OR REPLACE FUNCTION get_sync_statistics()
RETURNS TABLE (
    total_companies BIGINT,
    synced_companies BIGINT,
    pending_companies BIGINT,
    error_companies BIGINT,
    ai_companies BIGINT,
    last_sync_date TIMESTAMPTZ,
    avg_ai_confidence NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_companies,
        COUNT(*) FILTER (WHERE c.sync_status = 'synced') as synced_companies,
        COUNT(*) FILTER (WHERE c.sync_status = 'pending') as pending_companies,
        COUNT(*) FILTER (WHERE c.sync_status = 'error') as error_companies,
        COUNT(*) FILTER (WHERE c.is_ai_related = true) as ai_companies,
        MAX(c.last_sync_date) as last_sync_date,
        AVG(c.ai_confidence_score) FILTER (WHERE c.ai_confidence_score IS NOT NULL) as avg_ai_confidence
    FROM companies c;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- CREATE YC SYNC LOG TABLE
-- =============================================================================

-- Table to track sync operations and errors
CREATE TABLE IF NOT EXISTS yc_sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental', 'manual')),
    batch_name TEXT,
    companies_processed INTEGER DEFAULT 0,
    companies_updated INTEGER DEFAULT 0,
    companies_created INTEGER DEFAULT 0,
    companies_failed INTEGER DEFAULT 0,
    ai_classifications INTEGER DEFAULT 0,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for sync log queries
CREATE INDEX idx_yc_sync_logs_sync_type ON yc_sync_logs(sync_type);
CREATE INDEX idx_yc_sync_logs_status ON yc_sync_logs(status);
CREATE INDEX idx_yc_sync_logs_start_time ON yc_sync_logs(start_time DESC);
CREATE INDEX idx_yc_sync_logs_batch_name ON yc_sync_logs(batch_name);

-- Function to create sync log entry
CREATE OR REPLACE FUNCTION create_sync_log(
    p_sync_type TEXT,
    p_batch_name TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO yc_sync_logs (sync_type, batch_name, metadata)
    VALUES (p_sync_type, p_batch_name, p_metadata)
    RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update sync log
CREATE OR REPLACE FUNCTION update_sync_log(
    p_log_id UUID,
    p_companies_processed INTEGER DEFAULT NULL,
    p_companies_updated INTEGER DEFAULT NULL,
    p_companies_created INTEGER DEFAULT NULL,
    p_companies_failed INTEGER DEFAULT NULL,
    p_ai_classifications INTEGER DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE yc_sync_logs 
    SET 
        companies_processed = COALESCE(p_companies_processed, companies_processed),
        companies_updated = COALESCE(p_companies_updated, companies_updated),
        companies_created = COALESCE(p_companies_created, companies_created),
        companies_failed = COALESCE(p_companies_failed, companies_failed),
        ai_classifications = COALESCE(p_ai_classifications, ai_classifications),
        status = COALESCE(p_status, status),
        error_message = COALESCE(p_error_message, error_message),
        end_time = CASE WHEN p_status IN ('completed', 'failed', 'cancelled') THEN NOW() ELSE end_time END
    WHERE id = p_log_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- UPDATE COMMENTS AND DOCUMENTATION
-- =============================================================================

COMMENT ON COLUMN companies.yc_api_id IS 'Unique ID from Y Combinator API';
COMMENT ON COLUMN companies.slug IS 'URL-friendly company identifier from YC';
COMMENT ON COLUMN companies.one_liner IS 'Short company description from YC';
COMMENT ON COLUMN companies.long_description IS 'Detailed company description from YC';
COMMENT ON COLUMN companies.industry IS 'Primary industry classification from YC';
COMMENT ON COLUMN companies.subindustry IS 'Secondary industry classification from YC';
COMMENT ON COLUMN companies.tags IS 'Array of company tags from YC API';
COMMENT ON COLUMN companies.regions IS 'Array of geographic regions from YC API';
COMMENT ON COLUMN companies.status IS 'Company status: Active, Acquired, Public, Inactive';
COMMENT ON COLUMN companies.launched_at IS 'Unix timestamp when company was launched';
COMMENT ON COLUMN companies.small_logo_thumb_url IS 'URL to company logo thumbnail from YC';
COMMENT ON COLUMN companies.is_hiring IS 'Whether company is actively hiring';
COMMENT ON COLUMN companies.ai_confidence_score IS 'AI classification confidence (0.0-1.0)';
COMMENT ON COLUMN companies.ai_classification_date IS 'When AI classification was last updated';
COMMENT ON COLUMN companies.last_sync_date IS 'When company data was last synced from YC API';
COMMENT ON COLUMN companies.sync_status IS 'Sync status: pending, synced, error, manual';

COMMENT ON FUNCTION upsert_yc_company IS 'Insert or update company data from YC API';
COMMENT ON FUNCTION get_companies_by_batch IS 'Retrieve companies filtered by batch and AI status';
COMMENT ON FUNCTION search_yc_companies IS 'Full-text search companies with ranking';
COMMENT ON FUNCTION update_ai_classification IS 'Update AI-related flag and confidence score';
COMMENT ON FUNCTION get_sync_statistics IS 'Get overall sync statistics and health metrics';

COMMENT ON TABLE yc_sync_logs IS 'Log table for tracking YC API sync operations and errors';

-- =============================================================================
-- VERIFICATION AND SUCCESS MESSAGE
-- =============================================================================

DO $$
DECLARE
    table_count INTEGER;
    function_count INTEGER;
    index_count INTEGER;
BEGIN
    -- Count enhanced schema objects
    SELECT COUNT(*) INTO table_count FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name IN ('companies', 'yc_sync_logs');
    
    SELECT COUNT(*) INTO function_count FROM information_schema.routines 
    WHERE routine_schema = 'public' AND routine_name LIKE '%company%' OR routine_name LIKE '%sync%';
    
    SELECT COUNT(*) INTO index_count FROM pg_indexes 
    WHERE schemaname = 'public' AND tablename = 'companies' AND indexname LIKE 'idx_companies_%';
    
    RAISE NOTICE '';
    RAISE NOTICE '🚀 YC DATABASE SCHEMA ENHANCEMENT COMPLETE! 🚀';
    RAISE NOTICE '';
    RAISE NOTICE 'Enhanced schema objects created:';
    RAISE NOTICE '• Tables: % (companies enhanced + yc_sync_logs)', table_count;
    RAISE NOTICE '• Functions: % (data access and sync management)', function_count;
    RAISE NOTICE '• Indexes: % (optimized for YC queries)', index_count;
    RAISE NOTICE '';
    RAISE NOTICE '✅ Key capabilities added:';
    RAISE NOTICE '• Complete YC API data storage (name, batch, industry, tags, etc.)';
    RAISE NOTICE '• AI classification tracking with confidence scores';
    RAISE NOTICE '• Sync status monitoring and error handling';
    RAISE NOTICE '• Full-text search with similarity ranking';
    RAISE NOTICE '• Comprehensive data access functions';
    RAISE NOTICE '• Sync operation logging and analytics';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Ready for YC API data integration!';
    RAISE NOTICE 'Task 3.4 schema enhancement complete.';
END $$;