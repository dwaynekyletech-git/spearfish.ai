import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import EmailTemplateCreator, { EmailGenerationConfigSchema } from '@/lib/agent-email-generator';
import { getGlobalResearchService } from '@/lib/company-research-service';

// Request schema
const GenerateEmailRequestSchema = z.object({
  config: EmailGenerationConfigSchema.optional(),
  target_person: z.object({
    name: z.string().optional(),
    role: z.string().optional(),
    email: z.string().email().optional()
  }).optional()
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; artifactId: string } }
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

    // Parse parameters
    const companyId = params.id;
    const artifactId = params.artifactId;

    if (!companyId || !artifactId) {
      return NextResponse.json(
        { success: false, error: 'Company ID and Artifact ID are required' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const validatedRequest = GenerateEmailRequestSchema.parse(body);

    // Initialize services
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const emailGenerator = new EmailTemplateCreator();
    const researchService = getGlobalResearchService();

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

    // Get project artifact
    const { data: artifact, error: artifactError } = await supabase
      .from('project_artifacts')
      .select('*')
      .eq('id', artifactId)
      .eq('company_id', companyId)
      .eq('created_by', userId)
      .single();

    if (artifactError || !artifact) {
      return NextResponse.json(
        { success: false, error: 'Project artifact not found' },
        { status: 404 }
      );
    }

    // Get research findings from the research session
    const sessionResults = await researchService.getSessionResults(artifact.research_session_id);
    if (!sessionResults) {
      return NextResponse.json(
        { success: false, error: 'Research session results not found' },
        { status: 404 }
      );
    }

    // Build company context
    const companyContext = {
      companyName: company.name,
      industry: company.industry,
      size: company.team_size ? `${company.team_size} employees` : undefined,
      stage: company.stage,
      techStack: company.github_repos ? 
        Object.keys(company.github_repos as Record<string, any>) : undefined,
      keyPeople: validatedRequest.target_person ? [
        {
          name: validatedRequest.target_person.name || 'Team member',
          role: validatedRequest.target_person.role || 'Technical Lead',
          background: undefined
        }
      ] : undefined
    };

    // Default email configuration
    const defaultConfig = {
      tone: 'professional' as const,
      length: 'medium' as const,
      includeCredentials: false,
      includePortfolio: false,
      focusOnValue: true,
      createVariants: false,
      targetPersona: 'technical_lead' as const,
      urgencyLevel: 'medium' as const
    };

    const config = { ...defaultConfig, ...validatedRequest.config };

    // Generate email template
    const emailTemplate = await emailGenerator.generateEmailTemplate(
      artifact,
      sessionResults.findings,
      companyContext,
      config
    );

    // Save email template to database
    const { error: saveError } = await supabase
      .from('email_templates')
      .insert([emailTemplate]);

    if (saveError) {
      console.error('Failed to save email template:', saveError);
      // Continue anyway - return the generated template even if save fails
    }

    // Generate follow-up sequence if requested
    let followUpSequence = undefined;
    if (config.createVariants) {
      try {
        followUpSequence = await emailGenerator.generateFollowUpSequence(emailTemplate, 2);
        
        // Save follow-ups to database
        if (followUpSequence.length > 0) {
          await supabase
            .from('email_templates')
            .insert(followUpSequence);
        }
      } catch (error) {
        console.error('Failed to generate follow-up sequence:', error);
        // Continue without follow-ups
      }
    }

    // Analyze email effectiveness
    const effectiveness = await emailGenerator.analyzeEmailEffectiveness(emailTemplate);

    return NextResponse.json({
      success: true,
      email_template: emailTemplate,
      follow_up_sequence: followUpSequence,
      effectiveness_analysis: effectiveness,
      artifact_summary: {
        title: artifact.title,
        type: artifact.type,
        estimated_impact: artifact.estimated_impact
      }
    });

  } catch (error) {
    console.error('Error generating email template:', error);
    
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
  { params }: { params: { id: string; artifactId: string } }
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
    const artifactId = params.artifactId;

    // Initialize Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get email templates for this artifact
    const { data: templates, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('project_artifact_id', artifactId)
      .eq('company_id', companyId)
      .eq('created_by', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch email templates' },
        { status: 500 }
      );
    }

    // Group templates by type
    const primaryTemplate = templates?.find(t => t.template_type === 'cold_outreach');
    const followUps = templates?.filter(t => t.template_type === 'follow_up') || [];

    return NextResponse.json({
      success: true,
      primary_template: primaryTemplate,
      follow_up_templates: followUps,
      total_templates: templates?.length || 0
    });

  } catch (error) {
    console.error('Error fetching email templates:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}