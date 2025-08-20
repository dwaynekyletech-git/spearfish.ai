-- Enhance YC AI Sync Tracking
-- Adds missing fields and indexes needed for the YC AI Sync Orchestrator

-- =============================================================================
-- Add missing enrichment tracking fields to companies table
-- =============================================================================

-- Add enrichment completion tracking
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS enrichment_complete BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS enrichment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS company_linkedin TEXT,
ADD COLUMN IF NOT EXISTS company_x TEXT; -- Twitter/X URL

-- Add indexes for enrichment queries
CREATE INDEX IF NOT EXISTS idx_companies_enrichment_complete ON companies(enrichment_complete);
CREATE INDEX IF NOT EXISTS idx_companies_enrichment_date ON companies(enrichment_date DESC);
CREATE INDEX IF NOT EXISTS idx_companies_ai_enrichment ON companies(is_ai_related, enrichment_complete);

-- =============================================================================
-- Create enrichment queue table for batch processing
-- =============================================================================

CREATE TABLE IF NOT EXISTS enrichment_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    yc_url TEXT NOT NULL,
    priority INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
    attempts INTEGER DEFAULT 0,
    last_attempt TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    estimated_cost DECIMAL(5,3) DEFAULT 0.015, -- Default Apify cost per company
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for enrichment queue
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_status ON enrichment_queue(status);
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_priority ON enrichment_queue(priority DESC);
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_company_id ON enrichment_queue(company_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_created_at ON enrichment_queue(created_at DESC);

-- Add unique constraint to prevent duplicate queue entries
ALTER TABLE enrichment_queue ADD CONSTRAINT unique_company_in_queue UNIQUE (company_id);

-- =============================================================================
-- Add missing constraints and updates
-- =============================================================================

-- Update check constraint for enrichment_status to include our new status
ALTER TABLE companies DROP CONSTRAINT IF EXISTS check_enrichment_status;
ALTER TABLE companies ADD CONSTRAINT check_enrichment_status 
CHECK (enrichment_status IN ('pending', 'completed', 'failed', 'in_progress', 'queued'));

-- =============================================================================
-- Create functions for enrichment management
-- =============================================================================

-- Function to queue companies for enrichment
CREATE OR REPLACE FUNCTION queue_companies_for_enrichment(
    p_company_ids UUID[],
    p_priority INTEGER DEFAULT 0
)
RETURNS INTEGER AS $$
DECLARE
    queued_count INTEGER := 0;
    company_id UUID;
BEGIN
    FOREACH company_id IN ARRAY p_company_ids LOOP
        INSERT INTO enrichment_queue (company_id, priority)
        SELECT 
            company_id,
            p_priority
        FROM companies 
        WHERE id = company_id 
          AND enrichment_complete = false
          AND yc_url IS NOT NULL
        ON CONFLICT (company_id) DO UPDATE SET
            priority = GREATEST(enrichment_queue.priority, p_priority),
            status = 'pending',
            updated_at = NOW();
        
        IF FOUND THEN
            queued_count := queued_count + 1;
        END IF;
    END LOOP;
    
    RETURN queued_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get next companies for enrichment
CREATE OR REPLACE FUNCTION get_next_companies_for_enrichment(
    p_limit INTEGER DEFAULT 10,
    p_max_attempts INTEGER DEFAULT 3
)
RETURNS TABLE (
    queue_id UUID,
    company_id UUID,
    company_name TEXT,
    yc_url TEXT,
    priority INTEGER,
    attempts INTEGER
) AS $$
BEGIN
    RETURN QUERY
    UPDATE enrichment_queue 
    SET 
        status = 'processing',
        last_attempt = NOW(),
        updated_at = NOW()
    WHERE id IN (
        SELECT eq.id 
        FROM enrichment_queue eq
        JOIN companies c ON c.id = eq.company_id
        WHERE eq.status = 'pending'
          AND eq.attempts < p_max_attempts
          AND c.yc_url IS NOT NULL
        ORDER BY eq.priority DESC, eq.created_at ASC
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    )
    RETURNING 
        enrichment_queue.id as queue_id,
        enrichment_queue.company_id,
        (SELECT name FROM companies WHERE id = enrichment_queue.company_id) as company_name,
        enrichment_queue.yc_url,
        enrichment_queue.priority,
        enrichment_queue.attempts;
END;
$$ LANGUAGE plpgsql;

-- Function to mark enrichment as completed
CREATE OR REPLACE FUNCTION mark_enrichment_completed(
    p_queue_id UUID,
    p_company_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Update the queue entry
    UPDATE enrichment_queue 
    SET 
        status = 'completed',
        updated_at = NOW()
    WHERE id = p_queue_id;
    
    -- Update the company
    UPDATE companies 
    SET 
        enrichment_complete = true,
        enrichment_date = NOW(),
        enrichment_status = 'completed',
        updated_at = NOW()
    WHERE id = p_company_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to mark enrichment as failed
CREATE OR REPLACE FUNCTION mark_enrichment_failed(
    p_queue_id UUID,
    p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE enrichment_queue 
    SET 
        status = 'failed',
        attempts = attempts + 1,
        error_message = p_error_message,
        updated_at = NOW()
    WHERE id = p_queue_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Create view for enriched AI companies
-- =============================================================================

CREATE OR REPLACE VIEW enriched_ai_companies AS
SELECT 
    c.*,
    -- Founder count
    (SELECT COUNT(*) FROM founders f WHERE f.company_id = c.id) as founder_count,
    -- Job count  
    (SELECT COUNT(*) FROM company_jobs cj WHERE cj.company_id = c.id AND cj.is_active = true) as active_job_count,
    -- Latest founder info
    (SELECT json_agg(json_build_object(
        'name', f.name,
        'title', f.title,
        'linkedin_url', f.linkedin_url,
        'twitter_url', f.twitter_url
    )) FROM founders f WHERE f.company_id = c.id) as founders_summary,
    -- Latest job info
    (SELECT json_agg(json_build_object(
        'title', cj.title,
        'location', cj.location,
        'remote_ok', cj.remote_ok,
        'salary', cj.salary
    )) FROM company_jobs cj WHERE cj.company_id = c.id AND cj.is_active = true LIMIT 5) as jobs_summary
FROM companies c
WHERE c.is_ai_related = true 
  AND c.enrichment_complete = true
ORDER BY c.spearfish_score DESC NULLS LAST, c.updated_at DESC;

-- =============================================================================
-- Update comments and documentation
-- =============================================================================

COMMENT ON COLUMN companies.enrichment_complete IS 'Whether company has been fully enriched with Apify data';
COMMENT ON COLUMN companies.enrichment_date IS 'When company enrichment was completed';
COMMENT ON COLUMN companies.company_linkedin IS 'Company LinkedIn profile URL from Apify';
COMMENT ON COLUMN companies.company_x IS 'Company Twitter/X profile URL from Apify';

COMMENT ON TABLE enrichment_queue IS 'Queue for tracking companies pending Apify enrichment';
COMMENT ON FUNCTION queue_companies_for_enrichment IS 'Add companies to enrichment queue with priority';
COMMENT ON FUNCTION get_next_companies_for_enrichment IS 'Get next batch of companies for processing';
COMMENT ON FUNCTION mark_enrichment_completed IS 'Mark company enrichment as completed';
COMMENT ON FUNCTION mark_enrichment_failed IS 'Mark company enrichment as failed with error';

COMMENT ON VIEW enriched_ai_companies IS 'View of AI companies with complete enrichment data including founders and jobs';

-- =============================================================================
-- Create trigger to auto-update enrichment_complete
-- =============================================================================

CREATE OR REPLACE FUNCTION update_enrichment_complete()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-set enrichment_complete when enrichment_status is 'completed'
    IF NEW.enrichment_status = 'completed' AND OLD.enrichment_status != 'completed' THEN
        NEW.enrichment_complete = true;
        NEW.enrichment_date = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_enrichment_complete ON companies;
CREATE TRIGGER trigger_update_enrichment_complete
    BEFORE UPDATE ON companies
    FOR EACH ROW
    EXECUTE FUNCTION update_enrichment_complete();

-- =============================================================================
-- Verification and success message
-- =============================================================================

DO $$
DECLARE
    table_count INTEGER;
    function_count INTEGER;
    index_count INTEGER;
BEGIN
    -- Count new schema objects
    SELECT COUNT(*) INTO table_count FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'enrichment_queue';
    
    SELECT COUNT(*) INTO function_count FROM information_schema.routines 
    WHERE routine_schema = 'public' AND routine_name LIKE '%enrichment%';
    
    SELECT COUNT(*) INTO index_count FROM pg_indexes 
    WHERE schemaname = 'public' AND indexname LIKE '%enrichment%';
    
    RAISE NOTICE '';
    RAISE NOTICE '🎯 YC AI SYNC TRACKING ENHANCEMENT COMPLETE! 🎯';
    RAISE NOTICE '';
    RAISE NOTICE 'Enhanced schema objects:';
    RAISE NOTICE '• New tables: % (enrichment_queue)', table_count;
    RAISE NOTICE '• New functions: % (enrichment management)', function_count;
    RAISE NOTICE '• New indexes: % (optimized for AI sync)', index_count;
    RAISE NOTICE '';
    RAISE NOTICE '✅ Key capabilities added:';
    RAISE NOTICE '• Enrichment completion tracking';
    RAISE NOTICE '• Company enrichment queue management';
    RAISE NOTICE '• Batch processing functions';
    RAISE NOTICE '• Performance-optimized indexes';
    RAISE NOTICE '• Enriched AI companies view';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Ready for YC AI sync orchestrator!';
    RAISE NOTICE 'Database enhancements complete.';
END $$;