import { z } from 'zod';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import ProjectIdeaGenerator, { ProjectArtifact, ProjectGenerationConfig } from './agent-project-generator';
import EmailTemplateCreator, { EmailTemplate, EmailGenerationConfig, CompanyContext } from './agent-email-generator';
import { ResearchFinding, getGlobalResearchService } from './company-research-service';

// Agent workflow orchestration
export interface AgentWorkflowConfig {
  // Project generation settings
  projectConfig?: ProjectGenerationConfig;
  
  // Email generation settings
  emailConfig?: EmailGenerationConfig;
  
  // Workflow control
  generateProjects?: boolean;
  generateEmails?: boolean;
  autoSelectTopProject?: boolean;
  
  // Company context
  companyContext?: Partial<CompanyContext>;
  
  // Output preferences
  maxProjects?: number;
  includeFollowUpSequence?: boolean;
  saveToDatabase?: boolean;
}

export interface AgentWorkflowResult {
  success: boolean;
  workflow_id: string;
  company_id: string;
  research_session_id: string;
  
  // Generated artifacts
  project_artifacts?: ProjectArtifact[];
  selected_project?: ProjectArtifact;
  email_templates?: EmailTemplate[];
  follow_up_sequence?: EmailTemplate[];
  
  // Analytics
  generation_stats: {
    projects_generated: number;
    emails_generated: number;
    total_processing_time_ms: number;
    research_findings_used: number;
  };
  
  // Recommendations
  recommendations: {
    top_project_reasoning: string;
    email_effectiveness_score: number;
    suggested_next_steps: string[];
  };
  
  error?: string;
  warnings?: string[];
}

export interface ProjectSelection {
  project_id: string;
  completion_status: 'completed' | 'in_progress' | 'planned';
  completion_notes?: string;
  evidence_urls?: string[];
}

// Zod schemas
export const AgentWorkflowConfigSchema = z.object({
  projectConfig: z.object({
    maxProjects: z.number().min(1).max(20).optional(),
    focusAreas: z.array(z.enum(['technical', 'business', 'market', 'security', 'optimization'])).optional(),
    effortPreference: z.enum(['low', 'medium', 'high', 'mixed']).optional(),
    timeframe: z.enum(['immediate', 'short_term', 'medium_term', 'long_term']).optional(),
    riskTolerance: z.enum(['low', 'medium', 'high']).optional()
  }).optional(),
  
  emailConfig: z.object({
    tone: z.enum(['professional', 'casual', 'technical', 'executive']).optional(),
    length: z.enum(['short', 'medium', 'long']).optional(),
    targetPersona: z.enum(['cto', 'vp_engineering', 'founder', 'product_manager', 'technical_lead']).optional(),
    urgencyLevel: z.enum(['low', 'medium', 'high']).optional(),
    createVariants: z.boolean().optional()
  }).optional(),
  
  generateProjects: z.boolean().optional(),
  generateEmails: z.boolean().optional(),
  autoSelectTopProject: z.boolean().optional(),
  companyContext: z.object({
    companyName: z.string().optional(),
    industry: z.string().optional(),
    size: z.string().optional(),
    stage: z.string().optional(),
    keyPeople: z.array(z.object({
      name: z.string(),
      role: z.string(),
      background: z.string().optional()
    })).optional(),
    recentNews: z.array(z.string()).optional(),
    techStack: z.array(z.string()).optional()
  }).optional(),
  maxProjects: z.number().min(1).max(10).optional(),
  includeFollowUpSequence: z.boolean().optional(),
  saveToDatabase: z.boolean().optional()
});

export const ProjectSelectionSchema = z.object({
  project_id: z.string().uuid(),
  completion_status: z.enum(['completed', 'in_progress', 'planned']),
  completion_notes: z.string().optional(),
  evidence_urls: z.array(z.string().url()).optional()
});

export class AgentOrchestrator {
  private projectGenerator: ProjectIdeaGenerator;
  private emailGenerator: EmailTemplateCreator;
  private supabase: any;

  constructor() {
    this.projectGenerator = new ProjectIdeaGenerator();
    this.emailGenerator = new EmailTemplateCreator();
    
    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async executeAgentWorkflow(
    companyId: string,
    researchSessionId: string,
    userId: string,
    config: AgentWorkflowConfig = {}
  ): Promise<AgentWorkflowResult> {
    
    const startTime = Date.now();
    const workflowId = randomUUID();
    
    try {
      // Validate inputs
      const validatedConfig = AgentWorkflowConfigSchema.parse(config);
      
      // Get company and research data
      const { company, researchResults } = await this.getWorkflowData(companyId, researchSessionId);
      
      const result: AgentWorkflowResult = {
        success: false,
        workflow_id: workflowId,
        company_id: companyId,
        research_session_id: researchSessionId,
        generation_stats: {
          projects_generated: 0,
          emails_generated: 0,
          total_processing_time_ms: 0,
          research_findings_used: researchResults.findings.length
        },
        recommendations: {
          top_project_reasoning: '',
          email_effectiveness_score: 0,
          suggested_next_steps: []
        },
        warnings: []
      };

      // Step 1: Generate project artifacts (if requested)
      if (validatedConfig.generateProjects !== false) {
        result.project_artifacts = await this.generateProjectArtifacts(
          company,
          researchResults.findings,
          validatedConfig.projectConfig,
          userId,
          workflowId
        );
        
        result.generation_stats.projects_generated = result.project_artifacts.length;
        
        // Auto-select top project if requested
        if (validatedConfig.autoSelectTopProject && result.project_artifacts.length > 0) {
          result.selected_project = result.project_artifacts[0];
          result.recommendations.top_project_reasoning = `Selected based on highest priority score (${result.selected_project.priority_score}/100) and ${result.selected_project.estimated_impact} impact potential.`;
        }
      }

      // Step 2: Generate email templates (if requested and we have a project)
      if (validatedConfig.generateEmails !== false && result.selected_project) {
        const companyContext = this.buildCompanyContext(company, validatedConfig.companyContext);
        
        result.email_templates = await this.generateEmailTemplates(
          result.selected_project,
          researchResults.findings,
          companyContext,
          validatedConfig.emailConfig,
          workflowId
        );
        
        result.generation_stats.emails_generated = result.email_templates.length;
        
        // Generate follow-up sequence if requested
        if (validatedConfig.includeFollowUpSequence && result.email_templates.length > 0) {
          result.follow_up_sequence = await this.generateFollowUpSequence(
            result.email_templates[0],
            workflowId
          );
        }
        
        // Calculate email effectiveness score
        if (result.email_templates.length > 0) {
          result.recommendations.email_effectiveness_score = await this.calculateEmailEffectiveness(
            result.email_templates[0]
          );
        }
      }

      // Step 3: Generate recommendations and next steps
      result.recommendations.suggested_next_steps = this.generateNextSteps(result);
      
      // Step 4: Save to database if requested
      if (validatedConfig.saveToDatabase !== false) {
        await this.saveWorkflowResults(result, userId);
      }

      // Final metrics
      result.generation_stats.total_processing_time_ms = Date.now() - startTime;
      result.success = true;
      
      return result;

    } catch (error) {
      console.error('Agent workflow failed:', error);
      
      return {
        success: false,
        workflow_id: workflowId,
        company_id: companyId,
        research_session_id: researchSessionId,
        generation_stats: {
          projects_generated: 0,
          emails_generated: 0,
          total_processing_time_ms: Date.now() - startTime,
          research_findings_used: 0
        },
        recommendations: {
          top_project_reasoning: '',
          email_effectiveness_score: 0,
          suggested_next_steps: []
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async generateEmailFromProjectSelection(
    companyId: string,
    projectSelection: ProjectSelection,
    emailConfig: EmailGenerationConfig = {},
    companyContext?: Partial<CompanyContext>
  ): Promise<{
    email_template: EmailTemplate;
    follow_up_sequence?: EmailTemplate[];
    effectiveness_analysis: any;
  }> {
    
    // Get project artifact
    const { data: project, error: projectError } = await this.supabase
      .from('project_artifacts')
      .select('*')
      .eq('id', projectSelection.project_id)
      .single();

    if (projectError || !project) {
      throw new Error('Project artifact not found');
    }

    // Get research findings
    const researchService = getGlobalResearchService();
    const sessionResults = await researchService.getSessionResults(project.research_session_id);
    
    if (!sessionResults) {
      throw new Error('Research session results not found');
    }

    // Get company info
    const { data: company } = await this.supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    const fullCompanyContext = this.buildCompanyContext(company, companyContext);

    // Enhance email config with project completion context
    const enhancedConfig = {
      ...emailConfig,
      projectCompletionStatus: projectSelection.completion_status,
      completionEvidence: projectSelection.evidence_urls,
      completionNotes: projectSelection.completion_notes
    };

    // Generate email template
    const emailTemplate = await this.emailGenerator.generateEmailTemplate(
      project,
      sessionResults.findings,
      fullCompanyContext,
      enhancedConfig
    );

    // Generate follow-up sequence
    const followUpSequence = enhancedConfig.createVariants ? 
      await this.emailGenerator.generateFollowUpSequence(emailTemplate, 2) : undefined;

    // Analyze effectiveness
    const effectivenessAnalysis = await this.emailGenerator.analyzeEmailEffectiveness(emailTemplate);

    return {
      email_template: emailTemplate,
      follow_up_sequence: followUpSequence,
      effectiveness_analysis: effectivenessAnalysis
    };
  }

  private async getWorkflowData(companyId: string, researchSessionId: string) {
    // Get company
    const { data: company, error: companyError } = await this.supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      throw new Error('Company not found');
    }

    // Get research results
    const researchService = getGlobalResearchService();
    const researchResults = await researchService.getSessionResults(researchSessionId);
    
    if (!researchResults) {
      throw new Error('Research session results not found');
    }

    return { company, researchResults };
  }

  private async generateProjectArtifacts(
    company: any,
    findings: ResearchFinding[],
    config?: ProjectGenerationConfig,
    userId?: string,
    workflowId?: string
  ): Promise<ProjectArtifact[]> {
    
    const defaultConfig: ProjectGenerationConfig = {
      maxProjects: 5,
      focusAreas: ['technical', 'business'],
      effortPreference: 'mixed',
      timeframe: 'medium_term',
      riskTolerance: 'medium'
    };

    const mergedConfig: ProjectGenerationConfig = { ...defaultConfig, ...config };
    
    const artifacts = await this.projectGenerator.generateProjectIdeas(
      company.name,
      findings,
      mergedConfig
    );

    // Enrich with context
    return artifacts.map(artifact => ({
      ...artifact,
      company_id: company.id,
      created_by: userId || '',
      metadata: {
        ...artifact.metadata,
        workflow_id: workflowId
      }
    }));
  }

  private async generateEmailTemplates(
    project: ProjectArtifact,
    findings: ResearchFinding[],
    companyContext: CompanyContext,
    config?: EmailGenerationConfig,
    workflowId?: string
  ): Promise<EmailTemplate[]> {
    
    const emailTemplate = await this.emailGenerator.generateEmailTemplate(
      project,
      findings,
      companyContext,
      config
    );

    // Add workflow context
    emailTemplate.metadata = {
      ...emailTemplate.metadata,
      workflow_id: workflowId
    };

    return [emailTemplate];
  }

  private async generateFollowUpSequence(
    primaryTemplate: EmailTemplate,
    workflowId?: string
  ): Promise<EmailTemplate[]> {
    
    const followUps = await this.emailGenerator.generateFollowUpSequence(primaryTemplate, 2);
    
    // Add workflow context
    return followUps.map(followUp => ({
      ...followUp,
      metadata: {
        ...followUp.metadata,
        workflow_id: workflowId
      }
    }));
  }

  private buildCompanyContext(company: any, additionalContext?: Partial<CompanyContext>): CompanyContext {
    return {
      companyName: company.name,
      industry: company.industry,
      size: company.team_size ? `${company.team_size} employees` : undefined,
      stage: company.stage,
      techStack: company.github_repos ? 
        Object.keys(company.github_repos as Record<string, any>) : undefined,
      ...additionalContext
    };
  }

  private async calculateEmailEffectiveness(template: EmailTemplate): Promise<number> {
    const analysis = await this.emailGenerator.analyzeEmailEffectiveness(template);
    
    // Convert analysis to score (0-100)
    let score = 50; // Base score
    
    // Add points for strengths
    score += analysis.strengths.length * 10;
    
    // Subtract points for weaknesses
    score -= analysis.weaknesses.length * 8;
    
    // Penalty for high spam risk
    score -= analysis.spamRisk * 30;
    
    // Bonus for personalization
    score += template.personalization_elements.length * 5;
    
    return Math.max(0, Math.min(100, score));
  }

  private generateNextSteps(result: AgentWorkflowResult): string[] {
    const steps: string[] = [];
    
    if (result.project_artifacts && result.project_artifacts.length > 0) {
      steps.push('Review generated project ideas and select the most viable option');
      
      if (result.selected_project) {
        steps.push(`Begin work on: "${result.selected_project.title}"`);
        steps.push('Document your progress and gather evidence of completion');
      }
    }
    
    if (result.email_templates && result.email_templates.length > 0) {
      steps.push('Customize the email template with your specific credentials');
      steps.push('Research the target contact person for personalization');
      steps.push('Send the outreach email and track responses');
    }
    
    if (result.follow_up_sequence && result.follow_up_sequence.length > 0) {
      steps.push('Schedule follow-up emails for 3-5 days after initial outreach');
    }
    
    steps.push('Monitor email open rates and response patterns');
    steps.push('Iterate on successful approaches for future outreach');
    
    return steps;
  }

  private async saveWorkflowResults(result: AgentWorkflowResult, userId: string): Promise<void> {
    try {
      // Save project artifacts
      if (result.project_artifacts && result.project_artifacts.length > 0) {
        const { error: artifactsError } = await this.supabase
          .from('project_artifacts')
          .insert(result.project_artifacts.map(artifact => ({
            ...artifact,
            created_by: userId
          })));
        
        if (artifactsError) {
          console.error('Failed to save project artifacts:', artifactsError);
        }
      }

      // Save email templates
      if (result.email_templates && result.email_templates.length > 0) {
        const allTemplates = [
          ...result.email_templates,
          ...(result.follow_up_sequence || [])
        ];
        
        const { error: templatesError } = await this.supabase
          .from('email_templates')
          .insert(allTemplates.map(template => ({
            ...template,
            created_by: userId
          })));
        
        if (templatesError) {
          console.error('Failed to save email templates:', templatesError);
        }
      }

    } catch (error) {
      console.error('Error saving workflow results:', error);
      // Don't throw - this is a background operation
    }
  }

  // Utility methods for workflow management
  async getWorkflowHistory(
    companyId: string,
    userId: string,
    limit: number = 10
  ): Promise<{
    workflows: Array<{
      workflow_id: string;
      created_at: Date;
      projects_count: number;
      emails_count: number;
    }>;
  }> {
    
    const { data, error } = await this.supabase
      .from('project_artifacts')
      .select(`
        metadata->workflow_id,
        created_at,
        company_id
      `)
      .eq('company_id', companyId)
      .eq('created_by', userId)
      .not('metadata->workflow_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error('Failed to fetch workflow history');
    }

    // Group by workflow_id and aggregate
    const workflowMap = new Map();
    
    data?.forEach((item: any) => {
      const workflowId = item.metadata?.workflow_id;
      if (workflowId) {
        if (!workflowMap.has(workflowId)) {
          workflowMap.set(workflowId, {
            workflow_id: workflowId,
            created_at: item.created_at,
            projects_count: 0,
            emails_count: 0
          });
        }
        workflowMap.get(workflowId).projects_count++;
      }
    });

    return {
      workflows: Array.from(workflowMap.values())
    };
  }

  async getWorkflowAnalytics(companyId: string, userId: string): Promise<{
    total_workflows: number;
    total_projects: number;
    total_emails: number;
    avg_projects_per_workflow: number;
    top_project_types: Array<{ type: string; count: number }>;
    effectiveness_trends: Array<{ date: string; avg_score: number }>;
  }> {
    
    // Get aggregate data
    const { data: projectStats } = await this.supabase
      .from('project_artifacts')
      .select('type, created_at, metadata, priority_score')
      .eq('company_id', companyId)
      .eq('created_by', userId);

    const { data: emailStats } = await this.supabase
      .from('email_templates')
      .select('created_at, estimated_response_rate')
      .eq('company_id', companyId)
      .eq('created_by', userId);

    // Calculate metrics
    const uniqueWorkflows = new Set(
      projectStats?.map((p: any) => p.metadata?.workflow_id).filter(Boolean) || []
    );

    const typeCount = projectStats?.reduce((acc: Record<string, number>, p: any) => {
      acc[p.type] = (acc[p.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    const topProjectTypes = Object.entries(typeCount)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([type, count]) => ({ type, count: count as number }));

    return {
      total_workflows: uniqueWorkflows.size,
      total_projects: projectStats?.length || 0,
      total_emails: emailStats?.length || 0,
      avg_projects_per_workflow: uniqueWorkflows.size > 0 ? 
        (projectStats?.length || 0) / uniqueWorkflows.size : 0,
      top_project_types: topProjectTypes,
      effectiveness_trends: [] // Would need time-series analysis
    };
  }
}

export default AgentOrchestrator;