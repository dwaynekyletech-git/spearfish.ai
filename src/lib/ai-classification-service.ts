/**
 * AI Classification Service using Vercel AI SDK
 * 
 * Comprehensive AI-powered system to classify Y Combinator companies
 * as AI-related or not, with confidence scoring and detailed analysis.
 */

import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { YCCompany, ValidatedCompany } from './company-data-service';
import { getCacheService, CACHE_TTL } from './cache-service';
import { getCostGuard } from './api-cost-guard';
import { getModelSelector } from './model-selector';
import { logInfo, logDebug, logError } from './logger';

// =============================================================================
// Zod Schema for Structured Output
// =============================================================================

const ClassificationSchema = z.object({
  is_ai_related: z.boolean().describe('Whether the company is genuinely AI-related'),
  confidence: z.number().min(0).max(1).describe('Confidence score from 0.0 to 1.0'),
  reasoning: z.string().describe('Brief explanation of the classification decision'),
  ai_domains: z.array(z.string()).describe('Relevant AI domains (e.g., "computer vision", "nlp")'),
  keywords: z.array(z.string()).describe('Key AI-related terms found in the description'),
  raw_score: z.number().min(0).max(100).describe('Raw scoring from 0 to 100')
});

// =============================================================================
// Type Definitions
// =============================================================================

export interface AIClassificationResult {
  isAIRelated: boolean;
  confidence: number; // 0.0 to 1.0
  reasoning: string;
  aiDomains: string[];
  keywords: string[];
  rawScore: number;
  processingTime: number;
}

export interface BatchClassificationResult {
  companyId: number | string;
  companyName: string;
  result: AIClassificationResult;
  error?: string;
}

export interface ClassificationOptions {
  includeReasoning?: boolean;
  strictMode?: boolean;
  customPrompt?: string;
  timeout?: number;
}

export interface ClassificationStats {
  totalProcessed: number;
  aiRelated: number;
  notAIRelated: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  averageConfidence: number;
  averageProcessingTime: number;
  errors: number;
}

// =============================================================================
// AI Classification Service Class
// =============================================================================

export class AIClassificationService {
  private readonly defaultModel = 'gpt-4o-mini'; // Cost-effective for classification
  private readonly timeout: number;
  private readonly cacheService = getCacheService();
  private readonly costGuard = getCostGuard();
  private readonly modelSelector = getModelSelector();

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OpenAI API key not found in environment variables');
    }

    this.timeout = 30000; // 30 seconds default timeout
  }

  // =============================================================================
  // Core Classification Methods
  // =============================================================================

  /**
   * Classify a single company using AI with caching and cost controls
   */
  async classifyCompany(
    company: YCCompany | ValidatedCompany,
    options: ClassificationOptions = {}
  ): Promise<AIClassificationResult> {
    const startTime = Date.now();

    try {
      // Generate cache key based on company data
      const cacheKey = this.generateCacheKey(company, options);
      
      // Try to get cached result first
      const cachedResult = await this.cacheService.getCachedOrGenerate(
        cacheKey,
        () => this.performClassification(company, options, startTime),
        {
          ttlSeconds: CACHE_TTL.CLASSIFICATION,
          keyPrefix: 'ai_classification',
          enableMetrics: true
        }
      );

      if (cachedResult.cached) {
        logDebug('AI classification served from cache', {
          companyName: company.name,
          cacheAge: cachedResult.age,
          companyId: company.id
        });
        
        return {
          ...cachedResult.data,
          processingTime: Date.now() - startTime
        };
      }

      return cachedResult.data;

    } catch (error) {
      logError('Error in AI classification', { 
        error: error instanceof Error ? error.message : error,
        companyName: company.name,
        companyId: company.id
      });
      
      // Fallback to rule-based classification
      return this.fallbackClassification(company, Date.now() - startTime);
    }
  }

  private async performClassification(
    company: YCCompany | ValidatedCompany,
    options: ClassificationOptions,
    startTime: number
  ): Promise<AIClassificationResult> {
    // Select optimal model for classification task
    const modelSelection = this.modelSelector.selectModel({
      taskType: 'classification',
      qualityLevel: 'standard',
      prioritizeCost: true
    });

    const selectedModel = modelSelection.provider === 'openai' ? modelSelection.model : this.defaultModel;
    
    // Estimate cost before making the request
    const prompt = this.buildClassificationPrompt(company, options);
    const estimatedTokens = this.estimateTokens(prompt);
    const costEstimate = this.costGuard.estimateCost(
      selectedModel,
      estimatedTokens,
      200, // Classification typically has short outputs
      'openai'
    );

    // Check cost limits (no userId available in this context, so check global only)
    const costCheck = await this.costGuard.checkCostLimit(costEstimate.estimatedCostUSD);

    if (!costCheck.allowed) {
      logError('AI classification blocked by cost guard', {
        reason: costCheck.reason,
        estimatedCost: costEstimate.estimatedCostUSD,
        companyName: company.name
      });
      
      // Fall back to rule-based classification when cost limits hit
      return this.fallbackClassification(company, Date.now() - startTime);
    }

    logDebug('AI classification cost check passed', {
      estimatedCost: costEstimate.estimatedCostUSD,
      remainingBudget: costCheck.remainingBudget,
      model: selectedModel,
      companyName: company.name
    });

    const { object } = await generateObject({
      model: openai(selectedModel),
      schema: ClassificationSchema,
      system: this.getSystemPrompt(),
      prompt: prompt,
      temperature: 0.1, // Low temperature for consistent classification
    });

    // Record the actual cost (estimate for now, as we don't have actual token usage from AI SDK)
    await this.costGuard.recordCost(
      costEstimate.estimatedCostUSD,
      'openai',
      selectedModel
    );

    const processingTime = Date.now() - startTime;
    
    logInfo('AI classification completed', {
      companyName: company.name,
      isAIRelated: object.is_ai_related,
      confidence: object.confidence,
      cost: costEstimate.estimatedCostUSD,
      processingTime,
      model: selectedModel
    });

    return this.validateAndProcessResult(object, processingTime);
  }

  private generateCacheKey(company: YCCompany | ValidatedCompany, options: ClassificationOptions): string {
    // Create cache key from company data that affects classification
    const keyComponents = [
      company.name,
      company.one_liner || '',
      (company as any).description || '',
      company.long_description || '',
      JSON.stringify(options)
    ];
    
    return keyComponents.join('|');
  }

  private estimateTokens(prompt: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(prompt.length / 4) + 100; // Add overhead for system prompt
  }

  /**
   * Classify multiple companies in batch
   */
  async classifyCompaniesBatch(
    companies: (YCCompany | ValidatedCompany)[],
    options: ClassificationOptions = {}
  ): Promise<BatchClassificationResult[]> {
    const results: BatchClassificationResult[] = [];
    const batchSize = 5; // Process in small batches to avoid rate limits
    
    console.log(`Starting batch classification of ${companies.length} companies...`);

    for (let i = 0; i < companies.length; i += batchSize) {
      const batch = companies.slice(i, i + batchSize);
      
      // Process batch concurrently with delay
      const batchPromises = batch.map(async (company, index) => {
        // Add delay to respect rate limits
        await this.delay(index * 200); // 200ms delay between requests
        
        try {
          const result = await this.classifyCompany(company, options);
          return {
            companyId: company.id,
            companyName: company.name,
            result
          };
        } catch (error) {
          return {
            companyId: company.id,
            companyName: company.name,
            result: this.fallbackClassification(company, 0),
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(companies.length / batchSize)}`);
      
      // Delay between batches
      if (i + batchSize < companies.length) {
        await this.delay(1000); // 1 second between batches
      }
    }

    console.log(`Batch classification complete. Processed ${results.length} companies.`);
    return results;
  }

  // =============================================================================
  // Prompt Engineering
  // =============================================================================

  private getSystemPrompt(): string {
    return `You are an expert AI/ML industry analyst specializing in identifying AI-related companies. 

Your task is to analyze Y Combinator company descriptions and determine if they are genuinely AI-related.

CLASSIFICATION CRITERIA:
1. CORE AI/ML COMPANIES (High Confidence):
   - Companies building ML/AI models, algorithms, or platforms
   - Computer vision, NLP, speech recognition, recommendation systems
   - AI infrastructure, MLOps, model deployment platforms
   - Autonomous systems, robotics with AI components
   - Generative AI, LLMs, AI assistants

2. AI-ENHANCED COMPANIES (Medium Confidence):  
   - Traditional products enhanced with AI features
   - Data analytics platforms using ML
   - Business intelligence with AI insights
   - Process automation using AI

3. NOT AI-RELATED (Low/No Confidence):
   - Traditional software without AI components
   - E-commerce, fintech, healthcare without AI focus
   - Pure hardware or physical products
   - Simple apps, websites, or services
   - Companies that only mention "smart" or "data-driven"

IMPORTANT GUIDELINES:
- Be strict: Don't classify as AI-related unless there's clear evidence of AI/ML technology
- Buzzwords alone don't make a company AI-related
- Consider the core business model, not just marketing language
- High confidence only for companies where AI is central to their value proposition

Respond ONLY with valid JSON in this exact format:
{
  "is_ai_related": boolean,
  "confidence": number (0.0 to 1.0),
  "reasoning": "brief explanation",
  "ai_domains": ["array", "of", "relevant", "AI", "domains"],
  "keywords": ["key", "ai", "terms", "found"],
  "raw_score": number (0 to 100)
}`;
  }

  private buildClassificationPrompt(
    company: YCCompany | ValidatedCompany, 
    options: ClassificationOptions
  ): string {
    const includeReasoning = options.includeReasoning !== false;
    
    let prompt = `Analyze this Y Combinator company for AI relevance:\n\n`;
    
    prompt += `COMPANY: ${company.name}\n`;
    if (company.batch) prompt += `BATCH: ${company.batch}\n`;
    if (company.industry) prompt += `INDUSTRY: ${company.industry}\n`;
    
    if (company.one_liner) {
      prompt += `\nONE-LINER: ${company.one_liner}\n`;
    }
    
    if (company.long_description) {
      prompt += `\nDESCRIPTION: ${company.long_description}\n`;
    }
    
    if (company.tags && company.tags.length > 0) {
      prompt += `\nTAGS: ${company.tags.join(', ')}\n`;
    }

    if ('subindustry' in company && company.subindustry) {
      prompt += `\nSUBINDUSTRY: ${company.subindustry}\n`;
    }

    prompt += `\n${includeReasoning ? 'Provide detailed analysis' : 'Classify quickly'} based on the criteria above.`;
    
    if (options.strictMode) {
      prompt += ` Use STRICT mode - only classify as AI-related if AI/ML is core to the business model.`;
    }

    return prompt;
  }

  // =============================================================================
  // Result Processing and Validation
  // =============================================================================

  private validateAndProcessResult(
    parsed: any, 
    processingTime: number
  ): AIClassificationResult {
    // Validate required fields
    const isAIRelated = Boolean(parsed.is_ai_related);
    let confidence = Number(parsed.confidence) || 0;
    const reasoning = String(parsed.reasoning || 'No reasoning provided');
    const aiDomains = Array.isArray(parsed.ai_domains) ? parsed.ai_domains : [];
    const keywords = Array.isArray(parsed.keywords) ? parsed.keywords : [];
    let rawScore = Number(parsed.raw_score) || 0;

    // Normalize confidence to 0-1 range
    if (confidence > 1) confidence = confidence / 100;
    confidence = Math.max(0, Math.min(1, confidence));

    // Normalize raw score to 0-100 range
    rawScore = Math.max(0, Math.min(100, rawScore));

    // Apply confidence adjustments based on content quality
    confidence = this.adjustConfidenceScore(confidence, aiDomains, keywords, reasoning);

    return {
      isAIRelated,
      confidence,
      reasoning,
      aiDomains,
      keywords,
      rawScore,
      processingTime
    };
  }

  private adjustConfidenceScore(
    baseConfidence: number,
    aiDomains: string[],
    keywords: string[],
    reasoning: string
  ): number {
    let adjustedConfidence = baseConfidence;

    // Boost confidence if multiple AI domains identified
    if (aiDomains.length > 2) {
      adjustedConfidence += 0.1;
    }

    // Boost confidence if specific AI keywords found
    const strongAIKeywords = ['machine learning', 'neural network', 'deep learning', 'computer vision', 'nlp', 'llm'];
    const strongKeywordCount = keywords.filter(keyword => 
      strongAIKeywords.some(strong => keyword.toLowerCase().includes(strong))
    ).length;
    
    if (strongKeywordCount > 0) {
      adjustedConfidence += strongKeywordCount * 0.05;
    }

    // Reduce confidence if reasoning is too short or generic
    if (reasoning.length < 20) {
      adjustedConfidence -= 0.1;
    }

    // Ensure confidence stays in valid range
    return Math.max(0, Math.min(1, adjustedConfidence));
  }

  private fallbackClassification(
    company: YCCompany | ValidatedCompany, 
    processingTime: number
  ): AIClassificationResult {
    // Simple rule-based fallback
    const text = `${company.name} ${company.one_liner || ''} ${company.long_description || ''}`.toLowerCase();
    
    const aiKeywords = [
      'artificial intelligence', 'machine learning', 'ai', 'ml', 'neural', 'deep learning',
      'computer vision', 'nlp', 'natural language', 'chatbot', 'recommendation',
      'predictive', 'algorithm', 'automation', 'llm', 'generative'
    ];

    const foundKeywords = aiKeywords.filter(keyword => text.includes(keyword));
    const isAIRelated = foundKeywords.length > 0;
    const confidence = isAIRelated ? Math.min(0.7, foundKeywords.length * 0.2) : 0.1;

    return {
      isAIRelated,
      confidence,
      reasoning: `Fallback classification based on keyword analysis. Found: ${foundKeywords.join(', ')}`,
      aiDomains: foundKeywords.length > 0 ? ['keyword-based'] : [],
      keywords: foundKeywords,
      rawScore: confidence * 100,
      processingTime
    };
  }

  // =============================================================================
  // Analytics and Statistics
  // =============================================================================

  /**
   * Calculate statistics from batch classification results
   */
  calculateClassificationStats(results: BatchClassificationResult[]): ClassificationStats {
    const validResults = results.filter(r => !r.error);
    const totalProcessed = validResults.length;
    
    if (totalProcessed === 0) {
      return {
        totalProcessed: 0,
        aiRelated: 0,
        notAIRelated: 0,
        highConfidence: 0,
        mediumConfidence: 0,
        lowConfidence: 0,
        averageConfidence: 0,
        averageProcessingTime: 0,
        errors: results.length - totalProcessed
      };
    }

    const aiRelated = validResults.filter(r => r.result.isAIRelated).length;
    const notAIRelated = totalProcessed - aiRelated;
    
    const highConfidence = validResults.filter(r => r.result.confidence >= 0.8).length;
    const mediumConfidence = validResults.filter(r => r.result.confidence >= 0.5 && r.result.confidence < 0.8).length;
    const lowConfidence = validResults.filter(r => r.result.confidence < 0.5).length;
    
    const averageConfidence = validResults.reduce((sum, r) => sum + r.result.confidence, 0) / totalProcessed;
    const averageProcessingTime = validResults.reduce((sum, r) => sum + r.result.processingTime, 0) / totalProcessed;

    return {
      totalProcessed,
      aiRelated,
      notAIRelated,
      highConfidence,
      mediumConfidence,
      lowConfidence,
      averageConfidence: Math.round(averageConfidence * 100) / 100,
      averageProcessingTime: Math.round(averageProcessingTime),
      errors: results.length - totalProcessed
    };
  }

  // =============================================================================
  // Utility Methods
  // =============================================================================

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Test the OpenAI connection via AI SDK
   */
  async testConnection(): Promise<boolean> {
    try {
      const testSchema = z.object({
        status: z.string().describe('Response status')
      });

      const { object } = await generateObject({
        model: openai(this.defaultModel),
        schema: testSchema,
        prompt: 'Test connection. Respond with status "OK".',
      });
      
      return (object as any).status === 'OK';
    } catch (error) {
      console.error('AI SDK connection test failed:', error);
      return false;
    }
  }

  /**
   * Get model information
   */
  getModelInfo(): { model: string; provider: string } {
    return {
      model: this.defaultModel,
      provider: 'openai'
    };
  }
}

// =============================================================================
// Convenience Functions and Exports
// =============================================================================

/**
 * Create a new AI classification service instance
 */
export function createAIClassificationService(): AIClassificationService {
  return new AIClassificationService();
}

/**
 * Quick function to classify a single company
 */
export async function classifyCompanyAI(company: YCCompany | ValidatedCompany): Promise<AIClassificationResult> {
  const service = createAIClassificationService();
  return service.classifyCompany(company);
}

/**
 * Quick function to classify multiple companies
 */
export async function classifyCompaniesBatchAI(
  companies: (YCCompany | ValidatedCompany)[]
): Promise<BatchClassificationResult[]> {
  const service = createAIClassificationService();
  return service.classifyCompaniesBatch(companies);
}

// Export default instance
export const aiClassificationService = createAIClassificationService();