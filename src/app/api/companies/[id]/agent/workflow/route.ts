import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import AgentOrchestrator, { AgentWorkflowConfigSchema, ProjectSelectionSchema } from '@/lib/agent-orchestrator';

// Request schema for starting a workflow
const StartWorkflowRequestSchema = z.object({
  research_session_id: z.string().uuid(),
  config: AgentWorkflowConfigSchema.optional()
});

// Request schema for generating email from project selection
const ProjectSelectionRequestSchema = z.object({
  project_selection: ProjectSelectionSchema,
  email_config: z.object({
    tone: z.enum(['professional', 'casual', 'technical', 'executive']).optional(),
    length: z.enum(['short', 'medium', 'long']).optional(),
    targetPersona: z.enum(['cto', 'vp_engineering', 'founder', 'product_manager', 'technical_lead']).optional(),
    urgencyLevel: z.enum(['low', 'medium', 'high']).optional(),
    createVariants: z.boolean().optional()
  }).optional(),
  company_context: z.object({
    keyPeople: z.array(z.object({
      name: z.string(),
      role: z.string(),
      background: z.string().optional()
    })).optional(),
    recentNews: z.array(z.string()).optional(),
    techStack: z.array(z.string()).optional()
  }).optional()
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

    const companyId = params.id;
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'Company ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'start_workflow';

    const orchestrator = new AgentOrchestrator();

    switch (action) {
      case 'start_workflow': {
        // Start complete agent workflow
        const validatedRequest = StartWorkflowRequestSchema.parse(body);
        
        const result = await orchestrator.executeAgentWorkflow(
          companyId,
          validatedRequest.research_session_id,
          userId,
          validatedRequest.config
        );

        return NextResponse.json(result);
      }

      case 'generate_email': {
        // Generate email from project selection
        const validatedRequest = ProjectSelectionRequestSchema.parse(body);
        
        const result = await orchestrator.generateEmailFromProjectSelection(
          companyId,
          validatedRequest.project_selection,
          validatedRequest.email_config,
          validatedRequest.company_context
        );

        return NextResponse.json({
          success: true,
          ...result
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action parameter' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Agent workflow API error:', error);
    
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
    const action = searchParams.get('action') || 'history';

    const orchestrator = new AgentOrchestrator();

    switch (action) {
      case 'history': {
        // Get workflow history
        const limit = parseInt(searchParams.get('limit') || '10');
        
        const result = await orchestrator.getWorkflowHistory(
          companyId,
          userId,
          limit
        );

        return NextResponse.json({
          success: true,
          ...result
        });
      }

      case 'analytics': {
        // Get workflow analytics
        const result = await orchestrator.getWorkflowAnalytics(
          companyId,
          userId
        );

        return NextResponse.json({
          success: true,
          analytics: result
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action parameter' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Agent workflow analytics error:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}