import { z } from 'zod';
import { safeFetch, getSSRFConfig } from './security/url-validator';
import { logExternalApiCall, logError, logInfo, logDebug } from './logger';
import { getCacheService, CACHE_TTL } from './cache-service';
import { getCostGuard } from './api-cost-guard';
import { getModelSelector } from './model-selector';

// Types for Perplexity API
export interface PerplexityMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface PerplexityRequest {
  model: string;
  messages: PerplexityMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  presence_penalty?: number;
  frequency_penalty?: number;
  search_domain_filter?: string[];
  search_recency_filter?: 'month' | 'week' | 'day' | 'hour';
  return_citations?: boolean;
  return_images?: boolean;
  return_related_questions?: boolean;
}

export interface PerplexityResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
    delta?: {
      role?: string;
      content?: string;
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  citations?: string[];
  images?: string[];
  related_questions?: string[];
}

export interface ResearchSessionConfig {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  search_recency_filter?: 'month' | 'week' | 'day' | 'hour';
  return_citations?: boolean;
  return_images?: boolean;
  return_related_questions?: boolean;
  search_domain_filter?: string[];
  // Cost optimization options
  enableCaching?: boolean;
  cacheKey?: string;
  cacheTTL?: number;
  prioritizeCost?: boolean;
  maxCostUSD?: number;
  userId?: string;
  sessionId?: string;
}

export interface ResearchResult {
  content: string;
  citations?: string[];
  images?: string[];
  related_questions?: string[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  cost_usd?: number;
}

// Validation schemas
const PerplexityResponseSchema = z.object({
  id: z.string(),
  object: z.string(),
  created: z.number(),
  model: z.string(),
  choices: z.array(z.object({
    index: z.number(),
    message: z.object({
      role: z.string(),
      content: z.string(),
    }),
    finish_reason: z.string(),
  })),
  usage: z.object({
    prompt_tokens: z.number(),
    completion_tokens: z.number(),
    total_tokens: z.number(),
  }),
  citations: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
  related_questions: z.array(z.string()).optional(),
});

// Rate limiting configuration
interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  maxRequestsPerDay: number;
}

class RateLimiter {
  private requests: number[] = [];
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  async waitForAvailability(): Promise<void> {
    const now = Date.now();
    
    // Clean old requests
    this.requests = this.requests.filter(time => now - time < 60 * 60 * 1000); // Keep last hour
    
    // Check limits
    const lastMinute = this.requests.filter(time => now - time < 60 * 1000).length;
    const lastHour = this.requests.length;
    
    if (lastMinute >= this.config.maxRequestsPerMinute) {
      const waitTime = 60 * 1000 - (now - this.requests[this.requests.length - this.config.maxRequestsPerMinute]);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    if (lastHour >= this.config.maxRequestsPerHour) {
      const waitTime = 60 * 60 * 1000 - (now - this.requests[0]);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.requests.push(now);
  }
}

export class PerplexityResearchService {
  private apiKey: string;
  private baseUrl: string = 'https://api.perplexity.ai';
  private rateLimiter: RateLimiter;
  private cacheService = getCacheService();
  private costGuard = getCostGuard();
  private modelSelector = getModelSelector();
  private defaultConfig: ResearchSessionConfig = {
    model: 'sonar-deep-research',
    temperature: 0.2,
    max_tokens: 4000,
    search_recency_filter: 'month',
    return_citations: true,
    return_images: false,
    return_related_questions: true,
    enableCaching: true,
    prioritizeCost: false,
  };

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.PERPLEXITY_API_KEY || '';
    
    if (!this.apiKey) {
      throw new Error('Perplexity API key is required. Set PERPLEXITY_API_KEY environment variable.');
    }

    // Configure rate limiting based on Perplexity API limits
    this.rateLimiter = new RateLimiter({
      maxRequestsPerMinute: 20,
      maxRequestsPerHour: 200,
      maxRequestsPerDay: 1000,
    });
  }

  private async makeRequest(
    request: PerplexityRequest,
    retries: number = 3,
    backoffMs: number = 1000
  ): Promise<PerplexityResponse> {
    await this.rateLimiter.waitForAvailability();

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const apiUrl = `${this.baseUrl}/chat/completions`;
        const startTime = Date.now();
        
        const response = await safeFetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(request),
        }, getSSRFConfig('perplexity'));

        const duration = Date.now() - startTime;
        logExternalApiCall('perplexity', apiUrl, duration);

        if (!response.ok) {
          const errorBody = await response.text();
          
          // Don't retry authentication errors (401) or client errors (400-499)
          if (response.status === 401) {
            logError('Perplexity API authentication failed', { 
              status: response.status,
              errorBody 
            });
            throw new Error(`Authentication failed: Invalid or expired API key`);
          }
          
          if (response.status >= 400 && response.status < 500) {
            logError('Perplexity API client error', { 
              status: response.status,
              errorBody 
            });
            throw new Error(`Client error ${response.status}: ${errorBody}`);
          }
          
          // Handle rate limiting
          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : backoffMs * Math.pow(2, attempt);
            
            if (attempt < retries) {
              console.warn(`Rate limited. Waiting ${waitTime}ms before retry ${attempt + 1}/${retries}`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
          }
          
          throw new Error(`Perplexity API error: ${response.status} - ${errorBody}`);
        }

        const data = await response.json();
        return PerplexityResponseSchema.parse(data);
        
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }
        
        console.warn(`Attempt ${attempt + 1} failed, retrying in ${backoffMs}ms:`, error);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        backoffMs *= 2;
      }
    }

    throw new Error('Max retries exceeded');
  }

  private calculateCost(usage: PerplexityResponse['usage'], model: string): number {
    // Perplexity pricing (as of 2024)
    const pricing: Record<string, { input: number; output: number }> = {
      'sonar-pro': { input: 0.001, output: 0.001 },
      'sonar': { input: 0.0005, output: 0.0005 },
      'sonar-medium': { input: 0.0015, output: 0.0015 },
    };

    const modelPricing = pricing[model] || pricing['sonar-pro'];
    return (usage.prompt_tokens * modelPricing.input + usage.completion_tokens * modelPricing.output) / 1000;
  }

  async research(
    query: string,
    systemPrompt?: string,
    config?: ResearchSessionConfig
  ): Promise<ResearchResult> {
    const finalConfig = { ...this.defaultConfig, ...config };
    
    // Generate cache key for this research request
    const cacheKey = finalConfig.cacheKey || this.generateCacheKey(query, systemPrompt, finalConfig);
    
    // Check if we should use caching
    if (finalConfig.enableCaching) {
      const cachedResult = await this.cacheService.getCachedOrGenerate(
        cacheKey,
        () => this.performResearch(query, systemPrompt, finalConfig),
        {
          ttlSeconds: finalConfig.cacheTTL || CACHE_TTL.RESEARCH_QUERY,
          keyPrefix: 'perplexity_research',
          enableMetrics: true
        }
      );

      // Add cache metadata to result
      if (cachedResult.cached) {
        logInfo('Perplexity research served from cache', {
          cacheAge: cachedResult.age,
          queryHash: cacheKey.substring(0, 16),
          userId: finalConfig.userId
        });
        
        return {
          ...cachedResult.data,
          cost_usd: 0 // No API cost for cached results
        };
      }
      
      return cachedResult.data;
    }

    // No caching - perform research directly
    return this.performResearch(query, systemPrompt, finalConfig);
  }

  private async performResearch(
    query: string,
    systemPrompt?: string,
    config?: ResearchSessionConfig
  ): Promise<ResearchResult> {
    const finalConfig = { ...this.defaultConfig, ...config };
    
    // Select optimal model for this task
    let selectedModel = finalConfig.model || 'sonar-deep-research';
    if (finalConfig.prioritizeCost) {
      const modelSelection = this.modelSelector.selectModel({
        taskType: 'research_deep',
        prioritizeCost: true,
        qualityLevel: 'standard'
      });
      
      if (modelSelection.provider === 'perplexity') {
        selectedModel = modelSelection.model;
        logDebug('Model selected for cost optimization', {
          original: finalConfig.model,
          selected: selectedModel,
          reasoning: modelSelection.reasoning
        });
      }
    }

    const messages: PerplexityMessage[] = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    
    messages.push({ role: 'user', content: query });

    // Estimate cost before making the request
    const estimatedTokens = this.estimateTokens(query, systemPrompt, finalConfig);
    const costEstimate = this.costGuard.estimateCost(
      selectedModel,
      estimatedTokens,
      finalConfig.max_tokens || 2000,
      'perplexity'
    );

    // Check cost limits
    const costCheck = await this.costGuard.checkCostLimit(
      costEstimate.estimatedCostUSD,
      finalConfig.userId
    );

    if (!costCheck.allowed) {
      logError('Perplexity research blocked by cost guard', {
        reason: costCheck.reason,
        estimatedCost: costEstimate.estimatedCostUSD,
        currentDailyCost: costCheck.currentDailyCost,
        userId: finalConfig.userId
      });
      
      throw new Error(`API cost limit exceeded: ${costCheck.reason}`);
    }

    // Log cost check results
    logDebug('Perplexity cost check passed', {
      estimatedCost: costEstimate.estimatedCostUSD,
      remainingBudget: costCheck.remainingBudget,
      userId: finalConfig.userId,
      model: selectedModel
    });

    const request: PerplexityRequest = {
      model: selectedModel,
      messages,
      temperature: finalConfig.temperature,
      max_tokens: finalConfig.max_tokens,
      search_recency_filter: finalConfig.search_recency_filter,
      return_citations: finalConfig.return_citations,
      return_images: finalConfig.return_images,
      return_related_questions: finalConfig.return_related_questions,
      search_domain_filter: finalConfig.search_domain_filter,
    };

    const startTime = Date.now();
    const response = await this.makeRequest(request);
    const duration = Date.now() - startTime;
    
    // Calculate actual cost
    const actualCost = this.calculateCost(response.usage, response.model);
    
    // Record the actual cost
    await this.costGuard.recordCost(
      actualCost,
      'perplexity',
      response.model,
      finalConfig.userId
    );
    
    // Log the successful API call with cost details
    logExternalApiCall(
      'perplexity', 
      `${this.baseUrl}/chat/completions`,
      duration,
      actualCost
    );
    
    // Log citation count for debugging
    if (response.citations && response.citations.length > 0) {
      logDebug(`Perplexity found ${response.citations.length} citations`, {
        model: response.model,
        tokens: response.usage.total_tokens,
        cost: actualCost,
        userId: finalConfig.userId
      });
    }
    
    const result: ResearchResult = {
      content: response.choices[0]?.message.content || '',
      citations: response.citations,
      images: response.images,
      related_questions: response.related_questions,
      usage: response.usage,
      cost_usd: actualCost,
    };

    return result;
  }

  private generateCacheKey(
    query: string, 
    systemPrompt?: string, 
    config?: ResearchSessionConfig
  ): string {
    const keyComponents = [
      query,
      systemPrompt || '',
      config?.model || '',
      config?.search_recency_filter || '',
      JSON.stringify(config?.search_domain_filter || []),
      config?.temperature || 0.2,
      config?.max_tokens || 4000
    ];
    
    return keyComponents.join('|');
  }

  private estimateTokens(
    query: string,
    systemPrompt?: string,
    config?: ResearchSessionConfig
  ): number {
    // Rough estimation: ~4 characters per token
    const queryTokens = Math.ceil(query.length / 4);
    const systemTokens = systemPrompt ? Math.ceil(systemPrompt.length / 4) : 0;
    const overhead = 50; // Additional tokens for formatting, etc.
    
    return queryTokens + systemTokens + overhead;
  }

  async deepResearch(
    companyName: string,
    focusAreas: string[] = [],
    config?: ResearchSessionConfig
  ): Promise<ResearchResult> {
    const systemPrompt = `You are an expert business intelligence researcher. Your task is to conduct deep research on companies to identify actionable intelligence for business development and partnership opportunities.

Focus on:
1. Current technical challenges and pain points
2. Recent product launches, updates, and roadmap insights
3. Team dynamics and key decision makers
4. Growth stage pressures and immediate business needs
5. Competitive positioning and market opportunities
6. Specific problems that could be solved through external partnerships or solutions

Provide detailed, actionable insights with specific examples and evidence.`;

    const focusContext = focusAreas.length > 0 
      ? `\n\nPay special attention to these focus areas: ${focusAreas.join(', ')}`
      : '';

    const query = `Conduct comprehensive research on ${companyName}. Analyze their current technical challenges, recent activities, team structure, growth stage, and competitive position. Identify specific problems they're facing that could be addressed through external partnerships or solutions.${focusContext}`;

    return this.research(query, systemPrompt, {
      ...config,
      search_recency_filter: 'week',
      return_citations: true,
      return_related_questions: true,
      enableCaching: true,
      cacheTTL: CACHE_TTL.RESEARCH_QUERY,
      cacheKey: `deep_research:${companyName}:${focusAreas.join(',')}`,
    });
  }

  async technicalAnalysis(
    companyName: string,
    repositoryUrls: string[] = [],
    config?: ResearchSessionConfig
  ): Promise<ResearchResult> {
    const systemPrompt = `You are a senior technical analyst specializing in software architecture and engineering challenges. Research the technical aspects of companies to identify:

1. Technology stack and architecture decisions
2. Open technical challenges (from GitHub issues, blog posts, job postings)
3. Performance bottlenecks and scaling issues
4. Security vulnerabilities or concerns
5. Development workflow and operational challenges
6. Integration needs and API requirements

Focus on actionable technical insights that could lead to partnership or solution opportunities.`;

    const repoContext = repositoryUrls.length > 0 
      ? `\n\nPay special attention to these repositories: ${repositoryUrls.join(', ')}`
      : '';

    const query = `Analyze the technical landscape of ${companyName}. Research their technology stack, current technical challenges, GitHub activity, performance issues, and development needs. Identify specific technical problems that could be solved through external expertise or tools.${repoContext}`;

    return this.research(query, systemPrompt, {
      ...config,
      search_recency_filter: 'week',
      search_domain_filter: ['github.com', 'stackoverflow.com', 'techcrunch.com', 'hackernews.com'],
      enableCaching: true,
      cacheTTL: CACHE_TTL.ANALYSIS,
      cacheKey: `technical_analysis:${companyName}:${repositoryUrls.join(',')}`,
    });
  }

  async competitiveAnalysis(
    companyName: string,
    competitors: string[] = [],
    config?: ResearchSessionConfig
  ): Promise<ResearchResult> {
    const systemPrompt = `You are a competitive intelligence analyst. Research companies within their competitive landscape to identify:

1. Market positioning and differentiation strategies
2. Competitive advantages and weaknesses
3. Recent competitive moves and responses
4. Market gaps and opportunities
5. Customer acquisition and retention strategies
6. Partnership and integration opportunities

Focus on actionable competitive insights that reveal market positioning and opportunities.`;

    const competitorContext = competitors.length > 0 
      ? `\n\nKey competitors to analyze: ${competitors.join(', ')}`
      : '';

    const query = `Analyze ${companyName} within their competitive landscape. Research their market position, competitive advantages, recent strategic moves, and market opportunities. Identify areas where they might need external support or partnerships to compete effectively.${competitorContext}`;

    return this.research(query, systemPrompt, {
      ...config,
      search_recency_filter: 'month',
      return_citations: true,
      enableCaching: true,
      cacheTTL: CACHE_TTL.ANALYSIS,
      cacheKey: `competitive_analysis:${companyName}:${competitors.join(',')}`,
    });
  }

  async marketAnalysis(
    companyName: string,
    industry: string,
    config?: ResearchSessionConfig
  ): Promise<ResearchResult> {
    const systemPrompt = `You are a market research analyst specializing in technology companies. Research companies within their market context to identify:

1. Industry trends and market dynamics
2. Regulatory changes and compliance requirements
3. Customer behavior and demand patterns
4. Market expansion opportunities
5. Partnership and collaboration trends
6. Investment and funding patterns

Focus on market-driven insights that reveal business opportunities and challenges.`;

    const query = `Analyze ${companyName} within the ${industry} market. Research industry trends, market dynamics, regulatory environment, customer needs, and expansion opportunities. Identify market-driven challenges that could be addressed through external partnerships or solutions.`;

    return this.research(query, systemPrompt, {
      ...config,
      search_recency_filter: 'month',
      return_citations: true,
      enableCaching: true,
      cacheTTL: CACHE_TTL.ANALYSIS,
      cacheKey: `market_analysis:${companyName}:${industry}`,
    });
  }

  // Health check method
  async healthCheck(): Promise<{ status: 'ok' | 'error'; message: string }> {
    try {
      await this.research(
        'What is the current date?',
        'You are a helpful assistant. Answer briefly.',
        { max_tokens: 100 }
      );
      
      return {
        status: 'ok',
        message: 'Perplexity API is accessible and responding normally'
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Perplexity API health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

export default PerplexityResearchService;