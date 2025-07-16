-- Create founders table to store team member and founder information
-- This stores data scraped from YC pages and company websites

-- Create founders table
CREATE TABLE IF NOT EXISTS founders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    bio TEXT,
    linkedin_url TEXT,
    twitter_url TEXT,
    email TEXT,
    image_url TEXT,
    background TEXT[],
    education TEXT[],
    source_url TEXT, -- Where this data was scraped from
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create funding_rounds table to store funding information
CREATE TABLE IF NOT EXISTS funding_rounds (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    round_type TEXT NOT NULL, -- 'Pre-Seed', 'Seed', 'Series A', etc.
    amount TEXT,
    currency TEXT DEFAULT 'USD',
    date TEXT,
    lead_investor TEXT,
    investors TEXT[],
    valuation TEXT,
    source_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create company_funding_summary table for aggregated funding data
CREATE TABLE IF NOT EXISTS company_funding_summary (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
    total_funding TEXT,
    key_investors TEXT[],
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sources TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_founders_company_id ON founders(company_id);
CREATE INDEX IF NOT EXISTS idx_funding_rounds_company_id ON funding_rounds(company_id);
CREATE INDEX IF NOT EXISTS idx_company_funding_summary_company_id ON company_funding_summary(company_id);

-- Create upsert function for founders data
CREATE OR REPLACE FUNCTION upsert_founder_data(
    p_company_id UUID,
    p_name TEXT,
    p_title TEXT,
    p_bio TEXT DEFAULT NULL,
    p_linkedin_url TEXT DEFAULT NULL,
    p_twitter_url TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_image_url TEXT DEFAULT NULL,
    p_background TEXT DEFAULT '[]',
    p_education TEXT DEFAULT '[]',
    p_source_url TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    founder_id UUID;
    parsed_background TEXT[];
    parsed_education TEXT[];
BEGIN
    -- Parse JSON arrays safely
    BEGIN
        parsed_background := CASE 
            WHEN p_background IS NULL OR p_background = '' THEN '{}'::TEXT[]
            ELSE p_background::JSON::TEXT[]
        END;
    EXCEPTION WHEN OTHERS THEN
        parsed_background := '{}'::TEXT[];
    END;

    BEGIN
        parsed_education := CASE 
            WHEN p_education IS NULL OR p_education = '' THEN '{}'::TEXT[]
            ELSE p_education::JSON::TEXT[]
        END;
    EXCEPTION WHEN OTHERS THEN
        parsed_education := '{}'::TEXT[];
    END;

    -- Insert or update founder
    INSERT INTO founders (
        company_id, name, title, bio, linkedin_url, twitter_url, email,
        image_url, background, education, source_url, updated_at
    )
    VALUES (
        p_company_id, p_name, p_title, p_bio, p_linkedin_url, p_twitter_url,
        p_email, p_image_url, parsed_background, parsed_education, p_source_url, NOW()
    )
    ON CONFLICT (company_id, name) DO UPDATE SET
        title = EXCLUDED.title,
        bio = COALESCE(EXCLUDED.bio, founders.bio),
        linkedin_url = COALESCE(EXCLUDED.linkedin_url, founders.linkedin_url),
        twitter_url = COALESCE(EXCLUDED.twitter_url, founders.twitter_url),
        email = COALESCE(EXCLUDED.email, founders.email),
        image_url = COALESCE(EXCLUDED.image_url, founders.image_url),
        background = COALESCE(EXCLUDED.background, founders.background),
        education = COALESCE(EXCLUDED.education, founders.education),
        source_url = COALESCE(EXCLUDED.source_url, founders.source_url),
        updated_at = NOW()
    RETURNING id INTO founder_id;

    RETURN founder_id;
END;
$$ LANGUAGE plpgsql;

-- Create upsert function for funding summary
CREATE OR REPLACE FUNCTION upsert_funding_summary(
    p_company_id UUID,
    p_total_funding TEXT DEFAULT NULL,
    p_key_investors TEXT DEFAULT '[]',
    p_sources TEXT DEFAULT '[]'
) RETURNS UUID AS $$
DECLARE
    summary_id UUID;
    parsed_investors TEXT[];
    parsed_sources TEXT[];
BEGIN
    -- Parse JSON arrays safely
    BEGIN
        parsed_investors := CASE 
            WHEN p_key_investors IS NULL OR p_key_investors = '' THEN '{}'::TEXT[]
            ELSE p_key_investors::JSON::TEXT[]
        END;
    EXCEPTION WHEN OTHERS THEN
        parsed_investors := '{}'::TEXT[];
    END;

    BEGIN
        parsed_sources := CASE 
            WHEN p_sources IS NULL OR p_sources = '' THEN '{}'::TEXT[]
            ELSE p_sources::JSON::TEXT[]
        END;
    EXCEPTION WHEN OTHERS THEN
        parsed_sources := '{}'::TEXT[];
    END;

    -- Insert or update funding summary
    INSERT INTO company_funding_summary (
        company_id, total_funding, key_investors, sources, last_updated, updated_at
    )
    VALUES (
        p_company_id, p_total_funding, parsed_investors, parsed_sources, NOW(), NOW()
    )
    ON CONFLICT (company_id) DO UPDATE SET
        total_funding = COALESCE(EXCLUDED.total_funding, company_funding_summary.total_funding),
        key_investors = EXCLUDED.key_investors,
        sources = EXCLUDED.sources,
        last_updated = NOW(),
        updated_at = NOW()
    RETURNING id INTO summary_id;

    RETURN summary_id;
END;
$$ LANGUAGE plpgsql;

-- Add unique constraint to prevent duplicate founders per company
ALTER TABLE founders ADD CONSTRAINT unique_founder_per_company UNIQUE (company_id, name);

-- Add comments for documentation
COMMENT ON TABLE founders IS 'Stores founder and team member information scraped from various sources';
COMMENT ON TABLE funding_rounds IS 'Stores individual funding rounds for companies';
COMMENT ON TABLE company_funding_summary IS 'Stores aggregated funding data per company';