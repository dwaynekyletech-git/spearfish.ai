-- Fix sync statistics function column ambiguity
-- Quick fix for Task 3.4

-- Function to get sync statistics (fixed column references)
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

DO $$
BEGIN
    RAISE NOTICE 'Fixed get_sync_statistics function column ambiguity';
END $$;