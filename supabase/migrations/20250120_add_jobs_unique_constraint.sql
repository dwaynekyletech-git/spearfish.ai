-- Add unique constraint for job deduplication
-- This ensures we don't import the same job multiple times

-- Add unique constraint on company_id and apify_job_id combination
ALTER TABLE company_jobs 
ADD CONSTRAINT unique_company_apify_job 
UNIQUE (company_id, apify_job_id);

-- Also add an index for better performance on job lookups
CREATE INDEX IF NOT EXISTS idx_company_jobs_apify_job_id ON company_jobs(apify_job_id) WHERE apify_job_id IS NOT NULL;