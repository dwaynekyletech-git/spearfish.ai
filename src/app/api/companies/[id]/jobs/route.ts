/**
 * Company Jobs API Route
 * 
 * Handles fetching job listings for a specific company from the database.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '../../../../../lib/supabase-server';
import { z } from 'zod';

// Job response schema for type safety
const JobSchema = z.object({
  id: z.string(),
  company_id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  apply_url: z.string().nullable(),
  salary: z.string().nullable(),
  years_experience: z.string().nullable(),
  job_type: z.string().nullable(),
  experience_level: z.string().nullable(),
  department: z.string().nullable(),
  remote_ok: z.boolean(),
  is_active: z.boolean(),
  posted_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string()
});

type Job = z.infer<typeof JobSchema>;

interface JobsResponse {
  success: boolean;
  data?: Job[];
  count?: number;
  error?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<JobsResponse>> {
  try {
    const supabase = createServiceClient();
    const companyId = params.id;

    // Validate company ID format (UUID)
    if (!companyId || !companyId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid company ID format'
      }, { status: 400 });
    }

    // Parse query parameters
    const url = new URL(request.url);
    const activeOnly = url.searchParams.get('active') !== 'false'; // Default to active jobs only
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100); // Max 100 jobs
    const remoteOnly = url.searchParams.get('remote') === 'true';
    const department = url.searchParams.get('department');
    const experienceLevel = url.searchParams.get('experience_level');

    // Build query
    let query = supabase
      .from('company_jobs')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    if (remoteOnly) {
      query = query.eq('remote_ok', true);
    }

    if (department) {
      query = query.eq('department', department);
    }

    if (experienceLevel) {
      query = query.eq('experience_level', experienceLevel);
    }

    // Apply limit
    query = query.limit(limit);

    const { data: jobs, error } = await query;

    if (error) {
      console.error('Database error fetching jobs:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch jobs'
      }, { status: 500 });
    }

    // Validate and transform the data
    const validatedJobs = jobs?.map((job: any) => {
      try {
        return JobSchema.parse(job);
      } catch (validationError) {
        console.warn('Job validation failed:', validationError, job);
        return null;
      }
    }).filter(Boolean) || [];

    return NextResponse.json({
      success: true,
      data: validatedJobs as Job[],
      count: validatedJobs.length
    });

  } catch (error) {
    console.error('Error in jobs API route:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// Optional: POST endpoint for manual job sync (if needed in the future)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  return NextResponse.json({
    success: false,
    error: 'Job sync not implemented - jobs are imported via JSON import service'
  }, { status: 501 });
}