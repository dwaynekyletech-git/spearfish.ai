-- Add additional YC API fields to companies table
-- This migration adds fields that were missing from the original YC API extraction

-- First, let's check if the company_status type exists, if not create it
DO $$ BEGIN
    CREATE TYPE company_status AS ENUM ('Active', 'Acquired', 'Public', 'Inactive');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new columns to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS former_names TEXT[] DEFAULT '{}';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS all_locations TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS industries TEXT[] DEFAULT '{}';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tags_highlighted TEXT[] DEFAULT '{}';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS nonprofit BOOLEAN DEFAULT false;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS top_company BOOLEAN DEFAULT false;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS app_video_public BOOLEAN DEFAULT false;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS demo_day_video_public BOOLEAN DEFAULT false;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS yc_url TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS yc_api_url TEXT;

-- Add indexes for commonly queried fields
CREATE INDEX IF NOT EXISTS idx_companies_nonprofit ON companies(nonprofit);
CREATE INDEX IF NOT EXISTS idx_companies_top_company ON companies(top_company);
CREATE INDEX IF NOT EXISTS idx_companies_demo_day_video ON companies(demo_day_video_public);

-- Drop existing upsert_yc_company function to avoid conflicts
DROP FUNCTION IF EXISTS upsert_yc_company;

-- Update the upsert_yc_company function to handle new fields
CREATE OR REPLACE FUNCTION upsert_yc_company(
    p_yc_api_id INTEGER,
    p_name TEXT,
    p_slug TEXT,
    p_former_names TEXT DEFAULT '[]',
    p_website_url TEXT DEFAULT NULL,
    p_all_locations TEXT DEFAULT NULL,
    p_one_liner TEXT DEFAULT NULL,
    p_long_description TEXT DEFAULT NULL,
    p_batch TEXT DEFAULT NULL,
    p_stage TEXT DEFAULT NULL,
    p_status TEXT DEFAULT 'Active',
    p_industry TEXT DEFAULT NULL,
    p_subindustry TEXT DEFAULT NULL,
    p_industries TEXT DEFAULT '[]',
    p_tags TEXT DEFAULT '[]',
    p_tags_highlighted TEXT DEFAULT '[]',
    p_regions TEXT DEFAULT '[]',
    p_team_size INTEGER DEFAULT NULL,
    p_launched_at BIGINT DEFAULT NULL,
    p_small_logo_thumb_url TEXT DEFAULT NULL,
    p_is_hiring BOOLEAN DEFAULT false,
    p_nonprofit BOOLEAN DEFAULT false,
    p_top_company BOOLEAN DEFAULT false,
    p_app_video_public BOOLEAN DEFAULT false,
    p_demo_day_video_public BOOLEAN DEFAULT false,
    p_yc_url TEXT DEFAULT NULL,
    p_yc_api_url TEXT DEFAULT NULL,
    p_is_ai_related BOOLEAN DEFAULT false,
    p_ai_confidence_score DECIMAL DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    company_id UUID;
    parsed_former_names TEXT[];
    parsed_industries TEXT[];
    parsed_tags TEXT[];
    parsed_tags_highlighted TEXT[];
    parsed_regions TEXT[];
BEGIN
    -- Parse JSON arrays safely
    BEGIN
        parsed_former_names := CASE 
            WHEN p_former_names IS NULL OR p_former_names = '' THEN '{}'::TEXT[]
            ELSE p_former_names::JSON::TEXT[]
        END;
    EXCEPTION WHEN OTHERS THEN
        parsed_former_names := '{}'::TEXT[];
    END;

    BEGIN
        parsed_industries := CASE 
            WHEN p_industries IS NULL OR p_industries = '' THEN '{}'::TEXT[]
            ELSE p_industries::JSON::TEXT[]
        END;
    EXCEPTION WHEN OTHERS THEN
        parsed_industries := '{}'::TEXT[];
    END;

    BEGIN
        parsed_tags := CASE 
            WHEN p_tags IS NULL OR p_tags = '' THEN '{}'::TEXT[]
            ELSE p_tags::JSON::TEXT[]
        END;
    EXCEPTION WHEN OTHERS THEN
        parsed_tags := '{}'::TEXT[];
    END;

    BEGIN
        parsed_tags_highlighted := CASE 
            WHEN p_tags_highlighted IS NULL OR p_tags_highlighted = '' THEN '{}'::TEXT[]
            ELSE p_tags_highlighted::JSON::TEXT[]
        END;
    EXCEPTION WHEN OTHERS THEN
        parsed_tags_highlighted := '{}'::TEXT[];
    END;

    BEGIN
        parsed_regions := CASE 
            WHEN p_regions IS NULL OR p_regions = '' THEN '{}'::TEXT[]
            ELSE p_regions::JSON::TEXT[]
        END;
    EXCEPTION WHEN OTHERS THEN
        parsed_regions := '{}'::TEXT[];
    END;

    -- Insert or update company
    INSERT INTO companies (
        yc_api_id, name, slug, former_names, website_url, all_locations,
        one_liner, long_description, batch, stage, status, industry, subindustry,
        industries, tags, tags_highlighted, regions, team_size, launched_at,
        small_logo_thumb_url, is_hiring, nonprofit, top_company,
        app_video_public, demo_day_video_public, yc_url, yc_api_url,
        is_ai_related, ai_confidence_score, sync_status, last_sync_date
    )
    VALUES (
        p_yc_api_id, p_name, p_slug, parsed_former_names, p_website_url, p_all_locations,
        p_one_liner, p_long_description, p_batch, p_stage, p_status::company_status,
        p_industry, p_subindustry, parsed_industries, parsed_tags, parsed_tags_highlighted,
        parsed_regions, p_team_size, p_launched_at, p_small_logo_thumb_url,
        p_is_hiring, p_nonprofit, p_top_company, p_app_video_public, p_demo_day_video_public,
        p_yc_url, p_yc_api_url, p_is_ai_related, p_ai_confidence_score, 'synced', NOW()
    )
    ON CONFLICT (yc_api_id) DO UPDATE SET
        name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        former_names = EXCLUDED.former_names,
        website_url = EXCLUDED.website_url,
        all_locations = EXCLUDED.all_locations,
        one_liner = EXCLUDED.one_liner,
        long_description = EXCLUDED.long_description,
        batch = EXCLUDED.batch,
        stage = EXCLUDED.stage,
        status = EXCLUDED.status,
        industry = EXCLUDED.industry,
        subindustry = EXCLUDED.subindustry,
        industries = EXCLUDED.industries,
        tags = EXCLUDED.tags,
        tags_highlighted = EXCLUDED.tags_highlighted,
        regions = EXCLUDED.regions,
        team_size = EXCLUDED.team_size,
        launched_at = EXCLUDED.launched_at,
        small_logo_thumb_url = EXCLUDED.small_logo_thumb_url,
        is_hiring = EXCLUDED.is_hiring,
        nonprofit = EXCLUDED.nonprofit,
        top_company = EXCLUDED.top_company,
        app_video_public = EXCLUDED.app_video_public,
        demo_day_video_public = EXCLUDED.demo_day_video_public,
        yc_url = EXCLUDED.yc_url,
        yc_api_url = EXCLUDED.yc_api_url,
        is_ai_related = EXCLUDED.is_ai_related,
        ai_confidence_score = EXCLUDED.ai_confidence_score,
        sync_status = 'synced',
        last_sync_date = NOW(),
        updated_at = NOW()
    RETURNING id INTO company_id;

    RETURN company_id;
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON FUNCTION upsert_yc_company IS 'Upsert Y Combinator company data with all available API fields including new fields like former_names, all_locations, industries, etc.';