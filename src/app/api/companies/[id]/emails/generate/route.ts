import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase-server';
import EmailTemplateCreator, { EmailGenerationConfigSchema } from '@/lib/agent-email-generator';
import { getGlobalResearchService } from '@/lib/company-research-service';

// Request schema
const GenerateEmailRequestSchema = z.object({
  project_id: z.string().uuid(),
  config: EmailGenerationConfigSchema.optional()
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
    const validatedRequest = GenerateEmailRequestSchema.parse(body);

    // Initialize services
    const supabase = createServiceClient();
    const researchService = getGlobalResearchService();
    const emailCreator = new EmailTemplateCreator();

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

    // Get the user profile UUID for database operations
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

    // Get the project artifact
    const { data: project, error: projectError } = await supabase
      .from('project_artifacts')
      .select('*')
      .eq('id', validatedRequest.project_id)
      .eq('company_id', companyId)
      .eq('created_by', userProfile.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { success: false, error: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    // Get research session data for the project
    const { data: researchSession, error: sessionError } = await supabase
      .from('company_research_sessions')
      .select('*')
      .eq('id', project.research_session_id)
      .single();

    if (sessionError || !researchSession) {
      return NextResponse.json(
        { success: false, error: 'Research session not found' },
        { status: 404 }
      );
    }

    // Get research findings for this session
    const sessionResults = await researchService.getSessionResults(researchSession.id);
    if (!sessionResults) {
      return NextResponse.json(
        { success: false, error: 'Research findings not available' },
        { status: 404 }
      );
    }

    // Prepare company context
    const companyContext = {
      companyName: company.name,
      industry: company.industry,
      size: company.size,
      stage: company.stage,
      keyPeople: [], // Could be populated from research findings
      recentNews: [], // Could be populated from research findings
      techStack: [] // Could be populated from research findings
    };

    // Generate email template
    const template = await emailCreator.generateEmailTemplate(
      project,
      sessionResults.findings,
      companyContext,
      validatedRequest.config || {}
    );

    // Save template to database (optional - for tracking)
    try {
      const { data: savedTemplate, error: saveError } = await supabase
        .from('email_templates')
        .insert([{
          project_artifact_id: project.id,
          company_id: companyId,
          created_by: userProfile.id,
          template_type: template.template_type,
          subject_line: template.subject_line,
          email_body: template.email_body,
          call_to_action: template.call_to_action,
          tone: template.tone,
          personalization_elements: template.personalization_elements,
          research_citations: template.research_citations,
          estimated_response_rate: template.estimated_response_rate,
          a_b_variants: template.A_B_variants,
          metadata: template.metadata
        }])
        .select()
        .single();

      if (saveError) {
        console.error('Failed to save email template:', saveError);
        // Continue anyway - template generation succeeded
      } else {
        console.log('✅ Email template saved to database');
      }
    } catch (dbError) {
      console.error('Database save error:', dbError);
      // Continue anyway - template generation succeeded
    }

    return NextResponse.json({
      success: true,
      template: template
    });

  } catch (error) {
    console.error('Error generating email:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    // Handle OpenAI API errors
    if (error instanceof Error && error.message.includes('OpenAI')) {
      return NextResponse.json(
        { success: false, error: 'AI service unavailable. Please check OpenAI API configuration.' },
        { status: 503 }
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
    const projectId = searchParams.get('project_id');

    // Initialize Supabase
    const supabase = createServiceClient();

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('clerk_user_id', userId)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 }
      );
    }

    // Build query for email templates
    let query = supabase
      .from('email_templates')
      .select('*')
      .eq('company_id', companyId)
      .eq('created_by', userProfile.id);

    if (projectId) {
      query = query.eq('project_artifact_id', projectId);
    }

    const { data: templates, error } = await query
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch email templates' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      templates: templates || []
    });

  } catch (error) {
    console.error('Error fetching email templates:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}