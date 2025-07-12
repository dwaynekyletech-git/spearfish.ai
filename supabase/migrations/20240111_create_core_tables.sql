-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create companies table
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    yc_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    batch TEXT NOT NULL,
    stage TEXT,
    team_size INTEGER,
    is_ai_related BOOLEAN DEFAULT false,
    spearfish_score NUMERIC(3, 2) CHECK (spearfish_score >= 0 AND spearfish_score <= 10),
    github_repos JSONB DEFAULT '[]'::jsonb,
    huggingface_models JSONB DEFAULT '[]'::jsonb,
    website_url TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_profiles table
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clerk_user_id TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    full_name TEXT,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    role TEXT DEFAULT 'member',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create artifacts table
CREATE TABLE artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
    type TEXT NOT NULL CHECK (type IN ('pitch_deck', 'product_roadmap', 'technical_doc', 'marketing_copy', 'other')),
    title TEXT NOT NULL,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_template BOOLEAN DEFAULT false,
    parent_artifact_id UUID REFERENCES artifacts(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_companies_yc_id ON companies(yc_id);
CREATE INDEX idx_companies_batch ON companies(batch);
CREATE INDEX idx_companies_is_ai_related ON companies(is_ai_related);
CREATE INDEX idx_companies_spearfish_score ON companies(spearfish_score);
CREATE INDEX idx_user_profiles_clerk_user_id ON user_profiles(clerk_user_id);
CREATE INDEX idx_user_profiles_company_id ON user_profiles(company_id);
CREATE INDEX idx_artifacts_company_id ON artifacts(company_id);
CREATE INDEX idx_artifacts_created_by ON artifacts(created_by);
CREATE INDEX idx_artifacts_type ON artifacts(type);
CREATE INDEX idx_artifacts_is_template ON artifacts(is_template);
CREATE INDEX idx_artifacts_parent_artifact_id ON artifacts(parent_artifact_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_artifacts_updated_at BEFORE UPDATE ON artifacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE companies IS 'YC companies with AI-related analysis and scores';
COMMENT ON TABLE user_profiles IS 'User profiles synced with Clerk authentication';
COMMENT ON TABLE artifacts IS 'Templates and completed documents for companies';

COMMENT ON COLUMN companies.spearfish_score IS 'AI relevance score from 0-10';
COMMENT ON COLUMN companies.github_repos IS 'Array of GitHub repository URLs';
COMMENT ON COLUMN companies.huggingface_models IS 'Array of HuggingFace model identifiers';
COMMENT ON COLUMN artifacts.type IS 'Type of document: pitch_deck, product_roadmap, technical_doc, marketing_copy, other';
COMMENT ON COLUMN artifacts.is_template IS 'Whether this artifact is a reusable template';
COMMENT ON COLUMN artifacts.parent_artifact_id IS 'Reference to template if this artifact was created from one';