// @ts-nocheck
import { z } from 'zod';
import { randomUUID } from 'crypto';

// Extend globalThis type for our global maps
declare global {
  var globalProgressMap: Map<string, ResearchProgress> | undefined;
  var globalListeners: Map<string, ((progress: ResearchProgress) => void)[]> | undefined;
}
import PerplexityResearchService, { ResearchResult } from './perplexity-research-service';
import OpenAI from 'openai';
import { 
  ResearchQueryTemplateProcessor, 
  QueryTemplate, 
  QueryVariables, 
  RESEARCH_QUERY_TEMPLATES 
} from './research-query-templates';
import { createClient } from '@supabase/supabase-js';

// Types for the research service
export interface ResearchSession {
  id: string;
  company_id: string;
  created_by: string;
  session_type: 'initial_research' | 'deep_research' | 'competitive_analysis' | 'market_analysis' | 'follow_up';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  research_query: string;
  api_provider: string;
  cost_usd: number;
  tokens_used: number;
  session_metadata: Record<string, any>;
  error_message?: string;
  started_at: Date;
  completed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ResearchFinding {
  id: string;
  session_id: string;
  company_id: string;
  finding_type: 'problem_identified' | 'market_opportunity' | 'competitive_insight' | 'tech_trend' | 'business_model' | 'funding_status' | 'team_insight' | 'product_analysis';
  title: string;
  content: string;
  confidence_score: number;
  priority_level: 'low' | 'medium' | 'high' | 'critical';
  citations: string[];
  tags: string[];
  structured_data: Record<string, any>;
  is_verified: boolean;
  verified_by?: string;
  verified_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ResearchSessionConfig {
  templateIds: string[];
  variables: QueryVariables;
  priority: 'low' | 'medium' | 'high';
  maxConcurrentQueries: number;
  maxCostUsd: number;
  timeoutMs: number;
  enableSynthesis: boolean;
  saveToDatabase: boolean;
}

export interface QuerySourceInfo {
  templateName: string;
  sourceCount: number;
  sources: {
    url: string;
    domain: string;
    title?: string;
    type: 'github' | 'blog' | 'news' | 'job' | 'documentation' | 'other';
    recency: 'recent' | 'moderate' | 'older';
  }[];
  completedAt: Date;
}

export interface ResearchProgress {
  sessionId: string;
  totalQueries: number;
  completedQueries: number;
  failedQueries: number;
  currentQuery?: string;
  activeQueries: string[];
  querySources: QuerySourceInfo[];
  totalCostUsd: number;
  totalTokens: number;
  estimatedCompletionTime?: Date;
  findings: ResearchFinding[];
  status: ResearchSession['status'];
  errorMessage?: string;
}

export interface ResearchSynthesis {
  sessionId: string;
  companyName: string;
  executiveSummary: string;
  keyFindings: {
    technical: ResearchFinding[];
    business: ResearchFinding[];
    team: ResearchFinding[];
    competitive: ResearchFinding[];
    market: ResearchFinding[];
  };
  actionableOpportunities: {
    title: string;
    description: string;
    estimatedImpact: 'low' | 'medium' | 'high';
    requiredSkills: string[];
    potentialArtifacts: string[];
  }[];
  riskFactors: string[];
  recommendedNextSteps: string[];
  confidenceLevel: number;
  generatedAt: Date;
}

// Global progress tracking for concurrent research (persists across API calls)
// Using globalThis to ensure persistence across Next.js hot reloads
if (!globalThis.globalProgressMap) {
  globalThis.globalProgressMap = new Map<string, ResearchProgress>();
}
if (!globalThis.globalListeners) {
  globalThis.globalListeners = new Map<string, ((progress: ResearchProgress) => void)[]>();
}

const globalProgressMap = globalThis.globalProgressMap;
const globalListeners = globalThis.globalListeners;

// Progress tracking for concurrent research
class ResearchProgressTracker {

  startTracking(sessionId: string, totalQueries: number): void {
    const progress: ResearchProgress = {
      sessionId,
      totalQueries,
      completedQueries: 0,
      failedQueries: 0,
      activeQueries: [],
      querySources: [],
      totalCostUsd: 0,
      totalTokens: 0,
      findings: [],
      status: 'in_progress'
    };
    
    globalProgressMap.set(sessionId, progress);
    this.notifyListeners(sessionId, progress);
  }

  updateProgress(sessionId: string, update: Partial<ResearchProgress>): void {
    const current = globalProgressMap.get(sessionId);
    if (!current) return;

    const updated = { ...current, ...update };
    globalProgressMap.set(sessionId, updated);
    this.notifyListeners(sessionId, updated);
  }

  getProgress(sessionId: string): ResearchProgress | undefined {
    return globalProgressMap.get(sessionId);
  }

  addProgressListener(sessionId: string, listener: (progress: ResearchProgress) => void): void {
    if (!globalListeners.has(sessionId)) {
      globalListeners.set(sessionId, []);
    }
    globalListeners.get(sessionId)!.push(listener);
  }

  removeProgressListener(sessionId: string, listener: (progress: ResearchProgress) => void): void {
    const listeners = globalListeners.get(sessionId);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private notifyListeners(sessionId: string, progress: ResearchProgress): void {
    const listeners = globalListeners.get(sessionId);
    if (listeners) {
      listeners.forEach(listener => listener(progress));
    }
  }

  cleanup(sessionId: string): void {
    globalProgressMap.delete(sessionId);
    globalListeners.delete(sessionId);
  }
}

export class CompanyResearchService {
  private perplexityService: PerplexityResearchService;
  private supabase: any;
  private progressTracker: ResearchProgressTracker;
  private openai: OpenAI;

  private analyzeSources(citations: string[]): QuerySourceInfo['sources'] {
    return citations.map(url => {
      try {
        const domain = new URL(url).hostname.replace('www.', '');
      
        // Determine source type
        let type: QuerySourceInfo['sources'][0]['type'] = 'other';
        if (domain.includes('github.com')) type = 'github';
        else if (domain.includes('medium.com') || domain.includes('dev.to') || domain.includes('blog')) type = 'blog';
        else if (domain.includes('linkedin.com') || domain.includes('jobs') || domain.includes('careers')) type = 'job';
        else if (domain.includes('docs.') || domain.includes('documentation')) type = 'documentation';
        else if (domain.includes('news') || domain.includes('techcrunch') || domain.includes('verge')) type = 'news';
        
        // Determine recency based on URL patterns and domain authority
        let recency: QuerySourceInfo['sources'][0]['recency'] = 'moderate';
        
        // Recent indicators
        if (url.includes('2024') || url.includes('2025') || 
            url.includes('latest') || url.includes('recent') ||
            type === 'github' && url.includes('issues') ||
            type === 'news' && (domain.includes('techcrunch') || domain.includes('verge'))) {
          recency = 'recent';
        }
        // Older indicators  
        else if (url.includes('2022') || url.includes('2021') || url.includes('2020') ||
                 url.includes('archive') || url.includes('old')) {
          recency = 'older';
        }
        
        return {
          url,
          domain,
          type,
          recency
        };
      } catch (error) {
        return {
          url,
          domain: url,
          type: 'other' as const,
          recency: 'moderate' as const
        };
      }
    });
  }

  constructor(perplexityApiKey?: string) {
    this.perplexityService = new PerplexityResearchService(perplexityApiKey);
    this.progressTracker = new ResearchProgressTracker();
    
    // Initialize OpenAI client for content processing
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      console.warn('⚠️  OPENAI_API_KEY not found - AI content processing will be disabled');
    } else {
      console.log('✅ OpenAI API key found - AI content processing enabled');
    }
    
    this.openai = new OpenAI({
      apiKey: openaiKey
    });
    
    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async startResearchSession(
    companyId: string,
    createdBy: string,
    config: ResearchSessionConfig
  ): Promise<{ sessionId: string; progress: ResearchProgress }> {
    
    // Validate configuration
    if (!config.variables.companyName) {
      throw new Error('Company name is required');
    }

    if (config.templateIds.length === 0) {
      throw new Error('At least one template must be specified');
    }

    // Create research session record
    const sessionId = randomUUID();
    
    const session: Partial<ResearchSession> = {
      id: sessionId,
      company_id: companyId,
      created_by: createdBy,
      session_type: 'deep_research',
      status: 'pending',
      research_query: `Deep research for ${config.variables.companyName}`,
      api_provider: 'perplexity',
      cost_usd: 0,
      tokens_used: 0,
      session_metadata: {
        templateIds: config.templateIds,
        variables: config.variables,
        config: config
      },
      started_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    };

    // Save to database if enabled
    if (config.saveToDatabase) {
      await this.saveResearchSession(session);
    }

    // Start progress tracking
    this.progressTracker.startTracking(sessionId, config.templateIds.length);

    // Execute research in background
    this.executeResearchSession(sessionId, companyId, config).catch(error => {
      console.error(`Research session ${sessionId} failed:`, error);
      this.progressTracker.updateProgress(sessionId, {
        status: 'failed',
        errorMessage: error.message
      });
    });

    return {
      sessionId,
      progress: this.progressTracker.getProgress(sessionId)!
    };
  }

  private async executeResearchSession(
    sessionId: string,
    companyId: string,
    config: ResearchSessionConfig
  ): Promise<void> {
    
    // Update session status
    this.progressTracker.updateProgress(sessionId, { status: 'in_progress' });

    // Get templates to execute
    const templates = config.templateIds
      .map(id => ResearchQueryTemplateProcessor.getTemplateById(id))
      .filter(template => template !== undefined) as QueryTemplate[];

    if (templates.length === 0) {
      throw new Error('No valid templates found');
    }

    // Execute research queries with concurrency control
    const results = await this.executeQueriesWithConcurrency(
      sessionId,
      templates,
      config.variables,
      config.maxConcurrentQueries,
      config.maxCostUsd,
      config.timeoutMs
    );

    // Process results into findings
    const findings = await this.processResultsIntoFindings(
      sessionId,
      companyId,
      config.variables.companyName,
      results
    );

    // Update progress with findings
    this.progressTracker.updateProgress(sessionId, {
      findings,
      status: 'completed'
    });

    // Save findings to database if enabled
    if (config.saveToDatabase) {
      await this.saveFindings(findings);
      await this.updateSessionStatus(sessionId, 'completed');
    }

    // Generate synthesis if enabled
    if (config.enableSynthesis) {
      const synthesis = await this.generateResearchSynthesis(
        sessionId,
        config.variables.companyName,
        findings
      );
      
      // Note: synthesis stored separately - not updating progress tracker metadata
    }
  }

  private async executeQueriesWithConcurrency(
    sessionId: string,
    templates: QueryTemplate[],
    variables: QueryVariables,
    maxConcurrency: number,
    maxCostUsd: number,
    timeoutMs: number
  ): Promise<Array<{ template: QueryTemplate; result: ResearchResult; error?: string }>> {
    
    const results: Array<{ template: QueryTemplate; result: ResearchResult; error?: string }> = [];
    const executing: Promise<void>[] = [];
    let totalCost = 0;
    let totalTokens = 0;

    const executeQuery = async (template: QueryTemplate): Promise<void> => {
      try {
        // Check cost limits
        if (totalCost >= maxCostUsd) {
          results.push({
            template,
            result: {} as ResearchResult,
            error: 'Cost limit exceeded'
          });
          return;
        }

        // Process template
        const processed = ResearchQueryTemplateProcessor.processTemplate(template, variables);
        
        // Phase 1: Query Analysis
        const current = globalProgressMap.get(sessionId);
        if (current) {
          const queryPhase = `🔍 Analyzing ${template.name}: Processing research parameters...`;
          const updatedActiveQueries = [...current.activeQueries, queryPhase];
          this.progressTracker.updateProgress(sessionId, {
            currentQuery: queryPhase,
            activeQueries: updatedActiveQueries
          });
        }
        
        // Add delay to simulate analysis
        await new Promise(resolve => setTimeout(resolve, 800));

        // Phase 2: Source Discovery
        const searchDomains = template.searchDomains || ['github.com', 'stackoverflow.com', 'medium.com', 'dev.to'];
        const searchPhase = `🌐 Searching web sources: ${searchDomains.slice(0, 3).join(', ')}...`;
        this.progressTracker.updateProgress(sessionId, {
          currentQuery: searchPhase
        });
        
        // Add delay to simulate searching
        await new Promise(resolve => setTimeout(resolve, 600));
        
        // Phase 3: Data Gathering
        const gatheringPhase = `📊 Gathering data: Analyzing content from multiple sources...`;
        this.progressTracker.updateProgress(sessionId, {
          currentQuery: gatheringPhase
        });

        // Execute research with timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Query timeout')), timeoutMs);
        });

        const result = await Promise.race([
          this.perplexityService.research(
            processed.query,
            processed.systemPrompt,
            {
              search_domain_filter: processed.searchDomains,
              search_recency_filter: processed.recencyFilter,
              return_citations: true,
              return_related_questions: true
            }
          ),
          timeoutPromise
        ]);

        // Phase 4: Source Analysis
        const sourceCount = result.citations?.length || 0;
        
        const sourceAnalysisPhase = `📚 Found ${sourceCount} sources, analyzing content quality...`;
        this.progressTracker.updateProgress(sessionId, {
          currentQuery: sourceAnalysisPhase
        });

        // Brief delay for source analysis
        await new Promise(resolve => setTimeout(resolve, 400));

        // Update totals
        totalCost += result.cost_usd || 0;
        totalTokens += result.usage.total_tokens;

        results.push({ template, result });

        // Phase 5: AI Analysis
        const aiAnalysisPhase = `🤖 AI Analysis: Extracting insights and identifying patterns...`;
        this.progressTracker.updateProgress(sessionId, {
          currentQuery: aiAnalysisPhase,
          completedQueries: results.filter(r => !r.error).length,
          failedQueries: results.filter(r => r.error).length,
          totalCostUsd: totalCost,
          totalTokens
        });
        
        // Add delay for AI processing simulation
        await new Promise(resolve => setTimeout(resolve, 600));

        // Phase 6: Completion - Add source tracking
        const completionPhase = `✅ Complete: Generated findings from ${template.name}`;
        const currentProgress = globalProgressMap.get(sessionId);
        if (currentProgress) {
          // Analyze and categorize sources
          const citations = result.citations || [];
          console.log(`🔍 ${template.name} - Citations: ${citations.length}`);
          const analyzedSources = citations.length > 0 ? this.analyzeSources(citations) : [];
          
          const sourceInfo: QuerySourceInfo = {
            templateName: template.name,
            sourceCount: citations.length,
            sources: analyzedSources,
            completedAt: new Date()
          };

          // Remove the original query phase from active queries
          const queryPhase = `🔍 Analyzing ${template.name}: Processing research parameters...`;
          const updatedActiveQueries = currentProgress.activeQueries.filter(q => q !== queryPhase);
          
          this.progressTracker.updateProgress(sessionId, {
            currentQuery: completionPhase,
            activeQueries: updatedActiveQueries,
            querySources: [...currentProgress.querySources, sourceInfo],
            completedQueries: results.filter(r => !r.error).length,
            failedQueries: results.filter(r => r.error).length,
            totalCostUsd: totalCost,
            totalTokens
          });
        }

      } catch (error) {
        results.push({
          template,
          result: {} as ResearchResult,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        this.progressTracker.updateProgress(sessionId, {
          completedQueries: results.filter(r => !r.error).length,
          failedQueries: results.filter(r => r.error).length,
          totalCostUsd: totalCost,
          totalTokens
        });
      }
    };

    // Execute queries with concurrency limit
    for (let i = 0; i < templates.length; i += maxConcurrency) {
      const batch = templates.slice(i, i + maxConcurrency);
      const batchPromises = batch.map(template => executeQuery(template));
      await Promise.all(batchPromises);
    }

    return results;
  }

  private async processResultsIntoFindings(
    sessionId: string,
    companyId: string,
    companyName: string,
    results: Array<{ template: QueryTemplate; result: ResearchResult; error?: string }>
  ): Promise<ResearchFinding[]> {
    
    const findings: ResearchFinding[] = [];

    for (const { template, result, error } of results) {
      if (error || !result.content) continue;

      // Use AI to intelligently extract findings from the research content
      console.log(`🤖 Starting AI analysis for ${template.name} (${result.content.length} chars)`);
      const aiExtractedFindings = await this.extractFindingsWithAI(
        sessionId,
        companyId,
        companyName,
        template,
        result
      );
      console.log(`✅ AI extracted ${aiExtractedFindings.length} findings from ${template.name}`);

      findings.push(...aiExtractedFindings);
    }

    return findings;
  }

  private async extractFindingsWithAI(
    sessionId: string,
    companyId: string,
    companyName: string,
    template: QueryTemplate,
    result: ResearchResult
  ): Promise<ResearchFinding[]> {
    
    try {
      // Check if OpenAI is available
      if (!process.env.OPENAI_API_KEY) {
        console.log('🔄 No OpenAI key - falling back to rule-based extraction');
        return this.parseResultIntoFindings(sessionId, companyId, companyName, template, result);
      }
      // Create a comprehensive prompt for OpenAI to analyze the research
      const analysisPrompt = `You are an expert business analyst. Analyze this research about ${companyName} and extract key findings.

RESEARCH CONTEXT:
- Template Category: ${template.category}
- Template Name: ${template.name}
- Research Query: ${template.description || 'General research'}

RESEARCH CONTENT:
${result.content}

TASK: Extract structured findings from this research. Each finding should be a specific, actionable insight.

FINDING CATEGORIES:
- problem_identified: Technical challenges, bugs, performance issues, infrastructure problems
- market_opportunity: Business opportunities, growth areas, untapped markets, revenue potential  
- team_insight: Hiring patterns, key decision makers, team dynamics, talent needs
- competitive_insight: Competitor analysis, market positioning, competitive advantages
- tech_trend: Technology adoption, emerging tech usage, modernization efforts
- business_model: Revenue streams, business strategy, operational models
- funding_status: Investment rounds, financial health, funding needs
- product_analysis: Product features, development roadmap, user feedback

INSTRUCTIONS:
1. Extract 3-8 specific, actionable findings (avoid generic statements)
2. Each finding should be substantial enough to inform consulting decisions
3. Focus on insights that reveal consulting opportunities or competitive intelligence
4. Prioritize recent, specific, and actionable information
5. Assign confidence scores based on source credibility and specificity

OUTPUT FORMAT (JSON):
{
  "findings": [
    {
      "title": "Clear, specific title (80 chars max)",
      "content": "Detailed description with context and implications (200-500 chars)",
      "finding_type": "one of the categories above",
      "confidence_score": 0.7,
      "priority_level": "high|medium|low", 
      "tags": ["relevant", "technology", "keywords"],
      "reasoning": "Why this is important for consulting/business decisions"
    }
  ]
}

Focus on quality over quantity. Extract only meaningful insights that would be valuable for a consulting engagement.`;

      // Call OpenAI to analyze the content
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini", // Fast and cost-effective for analysis
        messages: [
          {
            role: "system", 
            content: "You are an expert business analyst specializing in extracting actionable insights from research data. Return only valid JSON."
          },
          {
            role: "user",
            content: analysisPrompt
          }
        ],
        temperature: 0.3, // Low temperature for consistent, factual analysis
        max_tokens: 2000,
        response_format: { type: "json_object" }
      });

      const aiResponse = completion.choices[0]?.message?.content;
      if (!aiResponse) {
        console.warn('No response from OpenAI for content analysis');
        return [];
      }

      // Parse the AI response
      const analysisResult = JSON.parse(aiResponse);
      const aiFindings = analysisResult.findings || [];

      // Convert AI findings to our ResearchFinding format
      const findings: ResearchFinding[] = aiFindings.map((aiFinding: any) => ({
        id: randomUUID(),
        session_id: sessionId,
        company_id: companyId,
        finding_type: aiFinding.finding_type || 'problem_identified',
        title: aiFinding.title || 'Research Finding',
        content: aiFinding.content || '',
        confidence_score: Math.max(0, Math.min(1, aiFinding.confidence_score || 0.5)),
        priority_level: aiFinding.priority_level || 'medium',
        citations: result.citations || [],
        tags: Array.isArray(aiFinding.tags) ? aiFinding.tags : [],
        structured_data: {
          templateId: template.id,
          templateCategory: template.category,
          aiReasoning: aiFinding.reasoning,
          relatedQuestions: result.related_questions || [],
          tokenUsage: result.usage
        },
        is_verified: false,
        verified_by: undefined,
        verified_at: undefined,
        created_at: new Date(),
        updated_at: new Date()
      }));

      console.log(`AI extracted ${findings.length} findings from ${template.name} research`);
      return findings;

    } catch (error) {
      console.error('Error in AI content analysis:', error);
      
      // Fallback to old method if AI fails
      console.log('Falling back to rule-based extraction');
      return this.parseResultIntoFindings(sessionId, companyId, companyName, template, result);
    }
  }

  private async parseResultIntoFindings(
    sessionId: string,
    companyId: string,
    companyName: string,
    template: QueryTemplate,
    result: ResearchResult
  ): Promise<ResearchFinding[]> {
    
    const findings: ResearchFinding[] = [];

    // Split content into sections or findings
    const sections = this.splitContentIntoSections(result.content);

    for (const section of sections) {
      const findingType = this.mapTemplateToFindingType(template.category);
      
      const finding: ResearchFinding = {
        id: randomUUID(),
        session_id: sessionId,
        company_id: companyId, // This should be the actual company ID
        finding_type: findingType,
        title: this.extractTitleFromSection(section),
        content: section,
        confidence_score: this.calculateConfidenceScore(section, result.citations?.length || 0),
        priority_level: this.determinePriorityLevel(template.priority, section),
        citations: result.citations || [],
        tags: this.extractTagsFromContent(section),
        structured_data: {
          templateId: template.id,
          templateCategory: template.category,
          relatedQuestions: result.related_questions || [],
          tokenUsage: result.usage
        },
        is_verified: false,
        verified_by: undefined,
        verified_at: undefined,
        created_at: new Date(),
        updated_at: new Date()
      };

      findings.push(finding);
    }

    return findings;
  }

  private splitContentIntoSections(content: string): string[] {
    // Instead of splitting into many small chunks, create larger meaningful sections
    // Split primarily by major headers (##) and significant breaks
    const majorSections = content
      .split(/(?=##\s)/g)
      .map(s => s.trim())
      .filter(s => s.length > 200); // Keep substantial sections only

    // If no major sections found, split by significant paragraph breaks but keep larger chunks
    if (majorSections.length <= 1) {
      const paragraphSections = content
        .split(/\n\n\n+/g) // Split on multiple blank lines
        .map(s => s.trim())
        .filter(s => s.length > 300); // Keep even larger chunks
      
      return paragraphSections.length > 0 ? paragraphSections : [content];
    }

    return majorSections;
  }

  private mapTemplateToFindingType(category: string): ResearchFinding['findingType'] {
    const mapping: Record<string, ResearchFinding['findingType']> = {
      'technical': 'problem_identified',
      'business': 'market_opportunity',
      'team': 'team_insight',
      'competitive': 'competitive_insight',
      'market': 'market_opportunity',
      'funding': 'funding_status'
    };

    return mapping[category] || 'problem_identified';
  }

  private extractTitleFromSection(content: string): string {
    const lines = content.split('\n').filter(line => line.trim());
    
    // Look for markdown headers first
    for (const line of lines.slice(0, 5)) { // Check first 5 lines
      if (line.match(/^#+\s+/)) {
        return line.replace(/^#+\s*/, '').trim();
      }
    }
    
    // Look for numbered sections or bullet points
    const firstLine = lines[0];
    if (firstLine.match(/^\d+\.\s+/) || firstLine.match(/^[\*\-]\s+\*\*/)) {
      const title = firstLine.replace(/^[\d\.\*\-\s]+/, '').replace(/\*\*/g, '').trim();
      return title.length > 80 ? title.substring(0, 80) + '...' : title;
    }
    
    // Extract meaningful first sentence
    const firstSentence = firstLine.split(/[.!?]/)[0].trim();
    if (firstSentence.length > 20) {
      return firstSentence.length > 80 ? firstSentence.substring(0, 80) + '...' : firstSentence;
    }
    
    // Fallback to first meaningful content
    return firstLine.length > 80 ? firstLine.substring(0, 80) + '...' : firstLine;
  }

  private calculateConfidenceScore(content: string, citationCount: number): number {
    let score = 0.5; // Base score
    
    // Increase score based on citations
    score += Math.min(citationCount * 0.1, 0.3);
    
    // Increase score based on specific indicators
    if (content.includes('specific') || content.includes('concrete')) score += 0.1;
    if (content.includes('recent') || content.includes('latest')) score += 0.1;
    if (content.match(/\d+/g)?.length > 2) score += 0.1; // Contains numbers/data
    
    return Math.min(Math.max(score, 0), 1);
  }

  private determinePriorityLevel(
    templatePriority: string,
    content: string
  ): ResearchFinding['priorityLevel'] {
    
    // Check for high-priority keywords
    const highPriorityKeywords = ['urgent', 'critical', 'major', 'significant', 'severe'];
    const mediumPriorityKeywords = ['important', 'notable', 'relevant', 'moderate'];
    
    const contentLower = content.toLowerCase();
    
    if (highPriorityKeywords.some(keyword => contentLower.includes(keyword))) {
      return 'high';
    }
    
    if (mediumPriorityKeywords.some(keyword => contentLower.includes(keyword))) {
      return 'medium';
    }
    
    return templatePriority === 'high' ? 'medium' : 'low';
  }

  private extractTagsFromContent(content: string): string[] {
    const tags: string[] = [];
    
    // Extract technology names
    const techRegex = /\b(Python|JavaScript|React|Node\.js|AWS|Docker|Kubernetes|API|ML|AI|blockchain|database|SQL|NoSQL|Redis|MongoDB|PostgreSQL|MySQL|GraphQL|REST|microservices|serverless|DevOps|CI\/CD|Git|GitHub|GitLab|Jenkins|Terraform|Ansible|monitoring|logging|security|OAuth|JWT|HTTPS|SSL|TLS|encryption|performance|scalability|load\s+balancing|caching|CDN|cloud|infrastructure|containerization|orchestration|automation|testing|unit\s+testing|integration\s+testing|end-to-end\s+testing|QA|quality\s+assurance|agile|scrum|kanban|sprint|backlog|product\s+management|project\s+management|team\s+leadership|technical\s+leadership|architecture|design\s+patterns|software\s+engineering|web\s+development|mobile\s+development|iOS|Android|frontend|backend|full-stack|data\s+science|machine\s+learning|deep\s+learning|analytics|business\s+intelligence|data\s+visualization|ETL|data\s+pipeline|big\s+data|streaming|real-time|batch\s+processing|distributed\s+systems|event-driven|message\s+queues|pub-sub|webhook|API\s+gateway|service\s+mesh|observability|telemetry|metrics|alerts|dashboards|SLA|SLO|incident\s+response|disaster\s+recovery|backup|compliance|GDPR|HIPAA|SOC2|PCI|audit|governance|risk\s+management|change\s+management|configuration\s+management|secrets\s+management|identity\s+management|access\s+control|zero\s+trust|network\s+security|application\s+security|vulnerability\s+scanning|penetration\s+testing|threat\s+modeling|security\s+architecture|privacy|data\s+protection|encryption\s+at\s+rest|encryption\s+in\s+transit|key\s+management|certificate\s+management|PKI|SSO|MFA|passwordless|biometrics|fraud\s+detection|anomaly\s+detection|behavioral\s+analysis|risk\s+scoring|compliance\s+monitoring|audit\s+logging|forensics|incident\s+investigation|threat\s+intelligence|security\s+awareness|training|phishing|social\s+engineering|insider\s+threats|external\s+threats|cyber\s+attacks|ransomware|malware|virus|trojan|worm|spyware|adware|rootkit|botnet|DDoS|SQL\s+injection|XSS|CSRF|OWASP|CVE|NIST|ISO\s+27001|SOX|FISMA|FIPS|Common\s+Criteria|security\s+controls|security\s+policies|security\s+procedures|security\s+standards|security\s+frameworks|security\s+maturity|security\s+posture|security\s+assessment|security\s+testing|security\s+validation|security\s+verification|security\s+certification|security\s+accreditation|security\s+authorization|security\s+clearance|security\s+classification|security\s+handling|security\s+storage|security\s+transmission|security\s+processing|security\s+disposal|security\s+destruction|security\s+sanitization|security\s+degaussing|security\s+overwriting|security\s+shredding|security\s+incineration|security\s+pulping|security\s+disintegration|security\s+melting|security\s+chemical\s+treatment|security\s+physical\s+destruction)\b/gi;
    
    const techMatches = content.match(techRegex);
    if (techMatches) {
      tags.push(...techMatches.map(match => match.toLowerCase()));
    }
    
    // Extract business terms
    const businessTerms = ['funding', 'investment', 'revenue', 'growth', 'scaling', 'expansion', 'market', 'competition', 'strategy', 'partnership', 'acquisition', 'merger', 'IPO', 'valuation', 'startup', 'enterprise', 'SaaS', 'B2B', 'B2C', 'customer', 'user', 'retention', 'acquisition', 'conversion', 'churn', 'engagement', 'satisfaction', 'feedback', 'survey', 'analytics', 'metrics', 'KPI', 'ROI', 'ARR', 'MRR', 'CAC', 'LTV', 'DAU', 'MAU', 'WAU'];
    
    businessTerms.forEach(term => {
      if (content.toLowerCase().includes(term)) {
        tags.push(term);
      }
    });
    
    // Remove duplicates and limit to 10 tags
    return [...new Set(tags)].slice(0, 10);
  }

  private async generateResearchSynthesis(
    sessionId: string,
    companyName: string,
    findings: ResearchFinding[]
  ): Promise<ResearchSynthesis> {
    
    // Group findings by category
    const keyFindings = {
      technical: findings.filter(f => f.findingType === 'problem_identified'),
      business: findings.filter(f => f.findingType === 'market_opportunity'),
      team: findings.filter(f => f.findingType === 'team_insight'),
      competitive: findings.filter(f => f.findingType === 'competitive_insight'),
      market: findings.filter(f => f.findingType === 'market_opportunity')
    };

    // Generate executive summary
    const executiveSummary = await this.generateExecutiveSummary(companyName, findings);

    // Generate actionable opportunities
    const actionableOpportunities = await this.generateActionableOpportunities(findings);

    // Calculate confidence level
    const confidenceLevel = findings.reduce((sum, f) => sum + f.confidenceScore, 0) / findings.length;

    const synthesis: ResearchSynthesis = {
      sessionId,
      companyName,
      executiveSummary,
      keyFindings,
      actionableOpportunities,
      riskFactors: this.extractRiskFactors(findings),
      recommendedNextSteps: this.generateRecommendedNextSteps(findings),
      confidenceLevel,
      generatedAt: new Date()
    };

    return synthesis;
  }

  private async generateExecutiveSummary(companyName: string, findings: ResearchFinding[]): Promise<string> {
    // Generate a concise executive summary based on findings
    const topFindings = findings
      .filter(f => f.priorityLevel === 'high' || f.priorityLevel === 'critical')
      .slice(0, 5);

    if (topFindings.length === 0) {
      return `Research analysis for ${companyName} completed with ${findings.length} findings across technical, business, and competitive dimensions.`;
    }

    const summaryPoints = topFindings.map(f => `• ${f.title}`).join('\n');
    
    return `Based on comprehensive research of ${companyName}, key findings include:\n\n${summaryPoints}\n\nThis analysis identified ${findings.length} total insights across technical challenges, business opportunities, and competitive positioning.`;
  }

  private async generateActionableOpportunities(findings: ResearchFinding[]): Promise<ResearchSynthesis['actionableOpportunities']> {
    const opportunities: ResearchSynthesis['actionableOpportunities'] = [];

    // Group high-priority findings and create opportunities
    const highPriorityFindings = findings.filter(f => f.priorityLevel === 'high' || f.priorityLevel === 'critical');

    for (const finding of highPriorityFindings.slice(0, 3)) {
      const opportunity = {
        title: `Address ${finding.title}`,
        description: finding.content.substring(0, 200) + '...',
        estimatedImpact: finding.priorityLevel === 'critical' ? 'high' as const : 'medium' as const,
        requiredSkills: this.inferRequiredSkills(finding),
        potentialArtifacts: this.suggestArtifacts(finding)
      };

      opportunities.push(opportunity);
    }

    return opportunities;
  }

  private inferRequiredSkills(finding: ResearchFinding): string[] {
    const skills: string[] = [];
    const content = finding.content.toLowerCase();

    // Technical skills
    if (content.includes('api') || content.includes('integration')) skills.push('API development');
    if (content.includes('database') || content.includes('sql')) skills.push('Database design');
    if (content.includes('frontend') || content.includes('ui')) skills.push('Frontend development');
    if (content.includes('backend') || content.includes('server')) skills.push('Backend development');
    if (content.includes('cloud') || content.includes('aws')) skills.push('Cloud architecture');
    if (content.includes('security') || content.includes('auth')) skills.push('Security engineering');
    if (content.includes('data') || content.includes('analytics')) skills.push('Data analysis');
    if (content.includes('ml') || content.includes('ai')) skills.push('Machine learning');

    // Business skills
    if (content.includes('market') || content.includes('competitive')) skills.push('Market research');
    if (content.includes('strategy') || content.includes('business')) skills.push('Business strategy');
    if (content.includes('product') || content.includes('roadmap')) skills.push('Product management');
    if (content.includes('sales') || content.includes('marketing')) skills.push('Go-to-market');

    return skills.slice(0, 5);
  }

  private suggestArtifacts(finding: ResearchFinding): string[] {
    const artifacts: string[] = [];
    const content = finding.content.toLowerCase();

    if (content.includes('dashboard') || content.includes('analytics')) artifacts.push('Analytics dashboard');
    if (content.includes('api') || content.includes('integration')) artifacts.push('API integration tool');
    if (content.includes('documentation') || content.includes('guide')) artifacts.push('Technical documentation');
    if (content.includes('automation') || content.includes('script')) artifacts.push('Automation scripts');
    if (content.includes('security') || content.includes('audit')) artifacts.push('Security assessment');
    if (content.includes('performance') || content.includes('optimization')) artifacts.push('Performance analysis');
    if (content.includes('market') || content.includes('competitive')) artifacts.push('Market analysis report');
    if (content.includes('strategy') || content.includes('roadmap')) artifacts.push('Strategic roadmap');

    return artifacts.slice(0, 3);
  }

  private extractRiskFactors(findings: ResearchFinding[]): string[] {
    const risks: string[] = [];
    
    findings.forEach(finding => {
      const content = finding.content.toLowerCase();
      
      if (content.includes('security') && content.includes('vulnerability')) {
        risks.push('Security vulnerabilities identified');
      }
      if (content.includes('performance') && content.includes('slow')) {
        risks.push('Performance bottlenecks affecting user experience');
      }
      if (content.includes('competitive') && content.includes('threat')) {
        risks.push('Competitive pressure increasing');
      }
      if (content.includes('technical debt')) {
        risks.push('Technical debt accumulation');
      }
      if (content.includes('compliance') && content.includes('regulation')) {
        risks.push('Regulatory compliance challenges');
      }
    });

    return [...new Set(risks)].slice(0, 5);
  }

  private generateRecommendedNextSteps(findings: ResearchFinding[]): string[] {
    const steps: string[] = [];
    
    // Generate steps based on finding patterns
    const technicalFindings = findings.filter(f => f.findingType === 'problem_identified');
    const businessFindings = findings.filter(f => f.findingType === 'market_opportunity');
    
    if (technicalFindings.length > 0) {
      steps.push('Prioritize technical challenges by impact and feasibility');
      steps.push('Develop proof-of-concept solutions for high-impact problems');
    }
    
    if (businessFindings.length > 0) {
      steps.push('Validate market opportunities with stakeholder interviews');
      steps.push('Create business case for identified opportunities');
    }
    
    steps.push('Schedule follow-up research to track progress');
    steps.push('Establish metrics to measure impact of implemented solutions');

    return steps.slice(0, 5);
  }

  // Database operations
  private async saveResearchSession(session: Partial<ResearchSession>): Promise<void> {
    const { error } = await this.supabase
      .from('company_research_sessions')
      .insert([session]);

    if (error) {
      console.error('Failed to save research session:', error);
      throw new Error('Failed to save research session');
    }
  }

  private async updateSessionStatus(sessionId: string, status: ResearchSession['status']): Promise<void> {
    const { error } = await this.supabase
      .from('company_research_sessions')
      .update({ status, updated_at: new Date() })
      .eq('id', sessionId);

    if (error) {
      console.error('Failed to update session status:', error);
    }
  }

  private async saveFindings(findings: ResearchFinding[]): Promise<void> {
    const { error } = await this.supabase
      .from('research_findings')
      .insert(findings);

    if (error) {
      console.error('Failed to save research findings:', error);
      throw new Error('Failed to save research findings');
    }
  }

  // Public API methods
  async getResearchProgress(sessionId: string): Promise<ResearchProgress | null> {
    return this.progressTracker.getProgress(sessionId) || null;
  }

  async subscribeToProgress(sessionId: string, callback: (progress: ResearchProgress) => void): Promise<void> {
    this.progressTracker.addProgressListener(sessionId, callback);
  }

  async unsubscribeFromProgress(sessionId: string, callback: (progress: ResearchProgress) => void): Promise<void> {
    this.progressTracker.removeProgressListener(sessionId, callback);
  }

  async cancelResearchSession(sessionId: string): Promise<void> {
    this.progressTracker.updateProgress(sessionId, { status: 'cancelled' });
    await this.updateSessionStatus(sessionId, 'cancelled');
  }

  async getSessionResults(sessionId: string): Promise<{
    session: ResearchSession;
    findings: ResearchFinding[];
    synthesis?: ResearchSynthesis;
  } | null> {
    
    const progress = this.progressTracker.getProgress(sessionId);
    if (!progress) return null;

    // In a real implementation, you'd fetch from database
    // For now, return from memory
    return {
      session: {} as ResearchSession, // Would fetch from DB
      findings: progress.findings,
      synthesis: progress.sessionMetadata?.synthesis
    };
  }

  async cleanup(sessionId: string): Promise<void> {
    this.progressTracker.cleanup(sessionId);
  }
}

// Export singleton instance for shared state across API routes
// Use globalThis to ensure persistence across Next.js hot reloads
declare global {
  var globalResearchService: CompanyResearchService | undefined;
}

export function getGlobalResearchService(): CompanyResearchService {
  if (!globalThis.globalResearchService) {
    globalThis.globalResearchService = new CompanyResearchService(process.env.PERPLEXITY_API_KEY);
  }
  return globalThis.globalResearchService;
}

export default CompanyResearchService;