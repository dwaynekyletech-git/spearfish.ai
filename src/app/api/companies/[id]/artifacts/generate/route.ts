import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import ProjectIdeaGenerator, { ProjectGenerationConfigSchema } from '@/lib/agent-project-generator';
import { getGlobalResearchService } from '@/lib/company-research-service';

// Request schema
const GenerateArtifactsRequestSchema = z.object({
  research_session_id: z.string().uuid(),
  config: ProjectGenerationConfigSchema.optional()
});

// Response schema
const GenerateArtifactsResponseSchema = z.object({
  success: z.boolean(),
  artifacts: z.array(z.any()).optional(),
  error: z.string().optional(),
  session_id: z.string().optional()
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication check
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse company ID
    const companyId = params.id;
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'Company ID is required' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const validatedRequest = GenerateArtifactsRequestSchema.parse(body);

    // Initialize services
    console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'present' : 'missing');
    console.log('Service role key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'present' : 'missing');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const researchService = getGlobalResearchService();
    const projectGenerator = new ProjectIdeaGenerator();

    // Get company information
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    // Get research session results
    const sessionResults = await researchService.getSessionResults(validatedRequest.research_session_id);
    if (!sessionResults) {
      return NextResponse.json(
        { success: false, error: 'Research session not found or incomplete' },
        { status: 404 }
      );
    }

    // Validate that research session belongs to this company
    if (sessionResults.session.company_id !== companyId) {
      return NextResponse.json(
        { success: false, error: 'Research session does not belong to this company' },
        { status: 403 }
      );
    }

    // Generate project artifacts
    const defaultConfig = {
      maxProjects: 5,
      focusAreas: ['technical', 'business'] as ('technical' | 'business' | 'market' | 'security' | 'optimization')[],
      effortPreference: 'mixed' as const,
      timeframe: 'medium_term' as const,
      riskTolerance: 'medium' as const
    };

    const config = { ...defaultConfig, ...validatedRequest.config };
    
    const artifacts = await projectGenerator.generateProjectIdeas(
      company.name,
      sessionResults.findings,
      config
    );

    // Get the user profile UUID for the created_by field
    console.log('Looking up user profile for Clerk ID:', userId);
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('clerk_user_id', userId)
      .single();

    if (profileError || !userProfile) {
      console.error('Failed to find user profile:', profileError);
      return NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 }
      );
    }

    console.log('Found user profile ID:', userProfile.id);

    // Set the company and user context for each artifact and clean up data for database
    const enrichedArtifacts = artifacts.map(artifact => {
      // Remove the created_at and updated_at fields - let database handle them
      const { created_at, updated_at, ...cleanArtifact } = artifact;
      
      return {
        ...cleanArtifact,
        company_id: companyId,
        research_session_id: validatedRequest.research_session_id,
        created_by: userProfile.id // Use the proper UUID from user_profiles
      };
    });

    // Save artifacts to database
    console.log('Attempting to save artifacts:', enrichedArtifacts.length, 'items');
    console.log('Sample artifact structure:', JSON.stringify(enrichedArtifacts[0], null, 2));
    
    try {
      // First, let's test if we can access the table at all
      console.log('Testing table access...');
      const { data: testData, error: testError, count } = await supabase
        .from('project_artifacts')
        .select('*', { count: 'exact', head: true });
      
      console.log('Table access test - data:', testData);
      console.log('Table access test - error:', testError);
      console.log('Table access test - count:', count);

      // Test service role access by checking if we can see any data
      console.log('Testing service role permissions...');
      const { data: existingData, error: existingError } = await supabase
        .from('project_artifacts')
        .select('id, company_id, created_by')
        .limit(1);
      
      console.log('Existing data test - data:', existingData);
      console.log('Existing data test - error:', existingError);

      // Test a direct SQL query to bypass RLS for debugging
      console.log('Testing direct SQL query...');
      const { data: sqlData, error: sqlError } = await supabase
        .rpc('get_current_user_id');
      
      console.log('SQL test - current user ID:', sqlData);
      console.log('SQL test - error:', sqlError);

      // Test inserting a single simple artifact first
      console.log('Testing simple insert...');
      const testArtifact = {
        ...enrichedArtifacts[0],
        // Ensure all required fields are present
        id: enrichedArtifacts[0].id,
        company_id: companyId,
        research_session_id: validatedRequest.research_session_id,
        created_by: enrichedArtifacts[0].created_by, // This now has the proper UUID
        type: enrichedArtifacts[0].type,
        title: enrichedArtifacts[0].title,
        description: enrichedArtifacts[0].description,
        problem_statement: enrichedArtifacts[0].problem_statement,
        proposed_solution: enrichedArtifacts[0].proposed_solution,
        implementation_approach: enrichedArtifacts[0].implementation_approach,
        estimated_effort: enrichedArtifacts[0].estimated_effort,
        estimated_impact: enrichedArtifacts[0].estimated_impact,
        priority_score: enrichedArtifacts[0].priority_score,
        confidence_score: enrichedArtifacts[0].confidence_score
      };

      console.log('Test artifact keys:', Object.keys(testArtifact));
      console.log('Test artifact values:', {
        id: testArtifact.id,
        company_id: testArtifact.company_id,
        research_session_id: testArtifact.research_session_id,
        created_by: testArtifact.created_by,
        type: testArtifact.type,
        priority_score: testArtifact.priority_score,
        confidence_score: testArtifact.confidence_score
      });

      const { data: singleData, error: singleError } = await supabase
        .from('project_artifacts')
        .insert([testArtifact])
        .select();

      console.log('Single insert - data:', singleData ? `${singleData.length} items` : 'null');
      console.log('Single insert - error:', singleError);

      if (singleError) {
        console.error('❌ Single insert failed:', singleError);
        // Try to get more specific error information
        console.error('Single insert error details:', JSON.stringify(singleError, null, 2));
      } else if (singleData && singleData.length > 0) {
        console.log('✅ Single insert successful, proceeding with batch insert');
        
        // Now try the full batch insert
        const { data: savedData, error: saveError } = await supabase
          .from('project_artifacts')
          .insert(enrichedArtifacts.slice(1)) // Skip the first one we already inserted
          .select();

        if (saveError) {
          console.error('❌ Batch insert failed:', saveError);
        } else {
          console.log('✅ Successfully saved', (savedData?.length || 0) + 1, 'artifacts total');
        }
      }
    } catch (insertError: any) {
      console.error('❌ Exception during database insert:', insertError);
      console.error('Exception type:', typeof insertError);
      console.error('Exception constructor:', insertError?.constructor?.name);
      console.error('Exception stack:', insertError?.stack);
    }

    return NextResponse.json({
      success: true,
      artifacts: enrichedArtifacts,
      session_id: validatedRequest.research_session_id
    });

  } catch (error) {
    console.error('Error generating artifacts:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication check
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const companyId = params.id;
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    // Initialize Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let query = supabase
      .from('project_artifacts')
      .select('*')
      .eq('company_id', companyId)
      .eq('created_by', userId);

    if (sessionId) {
      query = query.eq('research_session_id', sessionId);
    }

    const { data: artifacts, error } = await query
      .order('priority_score', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch artifacts' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      artifacts: artifacts || []
    });

  } catch (error) {
    console.error('Error fetching artifacts:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}