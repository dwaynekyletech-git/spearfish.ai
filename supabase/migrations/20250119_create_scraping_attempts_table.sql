-- Create scraping_attempts table to track automated scraping attempts
-- This helps prevent duplicate work and implements cooldown periods

CREATE TABLE IF NOT EXISTS scraping_attempts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    scrape_type TEXT NOT NULL, -- 'founders', 'github', 'funding', etc.
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    success BOOLEAN DEFAULT FALSE,
    founders_found INTEGER DEFAULT 0,
    error_message TEXT,
    processing_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_scraping_attempts_company_id ON scraping_attempts(company_id);
CREATE INDEX IF NOT EXISTS idx_scraping_attempts_type_time ON scraping_attempts(scrape_type, attempted_at);
CREATE INDEX IF NOT EXISTS idx_scraping_attempts_success ON scraping_attempts(success);

-- Add RLS policy
ALTER TABLE scraping_attempts ENABLE ROW LEVEL SECURITY;

-- Allow public read access for debugging (you might want to restrict this)
CREATE POLICY "Allow public read access to scraping attempts" ON scraping_attempts
    FOR SELECT USING (true);

-- Allow service role full access
CREATE POLICY "Allow service role full access to scraping attempts" ON scraping_attempts
    USING (auth.role() = 'service_role');

-- Add comments for documentation
COMMENT ON TABLE scraping_attempts IS 'Tracks automated scraping attempts to prevent duplicates and implement cooldown periods';
COMMENT ON COLUMN scraping_attempts.scrape_type IS 'Type of data being scraped (founders, github, funding, etc.)';
COMMENT ON COLUMN scraping_attempts.founders_found IS 'Number of founders found during the attempt (if applicable)';
COMMENT ON COLUMN scraping_attempts.processing_time_ms IS 'Time taken to process the scraping attempt in milliseconds';