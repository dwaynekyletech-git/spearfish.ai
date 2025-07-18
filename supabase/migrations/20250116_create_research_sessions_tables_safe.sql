-- Safe migration for research sessions tables
-- This migration creates tables only if they don't exist and adds missing columns

-- Create company_research_sessions table if it doesn't exist
CREATE TABLE IF NOT EXISTS company_research_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
    session_type TEXT NOT NULL CHECK (session_type IN ('initial_research', 'deep_research', 'competitive_analysis', 'market_analysis', 'follow_up')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
    research_query TEXT NOT NULL,
    api_provider TEXT NOT NULL DEFAULT 'perplexity' CHECK (api_provider IN ('perplexity', 'openai', 'anthropic')),
    cost_usd DECIMAL(10, 4) DEFAULT 0.0000,
    tokens_used INTEGER DEFAULT 0,
    session_metadata JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create research_findings table if it doesn't exist
CREATE TABLE IF NOT EXISTS research_findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES company_research_sessions(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    finding_type TEXT NOT NULL CHECK (finding_type IN ('problem_identified', 'market_opportunity', 'competitive_insight', 'tech_trend', 'business_model', 'funding_status', 'team_insight', 'product_analysis')),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    confidence_score DECIMAL(3, 2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    priority_level TEXT NOT NULL DEFAULT 'medium' CHECK (priority_level IN ('low', 'medium', 'high', 'critical')),
    citations JSONB DEFAULT '[]'::jsonb,
    tags TEXT[] DEFAULT '{}',
    structured_data JSONB DEFAULT '{}'::jsonb,
    is_verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to existing tables if they don't exist
-- For company_research_sessions table
DO $$
BEGIN
    -- Add session_type column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'company_research_sessions' 
                   AND column_name = 'session_type') THEN
        ALTER TABLE company_research_sessions 
        ADD COLUMN session_type TEXT NOT NULL DEFAULT 'deep_research' 
        CHECK (session_type IN ('initial_research', 'deep_research', 'competitive_analysis', 'market_analysis', 'follow_up'));
    END IF;

    -- Add api_provider column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'company_research_sessions' 
                   AND column_name = 'api_provider') THEN
        ALTER TABLE company_research_sessions 
        ADD COLUMN api_provider TEXT NOT NULL DEFAULT 'perplexity' 
        CHECK (api_provider IN ('perplexity', 'openai', 'anthropic'));
    END IF;

    -- Add cost_usd column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'company_research_sessions' 
                   AND column_name = 'cost_usd') THEN
        ALTER TABLE company_research_sessions 
        ADD COLUMN cost_usd DECIMAL(10, 4) DEFAULT 0.0000;
    END IF;

    -- Add tokens_used column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'company_research_sessions' 
                   AND column_name = 'tokens_used') THEN
        ALTER TABLE company_research_sessions 
        ADD COLUMN tokens_used INTEGER DEFAULT 0;
    END IF;

    -- Add session_metadata column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'company_research_sessions' 
                   AND column_name = 'session_metadata') THEN
        ALTER TABLE company_research_sessions 
        ADD COLUMN session_metadata JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- Add error_message column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'company_research_sessions' 
                   AND column_name = 'error_message') THEN
        ALTER TABLE company_research_sessions 
        ADD COLUMN error_message TEXT;
    END IF;

    -- Add started_at column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'company_research_sessions' 
                   AND column_name = 'started_at') THEN
        ALTER TABLE company_research_sessions 
        ADD COLUMN started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;

    -- Add completed_at column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'company_research_sessions' 
                   AND column_name = 'completed_at') THEN
        ALTER TABLE company_research_sessions 
        ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Create indexes only if they don't exist
CREATE INDEX IF NOT EXISTS idx_research_sessions_company_id ON company_research_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_research_sessions_created_by ON company_research_sessions(created_by);
CREATE INDEX IF NOT EXISTS idx_research_sessions_session_type ON company_research_sessions(session_type);
CREATE INDEX IF NOT EXISTS idx_research_sessions_status ON company_research_sessions(status);
CREATE INDEX IF NOT EXISTS idx_research_sessions_api_provider ON company_research_sessions(api_provider);
CREATE INDEX IF NOT EXISTS idx_research_sessions_started_at ON company_research_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_research_sessions_completed_at ON company_research_sessions(completed_at);

CREATE INDEX IF NOT EXISTS idx_research_findings_session_id ON research_findings(session_id);
CREATE INDEX IF NOT EXISTS idx_research_findings_company_id ON research_findings(company_id);
CREATE INDEX IF NOT EXISTS idx_research_findings_finding_type ON research_findings(finding_type);
CREATE INDEX IF NOT EXISTS idx_research_findings_priority_level ON research_findings(priority_level);
CREATE INDEX IF NOT EXISTS idx_research_findings_confidence_score ON research_findings(confidence_score);
CREATE INDEX IF NOT EXISTS idx_research_findings_is_verified ON research_findings(is_verified);
CREATE INDEX IF NOT EXISTS idx_research_findings_verified_by ON research_findings(verified_by);
CREATE INDEX IF NOT EXISTS idx_research_findings_tags ON research_findings USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_research_findings_structured_data ON research_findings USING GIN(structured_data);

-- Create updated_at triggers only if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_research_sessions_updated_at') THEN
        CREATE TRIGGER update_research_sessions_updated_at 
        BEFORE UPDATE ON company_research_sessions
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_research_findings_updated_at') THEN
        CREATE TRIGGER update_research_findings_updated_at 
        BEFORE UPDATE ON research_findings
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Enable RLS if not already enabled
ALTER TABLE company_research_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_findings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Users can view research sessions for their company" ON company_research_sessions;
DROP POLICY IF EXISTS "Users can create research sessions for their company" ON company_research_sessions;
DROP POLICY IF EXISTS "Users can update research sessions they created" ON company_research_sessions;
DROP POLICY IF EXISTS "Users can delete research sessions they created" ON company_research_sessions;

DROP POLICY IF EXISTS "Users can view research findings for their company" ON research_findings;
DROP POLICY IF EXISTS "Users can create research findings for their company sessions" ON research_findings;
DROP POLICY IF EXISTS "Users can update research findings for their company" ON research_findings;
DROP POLICY IF EXISTS "Users can delete research findings for their company" ON research_findings;

-- Create RLS policies for company_research_sessions
CREATE POLICY "Users can view research sessions for their company" ON company_research_sessions
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM user_profiles WHERE clerk_user_id = auth.jwt() ->> 'sub'
        )
    );

CREATE POLICY "Users can create research sessions for their company" ON company_research_sessions
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM user_profiles WHERE clerk_user_id = auth.jwt() ->> 'sub'
        )
        AND created_by IN (
            SELECT id FROM user_profiles WHERE clerk_user_id = auth.jwt() ->> 'sub'
        )
    );

CREATE POLICY "Users can update research sessions they created" ON company_research_sessions
    FOR UPDATE USING (
        created_by IN (
            SELECT id FROM user_profiles WHERE clerk_user_id = auth.jwt() ->> 'sub'
        )
    );

CREATE POLICY "Users can delete research sessions they created" ON company_research_sessions
    FOR DELETE USING (
        created_by IN (
            SELECT id FROM user_profiles WHERE clerk_user_id = auth.jwt() ->> 'sub'
        )
    );

-- Create RLS policies for research_findings
CREATE POLICY "Users can view research findings for their company" ON research_findings
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM user_profiles WHERE clerk_user_id = auth.jwt() ->> 'sub'
        )
    );

CREATE POLICY "Users can create research findings for their company sessions" ON research_findings
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM user_profiles WHERE clerk_user_id = auth.jwt() ->> 'sub'
        )
        AND session_id IN (
            SELECT id FROM company_research_sessions WHERE company_id IN (
                SELECT company_id FROM user_profiles WHERE clerk_user_id = auth.jwt() ->> 'sub'
            )
        )
    );

CREATE POLICY "Users can update research findings for their company" ON research_findings
    FOR UPDATE USING (
        company_id IN (
            SELECT company_id FROM user_profiles WHERE clerk_user_id = auth.jwt() ->> 'sub'
        )
    );

CREATE POLICY "Users can delete research findings for their company" ON research_findings
    FOR DELETE USING (
        company_id IN (
            SELECT company_id FROM user_profiles WHERE clerk_user_id = auth.jwt() ->> 'sub'
        )
    );

-- Add helpful comments
COMMENT ON TABLE company_research_sessions IS 'Research sessions for companies using AI research APIs';
COMMENT ON TABLE research_findings IS 'Structured findings from company research sessions';

COMMENT ON COLUMN company_research_sessions.session_type IS 'Type of research: initial_research, deep_research, competitive_analysis, market_analysis, follow_up';
COMMENT ON COLUMN company_research_sessions.status IS 'Session status: pending, in_progress, completed, failed, cancelled';
COMMENT ON COLUMN company_research_sessions.cost_usd IS 'Cost in USD for this research session';
COMMENT ON COLUMN company_research_sessions.tokens_used IS 'Number of tokens consumed in this session';
COMMENT ON COLUMN company_research_sessions.session_metadata IS 'Additional metadata about the research session';

COMMENT ON COLUMN research_findings.finding_type IS 'Type of finding: problem_identified, market_opportunity, competitive_insight, tech_trend, business_model, funding_status, team_insight, product_analysis';
COMMENT ON COLUMN research_findings.confidence_score IS 'Confidence score from 0.0 to 1.0 for this finding';
COMMENT ON COLUMN research_findings.priority_level IS 'Priority level: low, medium, high, critical';
COMMENT ON COLUMN research_findings.citations IS 'Array of citation objects with source URLs and metadata';
COMMENT ON COLUMN research_findings.tags IS 'Array of tags for categorization and filtering';
COMMENT ON COLUMN research_findings.structured_data IS 'Additional structured data specific to the finding type';
COMMENT ON COLUMN research_findings.is_verified IS 'Whether this finding has been manually verified';