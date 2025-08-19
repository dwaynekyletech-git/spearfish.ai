-- Create HuggingFace Model Discovery Tables
-- Migration created: 2025-08-18
-- Purpose: Support HuggingFace model discovery and tracking for companies

-- =============================================================================
-- Create huggingface_models table (main model data)
-- =============================================================================

CREATE TABLE huggingface_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id TEXT UNIQUE NOT NULL, -- HuggingFace model identifier (e.g., "meta-llama/Llama-2-7b")
    author TEXT NOT NULL, -- Organization or user who created the model
    model_name TEXT NOT NULL, -- Display name of the model
    task TEXT, -- Primary task (e.g., "text-generation", "image-classification")
    framework TEXT, -- Framework used (e.g., "transformers", "diffusers") 
    downloads INTEGER DEFAULT 0, -- Total download count from HF
    likes INTEGER DEFAULT 0, -- Number of likes/hearts on HuggingFace
    trending_score DECIMAL(10,4) DEFAULT 0, -- HuggingFace trending metric
    created_at_hf TIMESTAMP WITH TIME ZONE, -- When model was created on HF
    updated_at_hf TIMESTAMP WITH TIME ZONE, -- When model was last updated on HF
    last_modified_hf TIMESTAMP WITH TIME ZONE, -- Last modification timestamp from HF
    tags JSONB DEFAULT '[]'::jsonb, -- Array of model tags from HF
    library_name TEXT, -- Library name (e.g., "transformers", "sentence-transformers")
    pipeline_tag TEXT, -- Pipeline tag for the model
    model_index JSONB DEFAULT '{}'::jsonb, -- Performance metrics and model card data
    private BOOLEAN DEFAULT false, -- Whether the model is private
    gated BOOLEAN DEFAULT false, -- Whether the model requires approval to access
    disabled BOOLEAN DEFAULT false, -- Whether the model is disabled
    sha TEXT, -- Git SHA of the model repository
    model_card_url TEXT, -- URL to the model card
    repository_url TEXT, -- URL to the HF repository
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- Create huggingface_model_metrics table (historical tracking)
-- =============================================================================

CREATE TABLE huggingface_model_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id UUID NOT NULL REFERENCES huggingface_models(id) ON DELETE CASCADE,
    downloads INTEGER NOT NULL,
    likes INTEGER NOT NULL,
    trending_score DECIMAL(10,4) DEFAULT 0,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- Create company_huggingface_models junction table (associations)
-- =============================================================================

CREATE TABLE company_huggingface_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    model_id UUID NOT NULL REFERENCES huggingface_models(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT false, -- Mark primary model for the company
    discovery_method TEXT DEFAULT 'manual' CHECK (discovery_method IN ('manual', 'organization', 'author', 'search', 'website')),
    confidence_score DECIMAL(3,2) DEFAULT 1.0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    notes TEXT, -- Additional context about this association
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, model_id) -- Prevent duplicate associations
);

-- =============================================================================
-- Create huggingface_sync_logs table (tracking synchronization)
-- =============================================================================

CREATE TABLE huggingface_sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental', 'model', 'metrics', 'discovery')),
    model_id UUID REFERENCES huggingface_models(id) ON DELETE SET NULL,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'partial')),
    models_processed INTEGER DEFAULT 0,
    models_total INTEGER DEFAULT 0,
    error_message TEXT,
    rate_limit_remaining INTEGER,
    duration_seconds INTEGER,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- Create indexes for performance
-- =============================================================================

-- Primary lookup indexes
CREATE INDEX idx_huggingface_models_model_id ON huggingface_models(model_id);
CREATE INDEX idx_huggingface_models_author ON huggingface_models(author);
CREATE INDEX idx_huggingface_models_task ON huggingface_models(task);
CREATE INDEX idx_huggingface_models_framework ON huggingface_models(framework);
CREATE INDEX idx_huggingface_models_downloads ON huggingface_models(downloads DESC);
CREATE INDEX idx_huggingface_models_likes ON huggingface_models(likes DESC);
CREATE INDEX idx_huggingface_models_trending_score ON huggingface_models(trending_score DESC);
CREATE INDEX idx_huggingface_models_last_synced_at ON huggingface_models(last_synced_at);
CREATE INDEX idx_huggingface_models_private ON huggingface_models(private);
CREATE INDEX idx_huggingface_models_gated ON huggingface_models(gated);

-- Metrics table indexes
CREATE INDEX idx_huggingface_model_metrics_model_id ON huggingface_model_metrics(model_id);
CREATE INDEX idx_huggingface_model_metrics_recorded_at ON huggingface_model_metrics(recorded_at DESC);
CREATE INDEX idx_huggingface_model_metrics_downloads ON huggingface_model_metrics(downloads DESC);

-- Association table indexes
CREATE INDEX idx_company_huggingface_models_company_id ON company_huggingface_models(company_id);
CREATE INDEX idx_company_huggingface_models_model_id ON company_huggingface_models(model_id);
CREATE INDEX idx_company_huggingface_models_is_primary ON company_huggingface_models(is_primary);
CREATE INDEX idx_company_huggingface_models_discovery_method ON company_huggingface_models(discovery_method);
CREATE INDEX idx_company_huggingface_models_confidence_score ON company_huggingface_models(confidence_score DESC);

-- Sync logs indexes
CREATE INDEX idx_huggingface_sync_logs_sync_type ON huggingface_sync_logs(sync_type);
CREATE INDEX idx_huggingface_sync_logs_status ON huggingface_sync_logs(status);
CREATE INDEX idx_huggingface_sync_logs_started_at ON huggingface_sync_logs(started_at DESC);
CREATE INDEX idx_huggingface_sync_logs_model_id ON huggingface_sync_logs(model_id);
CREATE INDEX idx_huggingface_sync_logs_company_id ON huggingface_sync_logs(company_id);

-- Composite indexes for common queries
CREATE INDEX idx_huggingface_models_author_downloads ON huggingface_models(author, downloads DESC);
CREATE INDEX idx_huggingface_models_task_likes ON huggingface_models(task, likes DESC);
CREATE INDEX idx_company_huggingface_models_company_primary ON company_huggingface_models(company_id, is_primary DESC);

-- =============================================================================
-- Create updated_at trigger functions
-- =============================================================================

-- Triggers for updated_at columns
CREATE TRIGGER update_huggingface_models_updated_at BEFORE UPDATE ON huggingface_models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_huggingface_models_updated_at BEFORE UPDATE ON company_huggingface_models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Create RLS (Row Level Security) policies
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE huggingface_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE huggingface_model_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_huggingface_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE huggingface_sync_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role to access all data
CREATE POLICY "Service role can access all huggingface_models" ON huggingface_models
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all huggingface_model_metrics" ON huggingface_model_metrics
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all company_huggingface_models" ON company_huggingface_models
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all huggingface_sync_logs" ON huggingface_sync_logs
    FOR ALL USING (auth.role() = 'service_role');

-- Allow authenticated users to read public model data
CREATE POLICY "Authenticated users can read public huggingface_models" ON huggingface_models
    FOR SELECT USING (auth.role() = 'authenticated' AND private = false);

CREATE POLICY "Authenticated users can read huggingface_model_metrics" ON huggingface_model_metrics
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read company_huggingface_models" ON company_huggingface_models
    FOR SELECT USING (auth.role() = 'authenticated');

-- =============================================================================
-- Add comments for documentation
-- =============================================================================

COMMENT ON TABLE huggingface_models IS 'HuggingFace models with metadata and performance tracking';
COMMENT ON TABLE huggingface_model_metrics IS 'Historical tracking of HuggingFace model metrics (downloads, likes, etc.)';
COMMENT ON TABLE company_huggingface_models IS 'Junction table linking companies to their HuggingFace models';
COMMENT ON TABLE huggingface_sync_logs IS 'Logs for tracking HuggingFace data synchronization operations';

COMMENT ON COLUMN huggingface_models.model_id IS 'Unique HuggingFace model identifier (author/model-name format)';
COMMENT ON COLUMN huggingface_models.author IS 'Organization or user who published the model';
COMMENT ON COLUMN huggingface_models.downloads IS 'Total download count from HuggingFace';
COMMENT ON COLUMN huggingface_models.likes IS 'Number of likes/hearts on HuggingFace';
COMMENT ON COLUMN huggingface_models.trending_score IS 'HuggingFace trending metric for discoverability';
COMMENT ON COLUMN huggingface_models.tags IS 'Array of model tags from HuggingFace (e.g., ["llm", "transformers"])';
COMMENT ON COLUMN huggingface_models.model_index IS 'Performance metrics and model card data as JSON';
COMMENT ON COLUMN huggingface_models.gated IS 'Whether the model requires approval to access';

COMMENT ON COLUMN company_huggingface_models.discovery_method IS 'How this association was discovered: organization, author, search, website, manual';
COMMENT ON COLUMN company_huggingface_models.confidence_score IS 'Confidence in the association accuracy (0.0-1.0)';
COMMENT ON COLUMN company_huggingface_models.is_primary IS 'Whether this is the primary/flagship model for the company';

-- =============================================================================
-- Create helper functions for data quality
-- =============================================================================

-- Function to get HuggingFace data quality metrics
CREATE OR REPLACE FUNCTION get_huggingface_data_quality()
RETURNS TABLE (
    total_models BIGINT,
    total_associations BIGINT,
    companies_with_models BIGINT,
    avg_confidence_score NUMERIC,
    discovery_methods JSONB
) 
LANGUAGE SQL
SECURITY DEFINER
AS $$
    SELECT 
        (SELECT COUNT(*) FROM huggingface_models)::BIGINT as total_models,
        (SELECT COUNT(*) FROM company_huggingface_models)::BIGINT as total_associations,
        (SELECT COUNT(DISTINCT company_id) FROM company_huggingface_models)::BIGINT as companies_with_models,
        (SELECT ROUND(AVG(confidence_score), 3) FROM company_huggingface_models) as avg_confidence_score,
        (SELECT jsonb_object_agg(discovery_method, count) 
         FROM (
             SELECT discovery_method, COUNT(*) as count 
             FROM company_huggingface_models 
             GROUP BY discovery_method
         ) as method_counts) as discovery_methods;
$$;

-- Function to clean up old sync logs (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_huggingface_sync_logs()
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
AS $$
    WITH deleted AS (
        DELETE FROM huggingface_sync_logs 
        WHERE created_at < NOW() - INTERVAL '30 days'
        RETURNING id
    )
    SELECT COUNT(*)::INTEGER FROM deleted;
$$;

-- Grant execute permissions to service role
GRANT EXECUTE ON FUNCTION get_huggingface_data_quality() TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_huggingface_sync_logs() TO service_role;