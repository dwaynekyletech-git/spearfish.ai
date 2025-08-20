/**
 * AI Company Detection Service
 * 
 * Enhanced AI company detection with confidence scoring and multiple signal analysis.
 * Used to identify which companies should be enriched with Apify data.
 * 
 * Features:
 * - Multi-signal analysis (industry, tags, keywords, descriptions)
 * - Confidence scoring (0-1) for prioritization
 * - Tiered classification for cost optimization
 * - False positive reduction through signal weighting
 */

import { CompanyData } from './spearfish-scoring-service';
import { logDebug, logInfo } from './logger';

// =============================================================================
// Type Definitions
// =============================================================================

export interface AIDetectionSignals {
  hasAIIndustry: boolean;
  hasAITags: boolean;
  hasAIKeywords: boolean;
  hasAIInDescription: boolean;
  hasGenerativeAISignals: boolean;
  hasMLInfrastructureSignals: boolean;
  hasAdvancedAISignals: boolean;
}

export interface AIDetectionResult {
  isAI: boolean;
  confidence: number; // 0-1 scale
  tier: 'TIER_1' | 'TIER_2' | 'TIER_3' | 'NOT_AI';
  signals: AIDetectionSignals;
  reasoning: string[];
  priority: number; // 1-10 for enrichment prioritization
}

export interface AICompanyTiers {
  TIER_1: { // Foundation models, LLMs, Core AI
    confidence: number;
    priority: number;
    description: string;
  };
  TIER_2: { // AI Infrastructure, Platforms, Tools
    confidence: number;
    priority: number;
    description: string;
  };
  TIER_3: { // AI-enabled, Uses ML, Automation
    confidence: number;
    priority: number;
    description: string;
  };
}

// =============================================================================
// AI Detection Configuration
// =============================================================================

const AI_TIER_CONFIG: AICompanyTiers = {
  TIER_1: {
    confidence: 0.9,
    priority: 10,
    description: 'Foundation models, LLMs, Core AI research'
  },
  TIER_2: {
    confidence: 0.7,
    priority: 7,
    description: 'AI Infrastructure, ML Platforms, Developer Tools'
  },
  TIER_3: {
    confidence: 0.5,
    priority: 4,
    description: 'AI-enabled products, Automation, Analytics'
  }
};

// Enhanced keyword sets with weights
const AI_KEYWORDS = {
  // Tier 1: Core AI/ML (highest confidence)
  FOUNDATION_MODELS: {
    keywords: [
      'foundation model', 'large language model', 'llm', 'gpt', 'transformer',
      'generative ai', 'chatgpt', 'anthropic', 'openai', 'neural network',
      'deep learning', 'artificial general intelligence', 'agi'
    ],
    weight: 1.0,
    tier: 'TIER_1'
  },
  
  // Tier 2: AI Infrastructure & Tools (high confidence)
  AI_INFRASTRUCTURE: {
    keywords: [
      'machine learning platform', 'ml platform', 'ai infrastructure',
      'model deployment', 'mlops', 'ai development', 'neural architecture',
      'computer vision', 'natural language processing', 'nlp', 'cv',
      'reinforcement learning', 'supervised learning', 'unsupervised learning'
    ],
    weight: 0.8,
    tier: 'TIER_2'
  },
  
  // GUARANTEED AI: Explicit AI mentions (automatic qualification)
  GUARANTEED_AI: {
    keywords: [
      'artificial intelligence', ' ai ', ' ai.', ' ai,', ' ai!', ' ai?', 'ai-powered', 'ai powered',
      'machine learning', ' ml ', ' ml.', ' ml,', 'deep learning', 'neural network',
      'computer vision', 'natural language processing', 'ai-driven', 'ai driven',
      'ai-enabled', 'ai enabled', 'powered by ai', 'using ai', 'with ai', 'leveraging ai',
      'ai platform', 'ai solution', 'ai technology', 'ai system', 'ai model',
      'ai assistant', 'ai agent', 'ai voice', 'ai chatbot', 'ai automation',
      'generative ai', 'large language model', 'llm', 'foundation model'
    ],
    weight: 1.0,
    tier: 'TIER_1',
    guaranteed: true
  },
  
  // Tier 2: Direct AI Applications (high confidence)
  AI_APPLICATIONS: {
    keywords: [
      'recommendation engine', 'recommendation system', 'personalization engine',
      'fraud detection', 'anomaly detection', 'pattern recognition', 'predictive analytics',
      'sentiment analysis', 'image recognition', 'speech recognition', 'voice recognition',
      'text analysis', 'data mining', 'predictive modeling', 'automated insights',
      'intelligent automation', 'smart automation', 'cognitive computing'
    ],
    weight: 0.8,
    tier: 'TIER_2'
  },
  
  // Tier 3: AI-enabled (medium confidence)
  AI_ENABLED: {
    keywords: [
      'artificial intelligence', 'machine learning', 'intelligent automation', 
      'predictive analytics', 'smart automation', 'automated', 'algorithm', 
      'data science', 'analytics platform', 'workflow automation', 'intelligent workflow'
    ],
    weight: 0.6,
    tier: 'TIER_3'
  },
  
  // Context keywords (lower weight but important for context)
  CONTEXT: {
    keywords: [
      'recommendation engine', 'personalization', 'optimization',
      'fraud detection', 'anomaly detection', 'pattern recognition',
      'speech recognition', 'image recognition', 'text analysis'
    ],
    weight: 0.4,
    tier: 'TIER_3'
  }
};

const AI_INDUSTRIES = {
  CORE_AI: [
    'Artificial Intelligence',
    'Machine Learning',
    'Generative AI',
    'Computer Vision',
    'Natural Language Processing',
    'Deep Learning'
  ],
  AI_ADJACENT: [
    'Data Science',
    'Analytics',
    'Developer Tools',
    'Robotics',
    'Automation',
    'SaaS'
  ]
};

const AI_TAGS = {
  HIGH_CONFIDENCE: [
    'AI', 'Machine Learning', 'ML', 'Artificial Intelligence',
    'Deep Learning', 'Neural Networks', 'Computer Vision', 'NLP',
    'LLM', 'Generative AI', 'Foundation Model', 'AI Assistant',
    'Natural Language Processing', 'Speech Recognition', 'Image Recognition'
  ],
  MEDIUM_CONFIDENCE: [
    'Analytics', 'Data Science', 'Automation', 'Intelligent',
    'Predictive', 'Smart', 'Algorithm', 'Big Data', 'Robotics',
    'Optimization', 'Classification', 'Recommendation'
  ],
  GUARANTEED_AI: [
    'Artificial Intelligence', 'AI', 'Machine Learning', 'ML',
    'Deep Learning', 'Neural Networks', 'AI Assistant', 'Generative AI'
  ]
};

// =============================================================================
// AI Company Detector
// =============================================================================

export class AICompanyDetector {
  /**
   * Detect if a company is AI-related with confidence scoring
   */
  static detectAICompany(company: CompanyData): AIDetectionResult {
    // Check for guaranteed AI first - these should always be classified as AI
    const guaranteedAI = this.hasGuaranteedAI(company);
    
    const signals = this.analyzeSignals(company);
    let confidence = this.calculateConfidence(signals, company);
    
    // If guaranteed AI, ensure minimum confidence
    if (guaranteedAI && confidence < 0.8) {
      confidence = Math.max(0.8, confidence);
    }
    
    const tier = this.determineTier(confidence, signals);
    const priority = this.calculatePriority(tier, confidence, company);
    const reasoning = this.generateReasoning(signals, company, guaranteedAI);
    const isAI = guaranteedAI || confidence >= 0.30; // Lower threshold since we improved keyword detection

    logDebug('AI detection completed', {
      company: company.name,
      confidence,
      tier,
      isAI,
      signals
    });

    return {
      isAI,
      confidence,
      tier,
      signals,
      reasoning,
      priority
    };
  }

  /**
   * Analyze all signals for AI detection
   */
  private static analyzeSignals(company: CompanyData): AIDetectionSignals {
    const text = `${company.one_liner || ''} ${company.long_description || ''}`.toLowerCase();
    const industry = (company.industry || '').toLowerCase();
    const tags = company.tags.map(tag => tag.toLowerCase());

    return {
      hasAIIndustry: this.checkAIIndustry(industry),
      hasAITags: this.checkAITags(tags),
      hasAIKeywords: this.checkAIKeywords(text),
      hasAIInDescription: this.checkDescriptionSignals(text),
      hasGenerativeAISignals: this.checkGenerativeAISignals(text),
      hasMLInfrastructureSignals: this.checkMLInfrastructureSignals(text),
      hasAdvancedAISignals: this.checkAdvancedAISignals(text, tags)
    };
  }

  /**
   * Calculate confidence score based on signals
   */
  private static calculateConfidence(signals: AIDetectionSignals, company: CompanyData): number {
    let confidence = 0;
    const text = `${company.one_liner || ''} ${company.long_description || ''}`.toLowerCase();

    // Industry signals (high weight)
    if (signals.hasAIIndustry) {
      const coreAI = AI_INDUSTRIES.CORE_AI.some(ind => 
        (company.industry || '').toLowerCase().includes(ind.toLowerCase())
      );
      confidence += coreAI ? 0.4 : 0.2;
    }

    // Tag signals (medium-high weight)
    if (signals.hasAITags) {
      const highConfidenceTags = AI_TAGS.HIGH_CONFIDENCE.some(tag =>
        company.tags.some(companyTag => 
          companyTag.toLowerCase().includes(tag.toLowerCase())
        )
      );
      confidence += highConfidenceTags ? 0.3 : 0.15;
    }

    // Keyword analysis with weighted scoring
    const keywordScore = this.analyzeKeywordWeights(text);
    confidence += keywordScore * 0.3;

    // Explicit AI marketing claims (strong signal)
    if (this.hasExplicitAIClaims(text)) {
      confidence += 0.4; // Very strong bonus for explicit AI claims
    }

    // Advanced AI signals (bonus points)
    if (signals.hasGenerativeAISignals) confidence += 0.2;
    if (signals.hasMLInfrastructureSignals) confidence += 0.15;
    if (signals.hasAdvancedAISignals) confidence += 0.1;

    // Company context bonuses
    if (company.batch && this.isRecentBatch(company.batch)) {
      confidence += 0.05; // Recent batches more likely to be AI
    }

    if (company.team_size && company.team_size > 20) {
      confidence += 0.05; // Larger teams more likely to be serious AI
    }

    // Cap at 1.0 and apply smoothing
    return Math.min(1.0, Math.max(0, confidence));
  }

  /**
   * Analyze keyword weights in text
   */
  private static analyzeKeywordWeights(text: string): number {
    let totalWeight = 0;
    let maxWeight = 0;

    Object.values(AI_KEYWORDS).forEach(category => {
      const matchCount = category.keywords.filter(keyword => 
        text.includes(keyword.toLowerCase())
      ).length;
      
      if (matchCount > 0) {
        const categoryWeight = Math.min(1.0, matchCount * 0.2) * category.weight;
        totalWeight += categoryWeight;
        maxWeight = Math.max(maxWeight, category.weight);
      }
    });

    // Normalize more fairly - don't divide by 2, just cap at 1.0
    return Math.min(1.0, totalWeight);
  }

  /**
   * Determine company tier based on confidence and signals
   */
  private static determineTier(confidence: number, signals: AIDetectionSignals): AIDetectionResult['tier'] {
    if (confidence < 0.3) return 'NOT_AI';
    
    // Tier 1: Foundation models and core AI
    if (confidence >= 0.8 || signals.hasGenerativeAISignals || signals.hasAdvancedAISignals) {
      return 'TIER_1';
    }
    
    // Tier 2: AI infrastructure and platforms
    if (confidence >= 0.6 || signals.hasMLInfrastructureSignals) {
      return 'TIER_2';
    }
    
    // Tier 3: AI-enabled and automation
    return 'TIER_3';
  }

  /**
   * Calculate enrichment priority (1-10)
   */
  private static calculatePriority(
    tier: AIDetectionResult['tier'], 
    confidence: number, 
    company: CompanyData
  ): number {
    if (tier === 'NOT_AI') return 0;
    
    let priority = AI_TIER_CONFIG[tier].priority;
    
    // Adjust based on confidence within tier
    const confidenceBonus = (confidence - 0.3) * 2; // 0-1.4 range
    priority = Math.min(10, priority + confidenceBonus);
    
    // Recent batch bonus
    if (this.isRecentBatch(company.batch)) {
      priority += 0.5;
    }
    
    // Team size bonus
    if (company.team_size && company.team_size > 50) {
      priority += 0.5;
    }
    
    return Math.round(Math.min(10, Math.max(1, priority)));
  }

  /**
   * Generate human-readable reasoning
   */
  private static generateReasoning(signals: AIDetectionSignals, company: CompanyData, guaranteedAI = false): string[] {
    const reasons: string[] = [];
    
    if (guaranteedAI) {
      reasons.push('🎯 GUARANTEED AI: Contains explicit AI/ML keywords in name, description, or tags');
    }
    
    if (signals.hasAIIndustry) {
      reasons.push(`Industry classified as AI-related: ${company.industry || 'Unknown'}`);
    }
    
    if (signals.hasAITags) {
      const aiTags = company.tags.filter(tag => 
        AI_TAGS.HIGH_CONFIDENCE.some(aiTag => 
          tag.toLowerCase().includes(aiTag.toLowerCase())
        )
      );
      reasons.push(`Contains AI-related tags: ${aiTags.join(', ')}`);
    }
    
    if (signals.hasGenerativeAISignals) {
      reasons.push('Shows strong generative AI signals in description');
    }
    
    if (signals.hasMLInfrastructureSignals) {
      reasons.push('Appears to be ML infrastructure or platform company');
    }
    
    if (signals.hasAdvancedAISignals) {
      reasons.push('Contains advanced AI terminology and concepts');
    }
    
    if (signals.hasAIKeywords) {
      reasons.push('Description contains multiple AI-related keywords');
    }
    
    return reasons;
  }

  // =============================================================================
  // Signal Detection Methods
  // =============================================================================

  private static checkAIIndustry(industry: string): boolean {
    return [...AI_INDUSTRIES.CORE_AI, ...AI_INDUSTRIES.AI_ADJACENT]
      .some(aiIndustry => industry.includes(aiIndustry.toLowerCase()));
  }

  private static checkAITags(tags: string[]): boolean {
    return [...AI_TAGS.HIGH_CONFIDENCE, ...AI_TAGS.MEDIUM_CONFIDENCE]
      .some(aiTag => tags.some(tag => tag.includes(aiTag.toLowerCase())));
  }

  private static checkAIKeywords(text: string): boolean {
    return Object.values(AI_KEYWORDS).some(category =>
      category.keywords.some(keyword => text.includes(keyword))
    );
  }

  private static checkDescriptionSignals(text: string): boolean {
    const aiPhrases = [
      'ai-powered', 'ai-driven', 'machine learning', 'artificial intelligence',
      'deep learning', 'neural network', 'computer vision', 'natural language'
    ];
    return aiPhrases.some(phrase => text.includes(phrase));
  }

  private static checkGenerativeAISignals(text: string): boolean {
    const genAITerms = [
      'generative ai', 'large language model', 'llm', 'gpt', 'foundation model',
      'text generation', 'image generation', 'code generation', 'chatbot',
      'conversational ai', 'transformer', 'diffusion model'
    ];
    return genAITerms.some(term => text.includes(term));
  }

  private static checkMLInfrastructureSignals(text: string): boolean {
    const infraTerms = [
      'ml platform', 'machine learning platform', 'model deployment',
      'mlops', 'ai infrastructure', 'model serving', 'feature store',
      'model monitoring', 'ml pipeline', 'training infrastructure'
    ];
    return infraTerms.some(term => text.includes(term));
  }

  private static checkAdvancedAISignals(text: string, tags: string[]): boolean {
    const advancedTerms = [
      'reinforcement learning', 'federated learning', 'transfer learning',
      'multi-modal', 'computer vision', 'nlp', 'asr', 'speech recognition',
      'autonomous', 'robotics', 'agi', 'artificial general intelligence'
    ];
    
    const hasAdvancedText = advancedTerms.some(term => text.includes(term));
    const hasAdvancedTags = tags.some(tag => 
      ['computer vision', 'nlp', 'robotics', 'autonomous'].includes(tag.toLowerCase())
    );
    
    return hasAdvancedText || hasAdvancedTags;
  }

  private static hasExplicitAIClaims(text: string): boolean {
    // Check for GUARANTEED_AI keywords which should auto-qualify
    return AI_KEYWORDS.GUARANTEED_AI.keywords.some(keyword => {
      return text.includes(keyword);
    });
  }
  
  /**
   * Check if company has guaranteed AI indicators (should always be classified as AI)
   */
  private static hasGuaranteedAI(company: CompanyData): boolean {
    const text = `${company.name || ''} ${company.one_liner || ''} ${company.long_description || ''}`.toLowerCase();
    const tags = company.tags.map(tag => tag.toLowerCase());
    
    // Check for guaranteed AI keywords in text
    const hasAIInText = AI_KEYWORDS.GUARANTEED_AI.keywords.some(keyword => {
      return text.includes(keyword);
    });
    
    // Check for guaranteed AI tags
    const hasAIInTags = tags.some(tag => {
      return AI_TAGS.GUARANTEED_AI.some(aiTag => 
        tag.includes(aiTag.toLowerCase())
      );
    });
    
    return hasAIInText || hasAIInTags;
  }

  private static isRecentBatch(batch: string): boolean {
    const currentYear = new Date().getFullYear();
    const batchYear = this.extractBatchYear(batch);
    return batchYear !== null && (currentYear - batchYear) <= 2;
  }

  private static extractBatchYear(batch: string): number | null {
    const match = batch.match(/(\d{4})/);
    return match ? parseInt(match[1]) : null;
  }

  // =============================================================================
  // Batch Analysis Methods
  // =============================================================================

  /**
   * Analyze multiple companies and return AI companies sorted by priority
   */
  static analyzeCompanies(companies: CompanyData[]): {
    aiCompanies: (CompanyData & { aiDetection: AIDetectionResult })[];
    stats: {
      total: number;
      aiCompanies: number;
      tier1: number;
      tier2: number;
      tier3: number;
      averageConfidence: number;
    };
  } {
    const results = companies.map(company => ({
      ...company,
      aiDetection: this.detectAICompany(company)
    }));

    const aiCompanies = results
      .filter(company => company.aiDetection.isAI)
      .sort((a, b) => b.aiDetection.priority - a.aiDetection.priority);

    const stats = this.calculateBatchStats(results);

    logInfo('Batch AI analysis completed', {
      totalCompanies: companies.length,
      aiCompaniesFound: aiCompanies.length,
      stats
    });

    return { aiCompanies, stats };
  }

  private static calculateBatchStats(results: (CompanyData & { aiDetection: AIDetectionResult })[]) {
    const aiResults = results.filter(r => r.aiDetection.isAI);
    
    return {
      total: results.length,
      aiCompanies: aiResults.length,
      tier1: aiResults.filter(r => r.aiDetection.tier === 'TIER_1').length,
      tier2: aiResults.filter(r => r.aiDetection.tier === 'TIER_2').length,
      tier3: aiResults.filter(r => r.aiDetection.tier === 'TIER_3').length,
      averageConfidence: aiResults.length > 0 
        ? aiResults.reduce((sum, r) => sum + r.aiDetection.confidence, 0) / aiResults.length 
        : 0
    };
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Quick function to detect if a single company is AI-related
 */
export function isAICompany(company: CompanyData, minConfidence: number = 0.5): boolean {
  const result = AICompanyDetector.detectAICompany(company);
  return result.confidence >= minConfidence;
}

/**
 * Get AI companies from a list with filtering options
 */
export function getAICompanies(
  companies: CompanyData[], 
  options: {
    minConfidence?: number;
    tier?: 'TIER_1' | 'TIER_2' | 'TIER_3';
    minPriority?: number;
  } = {}
): CompanyData[] {
  const { minConfidence = 0.5, tier, minPriority } = options;
  
  return companies.filter(company => {
    const detection = AICompanyDetector.detectAICompany(company);
    
    if (detection.confidence < minConfidence) return false;
    if (tier && detection.tier !== tier) return false;
    if (minPriority && detection.priority < minPriority) return false;
    
    return true;
  });
}

/**
 * Export the main detector class as default
 */
export default AICompanyDetector;