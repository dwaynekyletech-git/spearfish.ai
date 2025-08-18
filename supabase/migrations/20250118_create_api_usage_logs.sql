-- Create API Usage Logs Table for Cost Tracking and Monitoring
-- This migration adds comprehensive API usage tracking for cost optimization

-- Create the api_usage_logs table
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User and session tracking
  user_id TEXT REFERENCES user_profiles(clerk_user_id) ON DELETE CASCADE,
  session_id TEXT,
  request_id TEXT,
  
  -- API call details
  endpoint TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'perplexity')),
  model TEXT NOT NULL,
  task_type TEXT,
  
  -- Token usage and costs
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  tokens_total INTEGER GENERATED ALWAYS AS (COALESCE(tokens_input, 0) + COALESCE(tokens_output, 0)) STORED,
  cost_usd DECIMAL(10, 6) NOT NULL DEFAULT 0.0,
  
  -- Performance metrics
  duration_ms INTEGER,
  cache_hit BOOLEAN DEFAULT false,
  cache_key TEXT,
  
  -- Quality and outcome tracking
  quality_score DECIMAL(3, 2), -- 0.0 to 10.0
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  error_code TEXT,
  
  -- Request metadata
  request_size_bytes INTEGER,
  response_size_bytes INTEGER,
  user_agent TEXT,
  ip_address INET,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Additional metadata stored as JSON
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for performance and common queries
CREATE INDEX IF NOT EXISTS idx_api_usage_user_date ON api_usage_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_cost_date ON api_usage_logs(created_at DESC, cost_usd DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_provider_model ON api_usage_logs(provider, model, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_task_type ON api_usage_logs(task_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_session ON api_usage_logs(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_cache_hit ON api_usage_logs(cache_hit, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_success ON api_usage_logs(success, created_at DESC);

-- Partial index for failed requests (for monitoring)
CREATE INDEX IF NOT EXISTS idx_api_usage_errors ON api_usage_logs(created_at DESC, error_code) WHERE success = false;

-- GIN index for metadata queries
CREATE INDEX IF NOT EXISTS idx_api_usage_metadata ON api_usage_logs USING GIN (metadata);

-- Create a function to calculate daily cost summaries
CREATE OR REPLACE FUNCTION get_daily_cost_summary(
  target_user_id TEXT DEFAULT NULL,
  target_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  user_id TEXT,
  date DATE,
  total_cost_usd DECIMAL(10, 6),
  request_count BIGINT,
  cache_hit_count BIGINT,
  cache_hit_rate DECIMAL(5, 2),
  openai_cost DECIMAL(10, 6),
  perplexity_cost DECIMAL(10, 6),
  avg_duration_ms DECIMAL(10, 2),
  error_count BIGINT,
  error_rate DECIMAL(5, 2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    aul.user_id,
    target_date as date,
    COALESCE(SUM(aul.cost_usd), 0) as total_cost_usd,
    COUNT(*) as request_count,
    COUNT(*) FILTER (WHERE aul.cache_hit = true) as cache_hit_count,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        ROUND((COUNT(*) FILTER (WHERE aul.cache_hit = true)::DECIMAL / COUNT(*)) * 100, 2)
      ELSE 0 
    END as cache_hit_rate,
    COALESCE(SUM(aul.cost_usd) FILTER (WHERE aul.provider = 'openai'), 0) as openai_cost,
    COALESCE(SUM(aul.cost_usd) FILTER (WHERE aul.provider = 'perplexity'), 0) as perplexity_cost,
    COALESCE(AVG(aul.duration_ms), 0) as avg_duration_ms,
    COUNT(*) FILTER (WHERE aul.success = false) as error_count,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        ROUND((COUNT(*) FILTER (WHERE aul.success = false)::DECIMAL / COUNT(*)) * 100, 2)
      ELSE 0 
    END as error_rate
  FROM api_usage_logs aul
  WHERE 
    (target_user_id IS NULL OR aul.user_id = target_user_id)
    AND DATE(aul.created_at) = target_date
  GROUP BY aul.user_id;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get cost trends
CREATE OR REPLACE FUNCTION get_cost_trends(
  target_user_id TEXT DEFAULT NULL,
  days_back INTEGER DEFAULT 7
)
RETURNS TABLE (
  date DATE,
  total_cost_usd DECIMAL(10, 6),
  request_count BIGINT,
  cache_hit_rate DECIMAL(5, 2),
  avg_cost_per_request DECIMAL(10, 6)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(aul.created_at) as date,
    COALESCE(SUM(aul.cost_usd), 0) as total_cost_usd,
    COUNT(*) as request_count,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        ROUND((COUNT(*) FILTER (WHERE aul.cache_hit = true)::DECIMAL / COUNT(*)) * 100, 2)
      ELSE 0 
    END as cache_hit_rate,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        ROUND(SUM(aul.cost_usd) / COUNT(*), 6)
      ELSE 0 
    END as avg_cost_per_request
  FROM api_usage_logs aul
  WHERE 
    (target_user_id IS NULL OR aul.user_id = target_user_id)
    AND aul.created_at >= CURRENT_DATE - INTERVAL '%s days' 
  GROUP BY DATE(aul.created_at)
  ORDER BY date DESC;
END;
$$ LANGUAGE plpgsql;

-- Create a view for real-time monitoring
CREATE OR REPLACE VIEW api_usage_realtime AS
SELECT 
  aul.id,
  aul.user_id,
  aul.provider,
  aul.model,
  aul.task_type,
  aul.cost_usd,
  aul.tokens_total,
  aul.duration_ms,
  aul.cache_hit,
  aul.success,
  aul.created_at,
  up.email as user_email
FROM api_usage_logs aul
LEFT JOIN user_profiles up ON aul.user_id = up.clerk_user_id
WHERE aul.created_at >= NOW() - INTERVAL '1 hour'
ORDER BY aul.created_at DESC;

-- Create a materialized view for daily aggregates (for performance)
CREATE MATERIALIZED VIEW IF NOT EXISTS api_usage_daily_summary AS
SELECT 
  DATE(created_at) as date,
  user_id,
  provider,
  model,
  COUNT(*) as request_count,
  SUM(cost_usd) as total_cost_usd,
  SUM(tokens_input) as total_tokens_input,
  SUM(tokens_output) as total_tokens_output,
  AVG(duration_ms) as avg_duration_ms,
  COUNT(*) FILTER (WHERE cache_hit = true) as cache_hits,
  COUNT(*) FILTER (WHERE success = false) as error_count,
  MIN(created_at) as first_request_at,
  MAX(created_at) as last_request_at
FROM api_usage_logs
GROUP BY DATE(created_at), user_id, provider, model;

-- Create index on the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_usage_daily_summary_unique 
ON api_usage_daily_summary(date, user_id, provider, model);

-- Create function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_daily_usage_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY api_usage_daily_summary;
END;
$$ LANGUAGE plpgsql;

-- Set up Row Level Security (RLS)
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own usage logs
CREATE POLICY "Users can view own API usage" ON api_usage_logs
  FOR SELECT 
  USING (
    auth.uid()::text = user_id 
    OR 
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE clerk_user_id = auth.uid()::text 
      AND role IN ('admin', 'owner')
    )
  );

-- Policy: Service role can insert usage logs
CREATE POLICY "Service can insert API usage logs" ON api_usage_logs
  FOR INSERT 
  WITH CHECK (true);

-- Policy: Service role can update usage logs (for completion timestamps, etc.)
CREATE POLICY "Service can update API usage logs" ON api_usage_logs
  FOR UPDATE 
  USING (true);

-- Policy: Admins can view all usage logs
CREATE POLICY "Admins can view all API usage" ON api_usage_logs
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE clerk_user_id = auth.uid()::text 
      AND role IN ('admin', 'owner')
    )
  );

-- Grant necessary permissions
GRANT SELECT ON api_usage_logs TO authenticated;
GRANT INSERT ON api_usage_logs TO service_role;
GRANT UPDATE ON api_usage_logs TO service_role;
GRANT DELETE ON api_usage_logs TO service_role;

-- Grant permissions on the functions and views
GRANT EXECUTE ON FUNCTION get_daily_cost_summary(TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_cost_trends(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_daily_usage_summary() TO service_role;
GRANT SELECT ON api_usage_realtime TO authenticated;
GRANT SELECT ON api_usage_daily_summary TO authenticated;

-- Add comment to document the table
COMMENT ON TABLE api_usage_logs IS 'Comprehensive API usage tracking for cost optimization and monitoring';
COMMENT ON COLUMN api_usage_logs.cost_usd IS 'Actual cost in USD for this API call';
COMMENT ON COLUMN api_usage_logs.cache_hit IS 'Whether this request was served from cache';
COMMENT ON COLUMN api_usage_logs.task_type IS 'Type of AI task performed (for model selection optimization)';
COMMENT ON COLUMN api_usage_logs.metadata IS 'Additional request metadata stored as JSON';

-- Create a trigger to automatically update completed_at when request finishes
CREATE OR REPLACE FUNCTION update_api_usage_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  -- If duration_ms is being set and completed_at is null, set completed_at
  IF NEW.duration_ms IS NOT NULL AND OLD.duration_ms IS NULL AND NEW.completed_at IS NULL THEN
    NEW.completed_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_completed_at
  BEFORE UPDATE ON api_usage_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_api_usage_completed_at();

-- Create a cleanup function to remove old logs (keep 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_api_usage_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM api_usage_logs 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  -- Also refresh the materialized view after cleanup
  PERFORM refresh_daily_usage_summary();
END;
$$ LANGUAGE plpgsql;

-- Add helpful comments for monitoring queries
COMMENT ON FUNCTION get_daily_cost_summary IS 'Get comprehensive daily cost summary for a user or globally';
COMMENT ON FUNCTION get_cost_trends IS 'Get cost trends over the specified number of days';
COMMENT ON FUNCTION refresh_daily_usage_summary IS 'Refresh the daily usage summary materialized view';
COMMENT ON FUNCTION cleanup_old_api_usage_logs IS 'Remove API usage logs older than 90 days';

-- Example queries for monitoring (as comments)
/*
-- Get today's costs for a specific user
SELECT * FROM get_daily_cost_summary('user_123', CURRENT_DATE);

-- Get global costs for today
SELECT * FROM get_daily_cost_summary(NULL, CURRENT_DATE);

-- Get cost trends for the last 7 days
SELECT * FROM get_cost_trends(NULL, 7);

-- Get recent high-cost requests
SELECT user_id, provider, model, cost_usd, tokens_total, created_at 
FROM api_usage_logs 
WHERE cost_usd > 0.01 
ORDER BY created_at DESC 
LIMIT 10;

-- Get cache hit rates by model
SELECT 
  provider, 
  model, 
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE cache_hit = true) as cache_hits,
  ROUND((COUNT(*) FILTER (WHERE cache_hit = true)::DECIMAL / COUNT(*)) * 100, 2) as hit_rate_percent
FROM api_usage_logs 
WHERE created_at >= CURRENT_DATE 
GROUP BY provider, model 
ORDER BY total_requests DESC;

-- Get users approaching their daily limits
WITH user_costs AS (
  SELECT user_id, SUM(cost_usd) as daily_cost
  FROM api_usage_logs 
  WHERE DATE(created_at) = CURRENT_DATE 
  GROUP BY user_id
)
SELECT uc.user_id, uc.daily_cost, up.email
FROM user_costs uc
JOIN user_profiles up ON uc.user_id = up.clerk_user_id
WHERE uc.daily_cost > 8.0  -- Approaching $10 limit
ORDER BY uc.daily_cost DESC;
*/