-- Create Spearfish Scoring Tables
-- Task 4: Spearfish Scoring Algorithm Implementation

-- =============================================================================
-- CREATE SCORE HISTORY TABLE
-- =============================================================================

-- Table to track historical spearfish scores for companies
CREATE TABLE IF NOT EXISTS score_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    spearfish_score NUMERIC(3, 2) NOT NULL CHECK (spearfish_score >= 0 AND spearfish_score <= 10),
    normalized_score INTEGER NOT NULL CHECK (normalized_score >= 0 AND normalized_score <= 100),
    score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    algorithm_version TEXT NOT NULL DEFAULT '1.0',
    confidence NUMERIC(3, 2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    calculated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for score history queries
CREATE INDEX IF NOT EXISTS idx_score_history_company_id ON score_history(company_id);
CREATE INDEX IF NOT EXISTS idx_score_history_calculated_at ON score_history(calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_score_history_score ON score_history(spearfish_score DESC);
CREATE INDEX IF NOT EXISTS idx_score_history_algorithm_version ON score_history(algorithm_version);

-- Composite index for company score history queries
CREATE INDEX IF NOT EXISTS idx_score_history_company_calculated ON score_history(company_id, calculated_at DESC);

-- =============================================================================
-- CREATE SCORE BATCH LOGS TABLE
-- =============================================================================

-- Table to track batch scoring operations
CREATE TABLE IF NOT EXISTS score_batch_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL,
    total_processed INTEGER NOT NULL DEFAULT 0,
    successful_updates INTEGER NOT NULL DEFAULT 0,
    failed_updates INTEGER NOT NULL DEFAULT 0,
    processing_time_ms INTEGER NOT NULL DEFAULT 0,
    error_details JSONB DEFAULT '{}'::jsonb,
    triggered_by TEXT DEFAULT 'manual' CHECK (triggered_by IN ('manual', 'scheduled', 'api')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for batch log queries
CREATE INDEX IF NOT EXISTS idx_score_batch_logs_batch_id ON score_batch_logs(batch_id);
CREATE INDEX IF NOT EXISTS idx_score_batch_logs_created_at ON score_batch_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_score_batch_logs_triggered_by ON score_batch_logs(triggered_by);

-- =============================================================================
-- CREATE SCORING FUNCTIONS
-- =============================================================================

-- Function to get the latest score for a company
CREATE OR REPLACE FUNCTION get_company_latest_score(p_company_id UUID)
RETURNS TABLE (
    spearfish_score NUMERIC,
    normalized_score INTEGER,
    confidence NUMERIC,
    calculated_at TIMESTAMPTZ,
    algorithm_version TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sh.spearfish_score,
        sh.normalized_score,
        sh.confidence,
        sh.calculated_at,
        sh.algorithm_version
    FROM score_history sh
    WHERE sh.company_id = p_company_id
    ORDER BY sh.calculated_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get score trend for a company
CREATE OR REPLACE FUNCTION get_company_score_trend(
    p_company_id UUID,
    p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
    calculated_at TIMESTAMPTZ,
    spearfish_score NUMERIC,
    normalized_score INTEGER,
    confidence NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sh.calculated_at,
        sh.spearfish_score,
        sh.normalized_score,
        sh.confidence
    FROM score_history sh
    WHERE sh.company_id = p_company_id
        AND sh.calculated_at >= NOW() - INTERVAL '1 day' * p_days_back
    ORDER BY sh.calculated_at ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get companies needing score recalculation
CREATE OR REPLACE FUNCTION get_companies_needing_recalculation(
    p_hours_threshold INTEGER DEFAULT 24,
    p_batch_size INTEGER DEFAULT 100,
    p_target_batches TEXT[] DEFAULT ARRAY['W22', 'S22', 'W23']
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    batch TEXT,
    last_scored_at TIMESTAMPTZ,
    days_since_last_score INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.batch,
        c.updated_at as last_scored_at,
        EXTRACT(EPOCH FROM (NOW() - c.updated_at))/86400 as days_since_last_score
    FROM companies c
    WHERE c.sync_status = 'synced'
        AND c.is_ai_related = true
        AND (c.batch = ANY(p_target_batches) OR p_target_batches IS NULL)
        AND (
            c.spearfish_score IS NULL 
            OR c.updated_at < NOW() - INTERVAL '1 hour' * p_hours_threshold
        )
    ORDER BY c.updated_at ASC NULLS FIRST
    LIMIT p_batch_size;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get scoring statistics
CREATE OR REPLACE FUNCTION get_scoring_statistics()
RETURNS TABLE (
    total_companies BIGINT,
    scored_companies BIGINT,
    avg_score NUMERIC,
    score_0_2 BIGINT,
    score_2_4 BIGINT,
    score_4_6 BIGINT,
    score_6_8 BIGINT,
    score_8_10 BIGINT,
    last_calculated TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_companies,
        COUNT(c.spearfish_score) as scored_companies,
        AVG(c.spearfish_score) as avg_score,
        COUNT(*) FILTER (WHERE c.spearfish_score >= 0 AND c.spearfish_score < 2) as score_0_2,
        COUNT(*) FILTER (WHERE c.spearfish_score >= 2 AND c.spearfish_score < 4) as score_2_4,
        COUNT(*) FILTER (WHERE c.spearfish_score >= 4 AND c.spearfish_score < 6) as score_4_6,
        COUNT(*) FILTER (WHERE c.spearfish_score >= 6 AND c.spearfish_score < 8) as score_6_8,
        COUNT(*) FILTER (WHERE c.spearfish_score >= 8 AND c.spearfish_score <= 10) as score_8_10,
        MAX(c.updated_at) as last_calculated
    FROM companies c
    WHERE c.sync_status = 'synced' AND c.is_ai_related = true;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to bulk update company scores
CREATE OR REPLACE FUNCTION bulk_update_company_scores(
    p_updates JSONB
)
RETURNS TABLE (
    updated_companies INTEGER,
    failed_updates INTEGER
) AS $$
DECLARE
    update_record JSONB;
    updated_count INTEGER := 0;
    failed_count INTEGER := 0;
BEGIN
    -- Iterate through the updates array
    FOR update_record IN SELECT * FROM jsonb_array_elements(p_updates)
    LOOP
        BEGIN
            -- Update company score
            UPDATE companies 
            SET 
                spearfish_score = (update_record->>'spearfish_score')::NUMERIC,
                updated_at = NOW()
            WHERE id = (update_record->>'company_id')::UUID;
            
            -- Insert into score history
            INSERT INTO score_history (
                company_id,
                spearfish_score,
                normalized_score,
                score_breakdown,
                algorithm_version,
                confidence,
                metadata,
                calculated_at
            ) VALUES (
                (update_record->>'company_id')::UUID,
                (update_record->>'spearfish_score')::NUMERIC,
                (update_record->'score_metadata'->>'normalized_score')::INTEGER,
                update_record->'score_metadata'->'breakdown',
                update_record->'score_metadata'->>'algorithm_version',
                (update_record->'score_metadata'->>'confidence')::NUMERIC,
                update_record->'score_metadata'->'metadata',
                (update_record->'score_metadata'->>'calculated_at')::TIMESTAMPTZ
            );
            
            updated_count := updated_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            failed_count := failed_count + 1;
            RAISE NOTICE 'Failed to update company %: %', 
                update_record->>'company_id', SQLERRM;
        END;
    END LOOP;
    
    RETURN QUERY SELECT updated_count, failed_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- CREATE TRIGGERS FOR SCORE UPDATES
-- =============================================================================

-- Trigger function to update company timestamp when score changes
CREATE OR REPLACE FUNCTION update_company_score_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the company's updated_at timestamp when spearfish_score changes
    IF OLD.spearfish_score IS DISTINCT FROM NEW.spearfish_score THEN
        NEW.updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for score timestamp updates
DROP TRIGGER IF EXISTS trigger_update_company_score_timestamp ON companies;
CREATE TRIGGER trigger_update_company_score_timestamp
    BEFORE UPDATE ON companies
    FOR EACH ROW
    EXECUTE FUNCTION update_company_score_timestamp();

-- =============================================================================
-- CREATE VIEWS FOR COMMON QUERIES
-- =============================================================================

-- View for companies with their latest scores
CREATE OR REPLACE VIEW companies_with_latest_scores AS
SELECT 
    c.id,
    c.name,
    c.batch,
    c.industry,
    c.one_liner,
    c.spearfish_score,
    c.ai_confidence_score,
    c.is_ai_related,
    c.team_size,
    c.status,
    c.is_hiring,
    c.updated_at as last_scored_at,
    CASE 
        WHEN c.spearfish_score IS NULL THEN 'unscored'
        WHEN c.spearfish_score >= 8 THEN 'excellent'
        WHEN c.spearfish_score >= 6 THEN 'good'
        WHEN c.spearfish_score >= 4 THEN 'average'
        WHEN c.spearfish_score >= 2 THEN 'below_average'
        ELSE 'poor'
    END as score_category
FROM companies c
WHERE c.sync_status = 'synced' AND c.is_ai_related = true;

-- View for score leaderboard
CREATE OR REPLACE VIEW score_leaderboard AS
SELECT 
    c.id,
    c.name,
    c.batch,
    c.industry,
    c.one_liner,
    c.spearfish_score,
    c.ai_confidence_score,
    c.team_size,
    c.is_hiring,
    c.updated_at as last_scored_at,
    RANK() OVER (ORDER BY c.spearfish_score DESC NULLS LAST) as score_rank,
    RANK() OVER (PARTITION BY c.batch ORDER BY c.spearfish_score DESC NULLS LAST) as batch_rank
FROM companies c
WHERE c.sync_status = 'synced' 
    AND c.is_ai_related = true 
    AND c.spearfish_score IS NOT NULL
ORDER BY c.spearfish_score DESC;

-- =============================================================================
-- UPDATE COMMENTS AND DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE score_history IS 'Historical tracking of spearfish scores for companies';
COMMENT ON COLUMN score_history.spearfish_score IS 'Calculated spearfish score (0-10)';
COMMENT ON COLUMN score_history.normalized_score IS 'Normalized score for UI display (0-100)';
COMMENT ON COLUMN score_history.score_breakdown IS 'Detailed breakdown of score components';
COMMENT ON COLUMN score_history.algorithm_version IS 'Version of scoring algorithm used';
COMMENT ON COLUMN score_history.confidence IS 'Confidence in score accuracy (0-1)';
COMMENT ON COLUMN score_history.metadata IS 'Additional scoring metadata and warnings';

COMMENT ON TABLE score_batch_logs IS 'Tracking of batch scoring operations';
COMMENT ON COLUMN score_batch_logs.batch_id IS 'Unique identifier for batch operation';
COMMENT ON COLUMN score_batch_logs.total_processed IS 'Total number of companies processed';
COMMENT ON COLUMN score_batch_logs.successful_updates IS 'Number of successful score updates';
COMMENT ON COLUMN score_batch_logs.failed_updates IS 'Number of failed score updates';
COMMENT ON COLUMN score_batch_logs.processing_time_ms IS 'Total processing time in milliseconds';

COMMENT ON FUNCTION get_company_latest_score IS 'Get the most recent score for a company';
COMMENT ON FUNCTION get_company_score_trend IS 'Get score history trend for a company';
COMMENT ON FUNCTION get_companies_needing_recalculation IS 'Find companies that need score recalculation';
COMMENT ON FUNCTION get_scoring_statistics IS 'Get overall scoring statistics and distribution';
COMMENT ON FUNCTION bulk_update_company_scores IS 'Bulk update multiple company scores efficiently';

COMMENT ON VIEW companies_with_latest_scores IS 'Companies with their current scores and categories';
COMMENT ON VIEW score_leaderboard IS 'Ranked companies by spearfish score';

-- =============================================================================
-- ENABLE RLS POLICIES
-- =============================================================================

-- Enable RLS on new tables
ALTER TABLE score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_batch_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for score_history table
CREATE POLICY score_history_read_policy ON score_history
    FOR SELECT USING (true);

CREATE POLICY score_history_insert_policy ON score_history
    FOR INSERT WITH CHECK (true);

-- RLS policies for score_batch_logs table
CREATE POLICY score_batch_logs_read_policy ON score_batch_logs
    FOR SELECT USING (true);

CREATE POLICY score_batch_logs_insert_policy ON score_batch_logs
    FOR INSERT WITH CHECK (true);

-- =============================================================================
-- VERIFICATION AND SUCCESS MESSAGE
-- =============================================================================

DO $$
DECLARE
    table_count INTEGER;
    function_count INTEGER;
    view_count INTEGER;
    trigger_count INTEGER;
BEGIN
    -- Count created objects
    SELECT COUNT(*) INTO table_count FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name IN ('score_history', 'score_batch_logs');
    
    SELECT COUNT(*) INTO function_count FROM information_schema.routines 
    WHERE routine_schema = 'public' AND routine_name LIKE '%score%';
    
    SELECT COUNT(*) INTO view_count FROM information_schema.views 
    WHERE table_schema = 'public' AND table_name LIKE '%score%';
    
    SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers 
    WHERE trigger_schema = 'public' AND trigger_name LIKE '%score%';
    
    RAISE NOTICE '';
    RAISE NOTICE '🎯 SPEARFISH SCORING TABLES CREATED! 🎯';
    RAISE NOTICE '';
    RAISE NOTICE 'Database objects created:';
    RAISE NOTICE '• Tables: % (score_history, score_batch_logs)', table_count;
    RAISE NOTICE '• Functions: % (scoring utilities)', function_count;
    RAISE NOTICE '• Views: % (leaderboard, latest scores)', view_count;
    RAISE NOTICE '• Triggers: % (auto-timestamp updates)', trigger_count;
    RAISE NOTICE '';
    RAISE NOTICE '✅ Key capabilities added:';
    RAISE NOTICE '• Historical score tracking with metadata';
    RAISE NOTICE '• Batch operation logging and monitoring';
    RAISE NOTICE '• Efficient bulk score update functions';
    RAISE NOTICE '• Score trend analysis and statistics';
    RAISE NOTICE '• Leaderboard and ranking views';
    RAISE NOTICE '• Automated recalculation detection';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Ready for spearfish scoring operations!';
    RAISE NOTICE 'Task 4 database schema complete.';
END $$;