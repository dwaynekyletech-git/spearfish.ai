-- Fix RLS policies for score_history table to allow authenticated users to read their data

-- Enable RLS on score_history table (if not already enabled)
ALTER TABLE score_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view score history" ON score_history;
DROP POLICY IF EXISTS "Service role can manage score history" ON score_history;
DROP POLICY IF EXISTS "Authenticated users can view score history" ON score_history;

-- Create policy for authenticated users to view score history
-- This allows any authenticated user to read score history records
CREATE POLICY "Authenticated users can view score history" 
ON score_history FOR SELECT 
TO authenticated 
USING (true);

-- Create policy for service role to manage all score history records
CREATE POLICY "Service role can manage score history" 
ON score_history FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Create policy for authenticated users to view score history associated with companies they can access
-- This is more restrictive - users can only see score history for companies they have access to
/*
CREATE POLICY "Users can view accessible company score history" 
ON score_history FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM companies 
    WHERE companies.id = score_history.company_id
  )
);
*/

-- Grant basic permissions
GRANT SELECT ON score_history TO authenticated;
GRANT ALL ON score_history TO service_role;