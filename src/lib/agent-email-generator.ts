import { z } from 'zod';
import { randomUUID } from 'crypto';
import OpenAI from 'openai';
import { ProjectArtifact } from './agent-project-generator';
import { ResearchFinding } from './company-research-service';

// Types for email templates
export interface EmailTemplate {
  id: string;
  project_artifact_id: string;
  company_id: string;
  created_by: string;
  template_type: 'cold_outreach' | 'follow_up' | 'proposal_delivery' | 'value_demonstration';
  subject_line: string;
  email_body: string;
  call_to_action: string;
  tone: 'professional' | 'casual' | 'technical' | 'executive';
  personalization_elements: PersonalizationElement[];
  research_citations: ResearchCitation[];
  estimated_response_rate: number;
  A_B_variants?: EmailVariant[];
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface PersonalizationElement {
  type: 'company_insight' | 'problem_reference' | 'solution_teaser' | 'mutual_connection' | 'company_achievement';
  content: string;
  source_finding_id?: string;
  confidence_score: number;
}

export interface ResearchCitation {
  finding_id: string;
  citation_text: string;
  purpose: 'credibility' | 'problem_evidence' | 'company_knowledge' | 'industry_insight';
}

export interface EmailVariant {
  variant_name: string;
  subject_line: string;
  email_body: string;
  key_differences: string[];
}

export interface EmailGenerationConfig {
  tone?: 'professional' | 'casual' | 'technical' | 'executive';
  length?: 'short' | 'medium' | 'long';
  includeCredentials?: boolean;
  includePortfolio?: boolean;
  focusOnValue?: boolean;
  createVariants?: boolean;
  targetPersona?: 'cto' | 'vp_engineering' | 'founder' | 'product_manager' | 'technical_lead';
  urgencyLevel?: 'low' | 'medium' | 'high';
}

export interface CompanyContext {
  companyName: string;
  industry?: string;
  size?: string;
  stage?: string;
  keyPeople?: Array<{
    name: string;
    role: string;
    background?: string;
  }>;
  recentNews?: string[];
  techStack?: string[];
}

// Zod schemas for validation
export const EmailGenerationConfigSchema = z.object({
  tone: z.enum(['professional', 'casual', 'technical', 'executive']).optional(),
  length: z.enum(['short', 'medium', 'long']).optional(),
  includeCredentials: z.boolean().optional(),
  includePortfolio: z.boolean().optional(),
  focusOnValue: z.boolean().optional(),
  createVariants: z.boolean().optional(),
  targetPersona: z.enum(['cto', 'vp_engineering', 'founder', 'product_manager', 'technical_lead']).optional(),
  urgencyLevel: z.enum(['low', 'medium', 'high']).optional()
});

export class EmailTemplateCreator {
  private openai: OpenAI;

  constructor() {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY is required for Email Template Creator');
    }
    
    this.openai = new OpenAI({
      apiKey: openaiKey
    });
  }

  async generateEmailTemplate(
    project: ProjectArtifact,
    researchFindings: ResearchFinding[],
    companyContext: CompanyContext,
    config: EmailGenerationConfig = {}
  ): Promise<EmailTemplate> {
    
    // Validate configuration
    const validatedConfig = EmailGenerationConfigSchema.parse(config);
    
    // Step 1: Identify key personalization elements
    const personalizationElements = await this.extractPersonalizationElements(
      project,
      researchFindings,
      companyContext,
      validatedConfig
    );
    
    // Step 2: Create research citations
    const researchCitations = this.createResearchCitations(
      project,
      researchFindings
    );
    
    // Step 3: Generate the main email template
    const emailContent = await this.generateEmailContent(
      project,
      companyContext,
      personalizationElements,
      researchCitations,
      validatedConfig
    );
    
    // Step 4: Create variants if requested
    const variants = validatedConfig.createVariants ? 
      await this.generateEmailVariants(emailContent, validatedConfig) : undefined;
    
    // Step 5: Estimate response rate
    const responseRate = this.estimateResponseRate(
      emailContent,
      personalizationElements,
      validatedConfig
    );

    const template: EmailTemplate = {
      id: randomUUID(),
      project_artifact_id: project.id,
      company_id: project.company_id,
      created_by: project.created_by,
      template_type: 'cold_outreach',
      subject_line: emailContent.subject_line,
      email_body: emailContent.email_body,
      call_to_action: emailContent.call_to_action,
      tone: validatedConfig.tone || 'professional',
      personalization_elements: personalizationElements,
      research_citations: researchCitations,
      estimated_response_rate: responseRate,
      A_B_variants: variants,
      metadata: {
        generation_config: validatedConfig,
        project_summary: {
          title: project.title,
          type: project.type,
          impact: project.estimated_impact,
          effort: project.estimated_effort
        },
        company_context: companyContext
      },
      created_at: new Date(),
      updated_at: new Date()
    };

    return template;
  }

  private async extractPersonalizationElements(
    project: ProjectArtifact,
    researchFindings: ResearchFinding[],
    companyContext: CompanyContext,
    config: EmailGenerationConfig
  ): Promise<PersonalizationElement[]> {
    
    const relevantFindings = researchFindings.filter(f => 
      project.source_findings.includes(f.id) ||
      f.priority_level === 'high' || 
      f.priority_level === 'critical'
    );

    const analysisPrompt = `Extract personalization elements for a cold outreach email to ${companyContext.companyName}.

PROJECT CONTEXT:
Title: ${project.title}
Problem: ${project.problem_statement}
Solution: ${project.proposed_solution}
Type: ${project.type}

RESEARCH FINDINGS:
${relevantFindings.map(f => `
Finding: ${f.title}
Content: ${f.content}
Type: ${f.finding_type}
Priority: ${f.priority_level}
Confidence: ${f.confidence_score}
Tags: ${f.tags.join(', ')}
---`).join('\n')}

COMPANY CONTEXT:
${JSON.stringify(companyContext, null, 2)}

TARGET PERSONA: ${config.targetPersona || 'technical_lead'}

TASK:
Extract 5-8 specific personalization elements that demonstrate deep understanding of the company and create genuine connection. Focus on:

1. Specific technical challenges they're facing
2. Recent company achievements or milestones
3. Industry insights that show you understand their market
4. Problem evidence that proves you've done your homework
5. Solution teasers that hint at the value you can provide

OUTPUT FORMAT (JSON):
{
  "personalization_elements": [
    {
      "type": "company_insight|problem_reference|solution_teaser|company_achievement",
      "content": "Specific, factual content for the email",
      "source_finding_id": "finding_id_if_applicable",
      "confidence_score": 0.8
    }
  ]
}

Make each element specific and verifiable - avoid generic statements.`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert sales copywriter who creates highly personalized outreach emails. Return only valid JSON."
        },
        {
          role: "user",
          content: analysisPrompt
        }
      ],
      temperature: 0.6,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      return [];
    }

    const result = JSON.parse(response);
    return result.personalization_elements || [];
  }

  private createResearchCitations(
    project: ProjectArtifact,
    researchFindings: ResearchFinding[]
  ): ResearchCitation[] {
    
    const relevantFindings = researchFindings.filter(f => 
      project.source_findings.includes(f.id)
    );

    return relevantFindings.map(finding => {
      // Determine citation purpose based on finding type
      let purpose: ResearchCitation['purpose'] = 'company_knowledge';
      
      switch (finding.finding_type) {
        case 'problem_identified':
          purpose = 'problem_evidence';
          break;
        case 'market_opportunity':
          purpose = 'industry_insight';
          break;
        case 'team_insight':
          purpose = 'company_knowledge';
          break;
        case 'competitive_insight':
          purpose = 'industry_insight';
          break;
        default:
          purpose = 'credibility';
      }

      // Extract a concise citation from the finding content
      const citationText = finding.content.length > 150 
        ? finding.content.substring(0, 147) + '...'
        : finding.content;

      return {
        finding_id: finding.id,
        citation_text: citationText,
        purpose
      };
    });
  }

  private async generateEmailContent(
    project: ProjectArtifact,
    companyContext: CompanyContext,
    personalizationElements: PersonalizationElement[],
    citations: ResearchCitation[],
    config: EmailGenerationConfig
  ): Promise<{
    subject_line: string;
    email_body: string;
    call_to_action: string;
  }> {
    
    const lengthGuidelines = {
      short: "Keep email under 150 words, 3-4 sentences max",
      medium: "Keep email between 150-250 words, 1-2 paragraphs",
      long: "Email can be 250-400 words, 2-3 paragraphs with more detail"
    };

    const toneGuidelines = {
      professional: "Formal, respectful, business-focused language",
      casual: "Friendly, conversational, approachable tone",
      technical: "Technical depth, engineering terminology, solution-focused",
      executive: "Strategic, high-level, ROI-focused, results-oriented"
    };

    const personaGuidelines = {
      cto: "Focus on technical architecture, scalability, security, strategic technology decisions",
      vp_engineering: "Focus on team efficiency, process optimization, technical debt, engineering metrics",
      founder: "Focus on business impact, competitive advantage, growth potential, resource optimization",
      product_manager: "Focus on user experience, product roadmap, feature development, market positioning",
      technical_lead: "Focus on implementation details, technical solutions, best practices, team collaboration"
    };

    const emailPrompt = `Create a compelling cold outreach email for ${companyContext.companyName}.

PROJECT DETAILS:
Title: ${project.title}
Description: ${project.description}
Problem Statement: ${project.problem_statement}
Proposed Solution: ${project.proposed_solution}
Type: ${project.type}
Estimated Impact: ${project.estimated_impact}
Timeline: ${project.timeline_estimate}
Deliverables: ${project.deliverables.join(', ')}

PERSONALIZATION ELEMENTS:
${personalizationElements.map(el => `- ${el.type}: ${el.content}`).join('\n')}

RESEARCH EVIDENCE:
${citations.map(c => `- ${c.purpose}: ${c.citation_text}`).join('\n')}

EMAIL CONFIGURATION:
Length: ${lengthGuidelines[config.length || 'medium']}
Tone: ${toneGuidelines[config.tone || 'professional']}
Target Persona: ${personaGuidelines[config.targetPersona || 'technical_lead']}
Include Credentials: ${config.includeCredentials || false}
Include Portfolio: ${config.includePortfolio || false}
Focus on Value: ${config.focusOnValue || true}
Urgency Level: ${config.urgencyLevel || 'medium'}

REQUIREMENTS:
1. Subject line must be compelling and specific (40-60 chars)
2. Opening must reference specific research to prove credibility
3. Problem identification must be precise and evidence-based
4. Solution preview must be tantalizing but not give everything away
5. Call to action must be specific and low-commitment
6. Tone must match the target persona and configuration
7. Include 2-3 personalization elements naturally
8. Reference specific business value/impact

OUTPUT FORMAT (JSON):
{
  "subject_line": "Compelling, specific subject line",
  "email_body": "Complete email body with natural personalization",
  "call_to_action": "Specific, low-commitment next step"
}

Make it feel like you've been researching them specifically, not sending a template.`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert B2B sales copywriter specializing in technical consulting outreach. Your emails generate high response rates through precise personalization and value demonstration. Return only valid JSON."
        },
        {
          role: "user",
          content: emailPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: "json_object" }
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('Failed to generate email content');
    }

    return JSON.parse(response);
  }

  private async generateEmailVariants(
    originalEmail: { subject_line: string; email_body: string; call_to_action: string },
    config: EmailGenerationConfig
  ): Promise<EmailVariant[]> {
    
    const variantPrompt = `Create 2-3 email variants for A/B testing based on this original email:

ORIGINAL EMAIL:
Subject: ${originalEmail.subject_line}
Body: ${originalEmail.email_body}
CTA: ${originalEmail.call_to_action}

Create variants that test:
1. Different subject line approaches (urgency vs curiosity vs benefit)
2. Different opening hooks (problem vs achievement vs insight)
3. Different CTAs (meeting vs call vs demo vs audit)

Each variant should maintain the core value proposition but explore different psychological triggers.

OUTPUT FORMAT (JSON):
{
  "variants": [
    {
      "variant_name": "Variant A - Urgency Focus",
      "subject_line": "Alternative subject line",
      "email_body": "Modified email body",
      "key_differences": ["What makes this variant unique"]
    }
  ]
}`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an A/B testing expert who creates email variants for maximum response rates. Return only valid JSON."
        },
        {
          role: "user",
          content: variantPrompt
        }
      ],
      temperature: 0.8,
      max_tokens: 1200,
      response_format: { type: "json_object" }
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      return [];
    }

    const result = JSON.parse(response);
    return result.variants || [];
  }

  private estimateResponseRate(
    emailContent: { subject_line: string; email_body: string; call_to_action: string },
    personalizationElements: PersonalizationElement[],
    config: EmailGenerationConfig
  ): number {
    
    let baseRate = 0.05; // 5% base response rate for cold outreach
    
    // Personalization quality factor
    const highConfidenceElements = personalizationElements.filter(e => e.confidence_score > 0.7);
    baseRate += highConfidenceElements.length * 0.02; // +2% per high-confidence element
    
    // Subject line quality (rough heuristic)
    const subjectLength = emailContent.subject_line.length;
    if (subjectLength >= 40 && subjectLength <= 60) {
      baseRate += 0.01; // Optimal length
    }
    
    // Email length factor
    const emailLength = emailContent.email_body.length;
    if (emailLength >= 150 && emailLength <= 250) {
      baseRate += 0.015; // Optimal length range
    } else if (emailLength > 400) {
      baseRate -= 0.02; // Too long penalty
    }
    
    // Tone appropriateness
    if (config.targetPersona === 'founder' && config.tone === 'executive') {
      baseRate += 0.01;
    } else if (config.targetPersona === 'cto' && config.tone === 'technical') {
      baseRate += 0.01;
    }
    
    // Value focus bonus
    if (config.focusOnValue) {
      baseRate += 0.01;
    }
    
    // Urgency penalty for cold outreach
    if (config.urgencyLevel === 'high') {
      baseRate -= 0.015;
    }

    return Math.max(0.01, Math.min(0.25, baseRate)); // Cap between 1% and 25%
  }

  // Utility methods for email optimization
  async optimizeSubjectLine(
    originalSubject: string,
    companyName: string,
    personalizationElements: PersonalizationElement[]
  ): Promise<string[]> {
    
    const optimizationPrompt = `Optimize this subject line for higher open rates:

Original: "${originalSubject}"
Company: ${companyName}
Personalization Available: ${personalizationElements.map(e => e.content).join('; ')}

Create 5 optimized subject line alternatives that:
1. Are 40-60 characters long
2. Include company-specific elements when possible
3. Create curiosity without being clickbait
4. Avoid spam trigger words
5. Test different psychological triggers (urgency, benefit, curiosity, social proof, problem)

Return as JSON: { "subject_lines": ["option1", "option2", ...] }`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a subject line optimization expert. Return only valid JSON." },
        { role: "user", content: optimizationPrompt }
      ],
      temperature: 0.8,
      response_format: { type: "json_object" }
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      return [originalSubject];
    }

    const result = JSON.parse(response);
    return result.subject_lines || [originalSubject];
  }

  async analyzeEmailEffectiveness(
    template: EmailTemplate
  ): Promise<{
    strengths: string[];
    weaknesses: string[];
    improvements: string[];
    spamRisk: number;
  }> {
    
    const analysisPrompt = `Analyze this email template for effectiveness:

SUBJECT: ${template.subject_line}
BODY: ${template.email_body}
CTA: ${template.call_to_action}
TONE: ${template.tone}
PERSONALIZATION: ${template.personalization_elements.length} elements

Provide:
1. Strengths (what works well)
2. Weaknesses (potential issues)
3. Specific improvements
4. Spam risk score (0-1)

Return as JSON: { strengths: string[], weaknesses: string[], improvements: string[], spamRisk: number }`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are an email effectiveness analyst. Return only valid JSON." },
        { role: "user", content: analysisPrompt }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      return { strengths: [], weaknesses: [], improvements: [], spamRisk: 0.5 };
    }

    return JSON.parse(response);
  }

  // Method to generate follow-up email sequences
  async generateFollowUpSequence(
    originalTemplate: EmailTemplate,
    sequenceLength: number = 3
  ): Promise<EmailTemplate[]> {
    
    const followUps: EmailTemplate[] = [];
    
    for (let i = 1; i <= sequenceLength; i++) {
      const followUpPrompt = `Create follow-up email #${i} for this original outreach:

ORIGINAL EMAIL:
Subject: ${originalTemplate.subject_line}
Body: ${originalTemplate.email_body}

This is follow-up #${i} of ${sequenceLength}. 
- Follow-up #1: Should reference the original email and add new value
- Follow-up #2: Should take a different angle (case study, industry insight)
- Follow-up #3: Should be the final attempt with a different CTA

Tone should be ${originalTemplate.tone} and maintain professionalism while adding urgency appropriately.

Return as JSON: { subject_line: string, email_body: string, call_to_action: string }`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a follow-up email sequence expert. Return only valid JSON." },
          { role: "user", content: followUpPrompt }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      });

      const response = completion.choices[0]?.message?.content;
      if (response) {
        const followUpContent = JSON.parse(response);
        
        const followUpTemplate: EmailTemplate = {
          ...originalTemplate,
          id: randomUUID(),
          template_type: 'follow_up',
          subject_line: followUpContent.subject_line,
          email_body: followUpContent.email_body,
          call_to_action: followUpContent.call_to_action,
          metadata: {
            ...originalTemplate.metadata,
            sequence_position: i,
            sequence_length: sequenceLength,
            original_template_id: originalTemplate.id
          },
          created_at: new Date(),
          updated_at: new Date()
        };
        
        followUps.push(followUpTemplate);
      }
    }
    
    return followUps;
  }
}

export default EmailTemplateCreator;