-- Add Apify Integration Support
-- This migration adds tables and fields to support Apify Y Combinator data enrichment

-- =============================================================================
-- Extend companies table with Apify fields
-- =============================================================================

-- Add Apify-specific fields to companies table
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS apify_scraped_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'yc-oss',
ADD COLUMN IF NOT EXISTS enrichment_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS yc_url TEXT,
ADD COLUMN IF NOT EXISTS one_liner TEXT,
ADD COLUMN IF NOT EXISTS long_description TEXT,
ADD COLUMN IF NOT EXISTS all_locations TEXT,
ADD COLUMN IF NOT EXISTS twitter_url TEXT,
ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
ADD COLUMN IF NOT EXISTS github_url TEXT,
-- NEW: Enhanced company fields from Apify API
ADD COLUMN IF NOT EXISTS company_image TEXT,
ADD COLUMN IF NOT EXISTS year_founded INTEGER,
ADD COLUMN IF NOT EXISTS primary_partner TEXT,
ADD COLUMN IF NOT EXISTS is_hiring BOOLEAN,
ADD COLUMN IF NOT EXISTS number_of_open_jobs INTEGER,
ADD COLUMN IF NOT EXISTS apify_company_id INTEGER;

-- Add constraints for new fields
ALTER TABLE companies 
ADD CONSTRAINT check_data_source 
CHECK (data_source IN ('yc-oss', 'apify', 'manual', 'api'));

ALTER TABLE companies 
ADD CONSTRAINT check_enrichment_status 
CHECK (enrichment_status IN ('pending', 'completed', 'failed', 'in_progress'));

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_companies_data_source ON companies(data_source);
CREATE INDEX IF NOT EXISTS idx_companies_enrichment_status ON companies(enrichment_status);
CREATE INDEX IF NOT EXISTS idx_companies_apify_scraped_at ON companies(apify_scraped_at);
CREATE INDEX IF NOT EXISTS idx_companies_is_ai_related ON companies(is_ai_related);

-- =============================================================================
-- Extend founders table with Apify fields
-- =============================================================================

-- Add Apify-specific fields to founders table
ALTER TABLE founders 
ADD COLUMN IF NOT EXISTS apify_scraped_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS source_url TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT,
-- NEW: Enhanced founder fields from Apify API
ADD COLUMN IF NOT EXISTS apify_founder_id INTEGER;

-- Add constraint for founders data source
ALTER TABLE founders 
ADD CONSTRAINT check_founders_data_source 
CHECK (data_source IN ('manual', 'apify', 'scraping', 'api'));

-- Add indexes for founders
CREATE INDEX IF NOT EXISTS idx_founders_data_source ON founders(data_source);
CREATE INDEX IF NOT EXISTS idx_founders_apify_scraped_at ON founders(apify_scraped_at);

-- =============================================================================
-- Create company_jobs table
-- =============================================================================

CREATE TABLE IF NOT EXISTS company_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Job details
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    remote_ok BOOLEAN DEFAULT false,
    apply_url TEXT,
    job_type TEXT, -- 'Full-time', 'Part-time', 'Contract', 'Internship'
    experience_level TEXT, -- 'Junior', 'Mid-level', 'Senior', 'Internship'
    department TEXT, -- 'Engineering', 'Product', 'Design', 'Marketing', etc.
    
    -- NEW: Enhanced job fields from Apify API
    salary TEXT, -- Salary range from Apify
    years_experience TEXT, -- Experience requirements from Apify
    description_url TEXT, -- Link to full job description
    apify_job_id INTEGER, -- Apify's job ID for deduplication
    
    -- Metadata
    posted_at TIMESTAMP WITH TIME ZONE,
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    data_source TEXT DEFAULT 'apify',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_job_type 
    CHECK (job_type IN ('Full-time', 'Part-time', 'Contract', 'Internship', 'Temporary', 'Other')),
    
    CONSTRAINT check_experience_level 
    CHECK (experience_level IN ('Internship', 'Junior', 'Mid-level', 'Senior', 'Executive', 'Other')),
    
    CONSTRAINT check_jobs_data_source 
    CHECK (data_source IN ('apify', 'manual', 'scraping', 'api'))
);

-- Add indexes for company_jobs
CREATE INDEX IF NOT EXISTS idx_company_jobs_company_id ON company_jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_company_jobs_is_active ON company_jobs(is_active);
CREATE INDEX IF NOT EXISTS idx_company_jobs_job_type ON company_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_company_jobs_department ON company_jobs(department);
CREATE INDEX IF NOT EXISTS idx_company_jobs_experience_level ON company_jobs(experience_level);
CREATE INDEX IF NOT EXISTS idx_company_jobs_remote_ok ON company_jobs(remote_ok);
CREATE INDEX IF NOT EXISTS idx_company_jobs_posted_at ON company_jobs(posted_at);
CREATE INDEX IF NOT EXISTS idx_company_jobs_data_source ON company_jobs(data_source);

-- =============================================================================
-- Create API usage tracking table
-- =============================================================================

CREATE TABLE IF NOT EXISTS api_usage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Service information
    service TEXT NOT NULL, -- 'apify', 'openai', 'perplexity', etc.
    cost_usd DECIMAL(10, 4) NOT NULL DEFAULT 0, -- Cost in USD
    items_processed INTEGER DEFAULT 0, -- Number of items processed
    
    -- Request metadata
    metadata JSONB DEFAULT '{}'::jsonb, -- Flexible metadata storage
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_cost_positive CHECK (cost_usd >= 0),
    CONSTRAINT check_items_positive CHECK (items_processed >= 0)
);

-- Add indexes for api_usage_log
CREATE INDEX IF NOT EXISTS idx_api_usage_log_service ON api_usage_log(service);
CREATE INDEX IF NOT EXISTS idx_api_usage_log_created_at ON api_usage_log(created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_log_cost ON api_usage_log(cost_usd);

-- =============================================================================
-- Add RLS policies for new tables
-- =============================================================================

-- Enable RLS on new tables
ALTER TABLE company_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_log ENABLE ROW LEVEL SECURITY;

-- Company jobs policies
CREATE POLICY "Allow public read access to company jobs" ON company_jobs
    FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to manage company jobs" ON company_jobs
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow service role full access to company jobs" ON company_jobs
    USING (auth.role() = 'service_role');

-- API usage log policies (more restrictive)
CREATE POLICY "Allow service role full access to api usage log" ON api_usage_log
    USING (auth.role() = 'service_role');

CREATE POLICY "Allow authenticated admins to read api usage log" ON api_usage_log
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND 
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE clerk_user_id = auth.jwt() ->> 'sub'
            AND role = 'admin'
        )
    );

-- =============================================================================
-- Add helpful views
-- =============================================================================

-- View for companies with enrichment status
CREATE OR REPLACE VIEW companies_enrichment_status AS
SELECT 
    c.id,
    c.name,
    c.batch,
    c.is_ai_related,
    c.data_source,
    c.enrichment_status,
    c.apify_scraped_at,
    COUNT(f.id) as founders_count,
    COUNT(j.id) as jobs_count,
    CASE 
        WHEN c.apify_scraped_at IS NULL THEN 'Never enriched'
        WHEN c.apify_scraped_at < NOW() - INTERVAL '30 days' THEN 'Stale (>30 days)'
        WHEN c.apify_scraped_at < NOW() - INTERVAL '7 days' THEN 'Needs refresh (>7 days)'
        ELSE 'Fresh'
    END as freshness_status
FROM companies c
LEFT JOIN founders f ON c.id = f.company_id AND f.data_source = 'apify'
LEFT JOIN company_jobs j ON c.id = j.company_id AND j.is_active = true
GROUP BY c.id, c.name, c.batch, c.is_ai_related, c.data_source, c.enrichment_status, c.apify_scraped_at;

-- View for API usage summary
CREATE OR REPLACE VIEW api_usage_monthly_summary AS
SELECT 
    service,
    DATE_TRUNC('month', created_at) as month,
    COUNT(*) as total_requests,
    SUM(cost_usd) as total_cost,
    SUM(items_processed) as total_items,
    AVG(cost_usd) as avg_cost_per_request,
    CASE 
        WHEN SUM(items_processed) > 0 
        THEN SUM(cost_usd) / SUM(items_processed) 
        ELSE 0 
    END as avg_cost_per_item
FROM api_usage_log
GROUP BY service, DATE_TRUNC('month', created_at)
ORDER BY month DESC, service;

-- View for AI companies ready for enrichment
CREATE OR REPLACE VIEW ai_companies_for_enrichment AS
SELECT 
    c.id,
    c.name,
    c.batch,
    c.yc_url,
    c.enrichment_status,
    c.apify_scraped_at,
    COUNT(f.id) as existing_founders_count,
    CASE 
        WHEN c.apify_scraped_at IS NULL THEN 10 -- Never enriched
        WHEN c.enrichment_status = 'failed' AND c.apify_scraped_at < NOW() - INTERVAL '24 hours' THEN 8 -- Retry failed
        WHEN c.apify_scraped_at < NOW() - INTERVAL '30 days' THEN 6 -- Refresh stale data
        WHEN c.apify_scraped_at < NOW() - INTERVAL '7 days' AND COUNT(j.id) = 0 THEN 4 -- Refresh for jobs
        ELSE 1 -- Low priority
    END as enrichment_priority
FROM companies c
LEFT JOIN founders f ON c.id = f.company_id
LEFT JOIN company_jobs j ON c.id = j.company_id AND j.is_active = true
WHERE c.is_ai_related = true
    AND (
        c.enrichment_status IN ('pending', 'failed') 
        OR c.apify_scraped_at IS NULL 
        OR c.apify_scraped_at < NOW() - INTERVAL '7 days'
    )
GROUP BY c.id, c.name, c.batch, c.yc_url, c.enrichment_status, c.apify_scraped_at
ORDER BY enrichment_priority DESC, c.apify_scraped_at ASC NULLS FIRST;

-- =============================================================================
-- Add helpful functions
-- =============================================================================

-- Function to get monthly API cost for a service
CREATE OR REPLACE FUNCTION get_monthly_api_cost(service_name TEXT)
RETURNS DECIMAL(10, 4) AS $$
BEGIN
    RETURN COALESCE(
        (SELECT SUM(cost_usd) 
         FROM api_usage_log 
         WHERE service = service_name 
         AND created_at >= DATE_TRUNC('month', NOW())),
        0
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if company needs enrichment
CREATE OR REPLACE FUNCTION company_needs_enrichment(company_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    company_record companies%ROWTYPE;
BEGIN
    SELECT * INTO company_record FROM companies WHERE id = company_uuid;
    
    -- Return true if company needs enrichment
    RETURN (
        company_record.is_ai_related = true AND (
            company_record.enrichment_status IN ('pending', 'failed') OR
            company_record.apify_scraped_at IS NULL OR
            company_record.apify_scraped_at < NOW() - INTERVAL '30 days'
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Add comments for documentation
-- =============================================================================

COMMENT ON TABLE company_jobs IS 'Job postings from Y Combinator companies, primarily enriched via Apify';
COMMENT ON TABLE api_usage_log IS 'Tracks API usage and costs across all external services';

COMMENT ON COLUMN companies.apify_scraped_at IS 'Timestamp when company data was last enriched via Apify';
COMMENT ON COLUMN companies.data_source IS 'Primary source of company data (yc-oss, apify, manual, api)';
COMMENT ON COLUMN companies.enrichment_status IS 'Status of data enrichment process';

COMMENT ON COLUMN company_jobs.remote_ok IS 'Whether the job allows remote work';
COMMENT ON COLUMN company_jobs.is_active IS 'Whether the job posting is currently active';

COMMENT ON COLUMN api_usage_log.cost_usd IS 'Cost of API request in US dollars';
COMMENT ON COLUMN api_usage_log.items_processed IS 'Number of items processed in this API request';
COMMENT ON COLUMN api_usage_log.metadata IS 'Flexible JSON metadata for request details';

-- =============================================================================
-- Data migration for existing companies
-- =============================================================================

-- Update existing companies to have proper data_source
UPDATE companies 
SET data_source = 'yc-oss' 
WHERE data_source IS NULL OR data_source = '';

-- Mark AI companies as pending enrichment
UPDATE companies 
SET enrichment_status = 'pending' 
WHERE is_ai_related = true 
    AND enrichment_status IS NULL;

-- Set non-AI companies as completed (no enrichment needed)
UPDATE companies 
SET enrichment_status = 'completed' 
WHERE is_ai_related = false 
    AND enrichment_status IS NULL;

-- =============================================================================
-- Final setup
-- =============================================================================

-- Refresh materialized views if any exist
-- (none currently, but good practice)

-- Update table statistics for better query planning
ANALYZE companies;
ANALYZE founders;
ANALYZE company_jobs;
ANALYZE api_usage_log;