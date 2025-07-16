/**
 * API Route: Apply Star Growth Function Fix
 * 
 * Apply the migration to fix the ambiguous column reference in calculate_star_growth function
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    console.log('Applying star growth function fix...');

    const supabase = await createServerClient();

    // Apply the SQL fix directly via raw SQL
    const { error: dropError } = await supabase.rpc('exec_sql', { 
      sql: 'DROP FUNCTION IF EXISTS calculate_star_growth(UUID, INTEGER);' 
    });

    if (dropError) {
      console.log('Drop function result:', dropError);
    }

    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION calculate_star_growth(
          repo_id UUID,
          days_period INTEGER DEFAULT 30
      ) RETURNS TABLE (
          repository_id UUID,
          start_stars INTEGER,
          end_stars INTEGER,
          star_growth INTEGER,
          growth_percentage DECIMAL,
          period_days INTEGER,
          monthly_growth_rate DECIMAL
      ) AS $$
      BEGIN
          RETURN QUERY
          WITH period_metrics AS (
              SELECT 
                  m.repository_id,
                  m.stars_count,
                  m.recorded_at,
                  ROW_NUMBER() OVER (PARTITION BY m.repository_id ORDER BY m.recorded_at ASC) as first_row,
                  ROW_NUMBER() OVER (PARTITION BY m.repository_id ORDER BY m.recorded_at DESC) as last_row
              FROM github_repository_metrics m
              WHERE m.repository_id = repo_id
                  AND m.recorded_at >= NOW() - (days_period || ' days')::INTERVAL
          ),
          start_metric AS (
              SELECT pm.repository_id, pm.stars_count as start_stars
              FROM period_metrics pm
              WHERE pm.first_row = 1
          ),
          end_metric AS (
              SELECT pm.repository_id, pm.stars_count as end_stars
              FROM period_metrics pm
              WHERE pm.last_row = 1
          )
          SELECT 
              repo_id as repository_id,
              COALESCE(s.start_stars, 0) as start_stars,
              COALESCE(e.end_stars, 0) as end_stars,
              COALESCE(e.end_stars, 0) - COALESCE(s.start_stars, 0) as star_growth,
              CASE 
                  WHEN COALESCE(s.start_stars, 0) > 0 
                  THEN ((COALESCE(e.end_stars, 0) - COALESCE(s.start_stars, 0))::DECIMAL / s.start_stars * 100)
                  ELSE NULL
              END as growth_percentage,
              days_period as period_days,
              CASE 
                  WHEN COALESCE(s.start_stars, 0) > 0 AND days_period > 0
                  THEN ((COALESCE(e.end_stars, 0) - COALESCE(s.start_stars, 0))::DECIMAL / days_period * 30)
                  ELSE NULL
              END as monthly_growth_rate
          FROM (
              SELECT 
                  repo_id as repository_id,
                  COALESCE(s.start_stars, 0) as start_stars,
                  COALESCE(e.end_stars, 0) as end_stars
              FROM start_metric s
              FULL OUTER JOIN end_metric e ON s.repository_id = e.repository_id
              
              UNION ALL
              
              SELECT 
                  repo_id as repository_id,
                  0 as start_stars,
                  0 as end_stars
              WHERE NOT EXISTS (SELECT 1 FROM start_metric) 
                AND NOT EXISTS (SELECT 1 FROM end_metric)
          ) bd
          LIMIT 1;
      END;
      $$ LANGUAGE plpgsql;
    `;

    const { error: createError } = await supabase.rpc('exec_sql', { sql: createFunctionSQL });

    if (createError) {
      throw new Error(`Create function failed: ${createError.message}`);
    }

    console.log('✅ Star growth function fix applied successfully');

    return NextResponse.json({
      success: true,
      message: 'Star growth function fix applied successfully',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Failed to apply star growth function fix:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    }, { 
      status: 500 
    });
  }
}