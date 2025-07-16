-- GitHub API Integration Tables
-- Migration for storing GitHub repository data and historical metrics

-- Create github_repositories table
CREATE TABLE github_repositories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    github_id BIGINT UNIQUE NOT NULL, -- GitHub's internal repository ID
    full_name TEXT NOT NULL, -- "owner/repo"
    name TEXT NOT NULL,
    owner TEXT NOT NULL,
    description TEXT,
    html_url TEXT NOT NULL,
    language TEXT, -- Primary programming language
    stars_count INTEGER DEFAULT 0,
    forks_count INTEGER DEFAULT 0,
    open_issues_count INTEGER DEFAULT 0,
    size INTEGER DEFAULT 0, -- Repository size in KB
    archived BOOLEAN DEFAULT false,
    disabled BOOLEAN DEFAULT false,
    private BOOLEAN DEFAULT false,
    created_at_github TIMESTAMP WITH TIME ZONE NOT NULL, -- GitHub creation date
    updated_at_github TIMESTAMP WITH TIME ZONE NOT NULL, -- GitHub last update
    pushed_at_github TIMESTAMP WITH TIME ZONE, -- GitHub last push
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create github_repository_metrics table for historical tracking
CREATE TABLE github_repository_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repository_id UUID NOT NULL REFERENCES github_repositories(id) ON DELETE CASCADE,
    stars_count INTEGER NOT NULL,
    forks_count INTEGER NOT NULL,
    open_issues_count INTEGER NOT NULL,
    size INTEGER NOT NULL,
    contributors_count INTEGER DEFAULT 0,
    commit_count_last_year INTEGER DEFAULT 0,
    releases_count INTEGER DEFAULT 0,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create github_repository_languages table for language breakdown
CREATE TABLE github_repository_languages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repository_id UUID NOT NULL REFERENCES github_repositories(id) ON DELETE CASCADE,
    language TEXT NOT NULL,
    bytes_count INTEGER NOT NULL,
    percentage DECIMAL(5,2) NOT NULL, -- 0.00 to 100.00
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create company_github_repositories junction table
CREATE TABLE company_github_repositories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    repository_id UUID NOT NULL REFERENCES github_repositories(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT false, -- Mark main repository for the company
    discovery_method TEXT DEFAULT 'manual', -- 'manual', 'search', 'api', 'website'
    confidence_score DECIMAL(3,2) DEFAULT 1.0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    notes TEXT, -- Additional context about this association
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, repository_id) -- Prevent duplicate associations
);

-- Create github_sync_logs table for tracking data synchronization
CREATE TABLE github_sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental', 'repository', 'metrics')),
    repository_id UUID REFERENCES github_repositories(id) ON DELETE SET NULL,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'partial')),
    repositories_processed INTEGER DEFAULT 0,
    repositories_total INTEGER DEFAULT 0,
    error_message TEXT,
    rate_limit_remaining INTEGER,
    duration_seconds INTEGER,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_github_repositories_github_id ON github_repositories(github_id);
CREATE INDEX idx_github_repositories_full_name ON github_repositories(full_name);
CREATE INDEX idx_github_repositories_owner ON github_repositories(owner);
CREATE INDEX idx_github_repositories_language ON github_repositories(language);
CREATE INDEX idx_github_repositories_stars_count ON github_repositories(stars_count DESC);
CREATE INDEX idx_github_repositories_forks_count ON github_repositories(forks_count DESC);
CREATE INDEX idx_github_repositories_last_synced_at ON github_repositories(last_synced_at);
CREATE INDEX idx_github_repositories_archived_disabled ON github_repositories(archived, disabled) WHERE NOT archived AND NOT disabled;

CREATE INDEX idx_github_repository_metrics_repository_id ON github_repository_metrics(repository_id);
CREATE INDEX idx_github_repository_metrics_recorded_at ON github_repository_metrics(recorded_at DESC);
CREATE INDEX idx_github_repository_metrics_stars_growth ON github_repository_metrics(repository_id, recorded_at, stars_count);

CREATE INDEX idx_github_repository_languages_repository_id ON github_repository_languages(repository_id);
CREATE INDEX idx_github_repository_languages_language ON github_repository_languages(language);
CREATE INDEX idx_github_repository_languages_recorded_at ON github_repository_languages(recorded_at DESC);

CREATE INDEX idx_company_github_repositories_company_id ON company_github_repositories(company_id);
CREATE INDEX idx_company_github_repositories_repository_id ON company_github_repositories(repository_id);
CREATE INDEX idx_company_github_repositories_is_primary ON company_github_repositories(is_primary) WHERE is_primary = true;
CREATE INDEX idx_company_github_repositories_confidence ON company_github_repositories(confidence_score DESC);

CREATE INDEX idx_github_sync_logs_sync_type ON github_sync_logs(sync_type);
CREATE INDEX idx_github_sync_logs_status ON github_sync_logs(status);
CREATE INDEX idx_github_sync_logs_started_at ON github_sync_logs(started_at DESC);
CREATE INDEX idx_github_sync_logs_repository_id ON github_sync_logs(repository_id);
CREATE INDEX idx_github_sync_logs_company_id ON github_sync_logs(company_id);

-- Create composite indexes for common queries
CREATE INDEX idx_github_repositories_active_stars ON github_repositories(stars_count DESC, updated_at_github DESC) 
    WHERE NOT archived AND NOT disabled;
CREATE INDEX idx_company_repositories_primary ON company_github_repositories(company_id, is_primary, confidence_score DESC);

-- Create triggers for updated_at columns
CREATE TRIGGER update_github_repositories_updated_at 
    BEFORE UPDATE ON github_repositories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_github_repositories_updated_at 
    BEFORE UPDATE ON company_github_repositories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to calculate star growth
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
    ),
    base_data AS (
        SELECT 
            repo_id as repository_id,
            COALESCE(s.start_stars, 0) as start_stars,
            COALESCE(e.end_stars, 0) as end_stars
        FROM start_metric s
        FULL OUTER JOIN end_metric e ON s.repository_id = e.repository_id
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

-- Create function to get top repositories for a company
CREATE OR REPLACE FUNCTION get_company_top_repositories(
    comp_id UUID,
    limit_count INTEGER DEFAULT 10
) RETURNS TABLE (
    repository_id UUID,
    full_name TEXT,
    description TEXT,
    stars_count INTEGER,
    forks_count INTEGER,
    language TEXT,
    is_primary BOOLEAN,
    confidence_score DECIMAL,
    monthly_star_growth DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gr.id as repository_id,
        gr.full_name,
        gr.description,
        gr.stars_count,
        gr.forks_count,
        gr.language,
        cgr.is_primary,
        cgr.confidence_score,
        (SELECT monthly_growth_rate FROM calculate_star_growth(gr.id, 30) LIMIT 1) as monthly_star_growth
    FROM github_repositories gr
    JOIN company_github_repositories cgr ON gr.id = cgr.repository_id
    WHERE cgr.company_id = comp_id
        AND NOT gr.archived 
        AND NOT gr.disabled
    ORDER BY 
        cgr.is_primary DESC,
        gr.stars_count DESC,
        cgr.confidence_score DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE github_repositories IS 'GitHub repositories with basic information and metrics';
COMMENT ON TABLE github_repository_metrics IS 'Historical tracking of repository metrics over time';
COMMENT ON TABLE github_repository_languages IS 'Programming language breakdown for each repository';
COMMENT ON TABLE company_github_repositories IS 'Association between companies and their GitHub repositories';
COMMENT ON TABLE github_sync_logs IS 'Logs for GitHub data synchronization processes';

COMMENT ON COLUMN github_repositories.github_id IS 'GitHub internal repository ID (immutable)';
COMMENT ON COLUMN github_repositories.full_name IS 'Repository full name in format owner/repo';
COMMENT ON COLUMN github_repositories.last_synced_at IS 'Last time this repository data was updated from GitHub API';
COMMENT ON COLUMN company_github_repositories.is_primary IS 'Whether this is the main repository for the company';
COMMENT ON COLUMN company_github_repositories.discovery_method IS 'How this repository was associated with the company';
COMMENT ON COLUMN company_github_repositories.confidence_score IS 'Confidence level (0-1) that this repository belongs to the company';

COMMENT ON FUNCTION calculate_star_growth IS 'Calculate star growth metrics for a repository over a specified period';
COMMENT ON FUNCTION get_company_top_repositories IS 'Get top repositories for a company ordered by importance and popularity';