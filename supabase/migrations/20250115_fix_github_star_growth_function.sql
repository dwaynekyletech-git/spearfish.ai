-- Fix ambiguous column reference in calculate_star_growth function
-- This migration addresses the "column reference 'repository_id' is ambiguous" error

-- Drop and recreate the calculate_star_growth function with proper column qualification
DROP FUNCTION IF EXISTS calculate_star_growth(UUID, INTEGER);

CREATE OR REPLACE FUNCTION calculate_star_growth(
    repo_id UUID,
    days_period INTEGER DEFAULT 30
) RETURNS TABLE (
    repository_id UUID,
    start_stars INTEGER,
    end_stars INTEGER,
    star_growth INTEGER,
    growth_percentage DECIMAL,
    period_days INTEGER,
    monthly_growth_rate DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH period_metrics AS (
        SELECT 
            m.repository_id,
            m.stars_count,
            m.recorded_at,
            ROW_NUMBER() OVER (PARTITION BY m.repository_id ORDER BY m.recorded_at ASC) as first_row,
            ROW_NUMBER() OVER (PARTITION BY m.repository_id ORDER BY m.recorded_at DESC) as last_row
        FROM github_repository_metrics m
        WHERE m.repository_id = repo_id
            AND m.recorded_at >= NOW() - (days_period || ' days')::INTERVAL
    ),
    start_metric AS (
        SELECT pm.repository_id, pm.stars_count as start_stars
        FROM period_metrics pm
        WHERE pm.first_row = 1
    ),
    end_metric AS (
        SELECT pm.repository_id, pm.stars_count as end_stars
        FROM period_metrics pm
        WHERE pm.last_row = 1
    )
    SELECT 
        repo_id as repository_id,
        COALESCE(bd.start_stars, 0) as start_stars,
        COALESCE(bd.end_stars, 0) as end_stars,
        COALESCE(bd.end_stars, 0) - COALESCE(bd.start_stars, 0) as star_growth,
        CASE 
            WHEN COALESCE(bd.start_stars, 0) > 0 
            THEN ((COALESCE(bd.end_stars, 0) - COALESCE(bd.start_stars, 0))::DECIMAL / bd.start_stars * 100)
            ELSE NULL
        END as growth_percentage,
        days_period as period_days,
        CASE 
            WHEN COALESCE(bd.start_stars, 0) > 0 AND days_period > 0
            THEN ((COALESCE(bd.end_stars, 0) - COALESCE(bd.start_stars, 0))::DECIMAL / days_period * 30)
            ELSE NULL
        END as monthly_growth_rate
    FROM (
        SELECT 
            repo_id as repository_id,
            COALESCE(s.start_stars, 0) as start_stars,
            COALESCE(e.end_stars, 0) as end_stars
        FROM start_metric s
        FULL OUTER JOIN end_metric e ON s.repository_id = e.repository_id
        
        UNION ALL
        
        SELECT 
            repo_id as repository_id,
            0 as start_stars,
            0 as end_stars
        WHERE NOT EXISTS (SELECT 1 FROM start_metric) 
          AND NOT EXISTS (SELECT 1 FROM end_metric)
    ) bd
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON FUNCTION calculate_star_growth IS 'Calculate star growth metrics for a repository over a specified period (fixed ambiguous column reference)';