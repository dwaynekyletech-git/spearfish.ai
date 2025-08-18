import { z } from 'zod';
import { randomUUID } from 'crypto';
import OpenAI from 'openai';
import { ResearchFinding } from './company-research-service';

// Types for project artifacts
export interface ProjectArtifact {
  id: string;
  company_id: string;
  research_session_id: string;
  created_by: string;
  type: 'technical_proposal' | 'integration_guide' | 'optimization_plan' | 'security_audit' | 'market_analysis' | 'automation_script' | 'dashboard_design' | 'api_documentation';
  title: string;
  description: string;
  problem_statement: string;
  proposed_solution: string;
  implementation_approach: string;
  estimated_effort: 'low' | 'medium' | 'high';
  estimated_impact: 'low' | 'medium' | 'high';
  required_skills: string[];
  deliverables: string[];
  timeline_estimate: string;
  success_metrics: string[];
  risk_factors: string[];
  source_findings: string[]; // IDs of research findings that led to this artifact
  priority_score: number; // 0-100
  confidence_score: number; // 0-1
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface ProjectGenerationConfig {
  maxProjects?: number;
  focusAreas?: ('technical' | 'business' | 'market' | 'security' | 'optimization')[];
  effortPreference?: 'low' | 'medium' | 'high' | 'mixed';
  skillsAvailable?: string[];
  timeframe?: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
  riskTolerance?: 'low' | 'medium' | 'high';
}

export interface ProjectOpportunity {
  problemId: string;
  problemTitle: string;
  problemDescription: string;
  opportunityType: ProjectArtifact['type'];
  businessValue: string;
  technicalComplexity: 'low' | 'medium' | 'high';
  competitiveAdvantage: string;
  sourceFindings: ResearchFinding[];
}

// Zod schemas for validation
export const ProjectGenerationConfigSchema = z.object({
  maxProjects: z.number().min(1).max(20).optional().default(5),
  focusAreas: z.array(z.enum(['technical', 'business', 'market', 'security', 'optimization'])).optional(),
  effortPreference: z.enum(['low', 'medium', 'high', 'mixed']).optional(),
  skillsAvailable: z.array(z.string()).optional(),
  timeframe: z.enum(['immediate', 'short_term', 'medium_term', 'long_term']).optional(),
  riskTolerance: z.enum(['low', 'medium', 'high']).optional()
});

export class ProjectIdeaGenerator {
  private openai: OpenAI;

  constructor() {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY is required for Project Idea Generator');
    }
    
    this.openai = new OpenAI({
      apiKey: openaiKey
    });
  }

  async generateProjectIdeas(
    companyName: string,
    findings: ResearchFinding[],
    config: ProjectGenerationConfig
  ): Promise<ProjectArtifact[]> {
    
    // Validate configuration
    const validatedConfig = ProjectGenerationConfigSchema.parse(config);
    
    // Step 1: Analyze findings and identify opportunities
    const opportunities = await this.identifyProjectOpportunities(companyName, findings, validatedConfig);
    
    // Step 2: Generate detailed project artifacts
    const projects = await this.generateDetailedProjects(companyName, opportunities, validatedConfig);
    
    // Step 3: Prioritize and rank projects
    const prioritizedProjects = this.prioritizeProjects(projects, validatedConfig);
    
    // Step 4: Return top projects based on maxProjects limit
    return prioritizedProjects.slice(0, validatedConfig.maxProjects || 5);
  }

  private async identifyProjectOpportunities(
    companyName: string,
    findings: ResearchFinding[],
    config: ProjectGenerationConfig
  ): Promise<ProjectOpportunity[]> {
    
    // Group findings by type and priority
    const highPriorityFindings = findings.filter(f => 
      f.priority_level === 'high' || f.priority_level === 'critical'
    );
    
    const technicalFindings = findings.filter(f => f.finding_type === 'problem_identified');
    const businessFindings = findings.filter(f => f.finding_type === 'market_opportunity');
    const teamFindings = findings.filter(f => f.finding_type === 'team_insight');
    
    // Use AI to analyze patterns and identify opportunities
    const analysisPrompt = `You are an expert consulting strategist analyzing research findings for ${companyName}. 
Your goal is to identify specific project opportunities that could provide immediate business value.

RESEARCH FINDINGS SUMMARY:
High Priority Findings: ${highPriorityFindings.length}
Technical Problems: ${technicalFindings.length}
Business Opportunities: ${businessFindings.length}
Team Insights: ${teamFindings.length}

DETAILED FINDINGS:
${findings.map(f => `
Type: ${f.finding_type}
Priority: ${f.priority_level}
Title: ${f.title}
Content: ${f.content}
Tags: ${f.tags.join(', ')}
Confidence: ${f.confidence_score}
---`).join('\n')}

ANALYSIS TASK:
Identify 8-12 specific project opportunities that could be delivered as consulting artifacts. Each opportunity should:

1. Address a concrete problem or need identified in the research
2. Be deliverable within 2-8 weeks by an external consultant
3. Provide measurable business value
4. Be technically feasible with standard tools/frameworks
5. Give competitive advantage or solve urgent pain points

PROJECT TYPES TO CONSIDER:
- technical_proposal: Detailed technical solution design
- integration_guide: System integration documentation and implementation
- optimization_plan: Performance, cost, or process optimization strategy
- security_audit: Security assessment and remediation plan
- market_analysis: Competitive analysis or market expansion research
- automation_script: Process automation tools and workflows
- dashboard_design: Analytics dashboard or monitoring system
- api_documentation: API design, documentation, and integration guides

OUTPUT FORMAT (JSON):
{
  "opportunities": [
    {
      "problemId": "unique_id",
      "problemTitle": "Specific problem being solved",
      "problemDescription": "Detailed description of the problem and its impact",
      "opportunityType": "project_type_from_list_above",
      "businessValue": "Clear explanation of business value and ROI",
      "technicalComplexity": "low|medium|high",
      "competitiveAdvantage": "How this gives competitive edge",
      "sourceFindings": ["finding_id_1", "finding_id_2"]
    }
  ]
}

Focus on opportunities that transform research insights into actionable consulting deliverables.`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert consulting strategist who identifies high-value project opportunities from research data. Return only valid JSON."
        },
        {
          role: "user",
          content: analysisPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 3000,
      response_format: { type: "json_object" }
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('Failed to generate opportunity analysis');
    }

    const analysisResult = JSON.parse(response);
    const opportunities: ProjectOpportunity[] = analysisResult.opportunities?.map((opp: any) => ({
      ...opp,
      sourceFindings: findings.filter(f => opp.sourceFindings?.includes(f.id))
    })) || [];

    return opportunities;
  }

  private async generateDetailedProjects(
    companyName: string,
    opportunities: ProjectOpportunity[],
    config: ProjectGenerationConfig
  ): Promise<ProjectArtifact[]> {
    
    const projects: ProjectArtifact[] = [];

    for (const opportunity of opportunities) {
      try {
        const project = await this.generateSingleProject(companyName, opportunity, config);
        projects.push(project);
      } catch (error) {
        console.error(`Failed to generate project for opportunity ${opportunity.problemId}:`, error);
      }
    }

    return projects;
  }

  private async generateSingleProject(
    companyName: string,
    opportunity: ProjectOpportunity,
    config: ProjectGenerationConfig
  ): Promise<ProjectArtifact> {
    
    const projectPrompt = `You are a senior consultant creating a detailed project proposal for ${companyName}.

OPPORTUNITY OVERVIEW:
Problem: ${opportunity.problemTitle}
Description: ${opportunity.problemDescription}
Type: ${opportunity.opportunityType}
Business Value: ${opportunity.businessValue}
Technical Complexity: ${opportunity.technicalComplexity}

PROJECT CONFIGURATION:
Effort Preference: ${config.effortPreference || 'mixed'}
Available Skills: ${config.skillsAvailable?.join(', ') || 'general consulting'}
Timeframe: ${config.timeframe || 'medium_term'}
Risk Tolerance: ${config.riskTolerance || 'medium'}

TASK:
Create a comprehensive project proposal that transforms this opportunity into a deliverable consulting artifact.

OUTPUT FORMAT (JSON):
{
  "title": "Clear, compelling project title (60 chars max)",
  "description": "Executive summary of the project (200-300 chars)",
  "problem_statement": "Detailed problem analysis with impact quantification",
  "proposed_solution": "Comprehensive solution approach and methodology",
  "implementation_approach": "Step-by-step implementation plan with phases",
  "estimated_effort": "low|medium|high",
  "estimated_impact": "low|medium|high", 
  "required_skills": ["skill1", "skill2", "skill3"],
  "deliverables": ["deliverable1", "deliverable2", "deliverable3"],
  "timeline_estimate": "X weeks / X-Y weeks",
  "success_metrics": ["metric1", "metric2", "metric3"],
  "risk_factors": ["risk1", "risk2"],
  "priority_reasoning": "Why this project should be prioritized"
}

REQUIREMENTS:
- Proposal should be actionable and specific
- Timeline should be realistic for the complexity level
- Success metrics should be measurable
- Required skills should match available capabilities when possible
- Implementation approach should be detailed enough to start immediately`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system", 
          content: "You are a senior consultant who creates detailed, actionable project proposals. Return only valid JSON."
        },
        {
          role: "user",
          content: projectPrompt
        }
      ],
      temperature: 0.5,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('Failed to generate project details');
    }

    const projectData = JSON.parse(response);
    
    // Calculate priority score based on multiple factors
    const priorityScore = this.calculatePriorityScore(
      opportunity,
      projectData,
      config
    );

    // Calculate confidence score
    const confidenceScore = this.calculateConfidenceScore(
      opportunity.sourceFindings,
      projectData
    );

    // Ensure scores are never null/undefined
    const safePriorityScore = typeof priorityScore === 'number' && !isNaN(priorityScore) ? priorityScore : 50;
    const safeConfidenceScore = typeof confidenceScore === 'number' && !isNaN(confidenceScore) ? confidenceScore : 0.5;

    // Helper function to ensure text fields are strings
    const ensureString = (value: any): string => {
      if (typeof value === 'string') return value;
      if (value === null || value === undefined) return '';
      return JSON.stringify(value, null, 2);
    };

    const project: ProjectArtifact = {
      id: randomUUID(),
      company_id: '', // Will be set by the calling service
      research_session_id: '', // Will be set by the calling service
      created_by: '', // Will be set by the calling service
      type: opportunity.opportunityType,
      title: ensureString(projectData.title),
      description: ensureString(projectData.description),
      problem_statement: ensureString(projectData.problem_statement),
      proposed_solution: ensureString(projectData.proposed_solution),
      implementation_approach: ensureString(projectData.implementation_approach),
      estimated_effort: projectData.estimated_effort,
      estimated_impact: projectData.estimated_impact,
      required_skills: Array.isArray(projectData.required_skills) ? projectData.required_skills : [],
      deliverables: Array.isArray(projectData.deliverables) ? projectData.deliverables : [],
      timeline_estimate: ensureString(projectData.timeline_estimate),
      success_metrics: Array.isArray(projectData.success_metrics) ? projectData.success_metrics : [],
      risk_factors: Array.isArray(projectData.risk_factors) ? projectData.risk_factors : [],
      source_findings: opportunity.sourceFindings.map(f => f.id),
      priority_score: safePriorityScore,
      confidence_score: safeConfidenceScore,
      metadata: {
        opportunity_id: opportunity.problemId,
        technical_complexity: opportunity.technicalComplexity,
        priority_reasoning: ensureString(projectData.priority_reasoning),
        generation_config: config
      },
      created_at: new Date(),
      updated_at: new Date()
    };

    return project;
  }

  private calculatePriorityScore(
    opportunity: ProjectOpportunity,
    projectData: any,
    config: ProjectGenerationConfig
  ): number {
    let score = 50; // Base score

    // Impact factor (0-30 points)
    const impactMultiplier = {
      low: 0,
      medium: 15,
      high: 30
    };
    score += impactMultiplier[projectData.estimated_impact as keyof typeof impactMultiplier] || 0;

    // Effort factor (prefer lower effort if specified)
    const effortAdjustment = {
      low: config.effortPreference === 'low' ? 20 : 10,
      medium: config.effortPreference === 'medium' ? 15 : 0,
      high: config.effortPreference === 'high' ? 10 : -10
    };
    score += effortAdjustment[projectData.estimated_effort as keyof typeof effortAdjustment] || 0;

    // Technical complexity factor
    const complexityAdjustment = {
      low: 10,
      medium: 5,
      high: config.riskTolerance === 'high' ? 5 : -5
    };
    score += complexityAdjustment[opportunity.technicalComplexity] || 0;

    // Source findings confidence factor (0-20 points)
    const avgConfidence = opportunity.sourceFindings.length > 0 
      ? opportunity.sourceFindings.reduce((sum, f) => sum + f.confidence_score, 0) / opportunity.sourceFindings.length
      : 0.5; // Default confidence when no source findings
    score += avgConfidence * 20;

    return Math.max(0, Math.min(100, score));
  }

  private calculateConfidenceScore(
    sourceFindings: ResearchFinding[],
    projectData: any
  ): number {
    
    // Base confidence from research findings
    const avgFindingConfidence = sourceFindings.length > 0 
      ? sourceFindings.reduce((sum, f) => sum + f.confidence_score, 0) / sourceFindings.length
      : 0.5; // Default confidence when no source findings
    
    // Adjust based on project characteristics
    let adjustments = 0;
    
    // More deliverables = higher confidence in scope definition
    if (projectData.deliverables?.length > 3) adjustments += 0.1;
    
    // Specific timeline = higher confidence in feasibility
    if (projectData.timeline_estimate?.includes('week')) adjustments += 0.1;
    
    // Multiple success metrics = higher confidence in measurability
    if (projectData.success_metrics?.length > 2) adjustments += 0.1;
    
    // Clear risk identification = higher confidence in planning
    if (projectData.risk_factors?.length > 0) adjustments += 0.05;

    return Math.max(0, Math.min(1, avgFindingConfidence + adjustments));
  }

  private prioritizeProjects(
    projects: ProjectArtifact[],
    config: ProjectGenerationConfig
  ): ProjectArtifact[] {
    
    // Sort by priority score (highest first)
    return projects.sort((a, b) => {
      // Primary sort: priority score
      if (b.priority_score !== a.priority_score) {
        return b.priority_score - a.priority_score;
      }
      
      // Secondary sort: confidence score
      if (b.confidence_score !== a.confidence_score) {
        return b.confidence_score - a.confidence_score;
      }
      
      // Tertiary sort: estimated impact
      const impactOrder = { high: 3, medium: 2, low: 1 };
      return impactOrder[b.estimated_impact] - impactOrder[a.estimated_impact];
    });
  }

  // Utility methods for analyzing project feasibility
  async analyzeProjectFeasibility(
    project: ProjectArtifact,
    companyContext: {
      techStack?: string[];
      teamSize?: number;
      budget?: string;
      timeline?: string;
    }
  ): Promise<{
    feasibilityScore: number;
    blockers: string[];
    recommendations: string[];
  }> {
    
    const analysisPrompt = `Analyze the feasibility of this project for the given company context:

PROJECT:
${JSON.stringify(project, null, 2)}

COMPANY CONTEXT:
${JSON.stringify(companyContext, null, 2)}

Provide:
1. Feasibility score (0-100)
2. Potential blockers
3. Recommendations to improve success likelihood

Return as JSON: { feasibilityScore: number, blockers: string[], recommendations: string[] }`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a project feasibility analyst. Return only valid JSON." },
        { role: "user", content: analysisPrompt }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      return { feasibilityScore: 50, blockers: [], recommendations: [] };
    }

    return JSON.parse(response);
  }

  // Method to suggest alternative projects if primary ones aren't feasible
  async suggestAlternativeProjects(
    originalProjects: ProjectArtifact[],
    constraints: {
      maxEffort?: 'low' | 'medium';
      requiredSkills?: string[];
      timeframe?: string;
    }
  ): Promise<ProjectArtifact[]> {
    
    // Filter and modify existing projects based on constraints
    return originalProjects
      .filter(p => {
        if (constraints.maxEffort && p.estimated_effort === 'high') {
          return false;
        }
        
        if (constraints.requiredSkills && constraints.requiredSkills.length > 0) {
          const hasRequiredSkills = p.required_skills.some(skill => 
            constraints.requiredSkills!.some(available => 
              available.toLowerCase().includes(skill.toLowerCase())
            )
          );
          if (!hasRequiredSkills) return false;
        }
        
        return true;
      })
      .slice(0, 3); // Return top 3 alternatives
  }
}

export default ProjectIdeaGenerator;