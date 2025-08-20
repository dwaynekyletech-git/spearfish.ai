/**
 * Industry Extraction Service
 * 
 * Intelligently extracts industry information from company tags, descriptions,
 * and other metadata to provide consistent industry categorization.
 * 
 * Features:
 * - Comprehensive industry keyword mapping
 * - Pattern matching and fuzzy matching
 * - Priority-based extraction logic
 * - Support for multiple industry categories
 */

export interface IndustryExtractionResult {
  primaryIndustry: string;
  subIndustries: string[];
  confidence: number;
  matchedTags: string[];
  extractionMethod: 'exact' | 'keyword' | 'pattern' | 'description' | 'fallback';
}

export class IndustryExtractionService {
  // Comprehensive industry mapping with keywords and patterns
  private static readonly INDUSTRY_MAPPINGS = {
    // Technology & Software
    'Artificial Intelligence': [
      'ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning',
      'neural networks', 'nlp', 'natural language processing', 'computer vision',
      'llm', 'large language model', 'gpt', 'generative ai', 'ai agents',
      'robotics', 'automation', 'intelligent systems', 'cognitive computing'
    ],
    'Enterprise Software': [
      'b2b', 'enterprise', 'saas', 'software as a service', 'business software',
      'enterprise solutions', 'crm', 'erp', 'hr software', 'productivity',
      'workflow', 'business intelligence', 'analytics platform'
    ],
    'Developer Tools': [
      'developer tools', 'devtools', 'api', 'sdk', 'framework', 'library',
      'ide', 'code editor', 'deployment', 'ci/cd', 'devops', 'infrastructure',
      'cloud tools', 'monitoring', 'debugging', 'testing tools'
    ],
    'Cybersecurity': [
      'cybersecurity', 'security', 'infosec', 'data protection', 'privacy',
      'encryption', 'authentication', 'identity management', 'threat detection',
      'vulnerability', 'compliance', 'zero trust'
    ],
    'Data & Analytics': [
      'data analytics', 'big data', 'business intelligence', 'data science',
      'data visualization', 'dashboard', 'metrics', 'reporting', 'etl',
      'data pipeline', 'data warehouse', 'analytics platform'
    ],

    // Financial Services
    'Financial Technology': [
      'fintech', 'financial technology', 'payments', 'digital payments',
      'mobile payments', 'cryptocurrency', 'crypto', 'blockchain', 'defi',
      'neobank', 'digital bank', 'lending', 'wealth management', 'insurtech',
      'regtech', 'trading', 'investment'
    ],
    'Banking': [
      'banking', 'digital banking', 'online banking', 'mobile banking',
      'credit', 'loans', 'mortgage', 'financial services'
    ],

    // Healthcare & Life Sciences
    'Healthcare Technology': [
      'healthtech', 'digital health', 'telemedicine', 'health tech',
      'medical technology', 'health monitoring', 'wellness', 'fitness tech',
      'mental health', 'therapy', 'healthcare analytics'
    ],
    'Biotechnology': [
      'biotech', 'biotechnology', 'life sciences', 'pharmaceutical',
      'drug discovery', 'genomics', 'precision medicine', 'clinical trials',
      'medical devices', 'diagnostics'
    ],

    // E-commerce & Retail
    'E-commerce': [
      'e-commerce', 'ecommerce', 'online retail', 'marketplace', 'shopping',
      'retail technology', 'dropshipping', 'fulfillment', 'inventory management'
    ],
    'Consumer Products': [
      'consumer', 'b2c', 'retail', 'consumer goods', 'lifestyle',
      'fashion', 'beauty', 'home goods', 'electronics'
    ],

    // Media & Entertainment
    'Media & Entertainment': [
      'media', 'entertainment', 'streaming', 'video', 'gaming', 'games',
      'content creation', 'social media', 'creator economy', 'influencer',
      'digital media', 'publishing'
    ],
    'Social Media': [
      'social media', 'social network', 'community', 'social platform',
      'messaging', 'communication', 'chat', 'collaboration'
    ],

    // Transportation & Logistics
    'Transportation': [
      'transportation', 'mobility', 'ridesharing', 'logistics', 'delivery',
      'shipping', 'freight', 'supply chain', 'autonomous vehicles', 'ev',
      'electric vehicles', 'scooters', 'bikes'
    ],

    // Education
    'Education Technology': [
      'edtech', 'education technology', 'online learning', 'e-learning',
      'training', 'courseware', 'lms', 'learning management', 'tutoring',
      'skill development', 'certification'
    ],

    // Real Estate & Construction
    'Real Estate Technology': [
      'proptech', 'real estate', 'property management', 'rental',
      'housing', 'construction tech', 'smart buildings', 'facility management'
    ],

    // Agriculture & Food
    'Food Technology': [
      'foodtech', 'food technology', 'restaurant tech', 'delivery',
      'food delivery', 'agriculture', 'agtech', 'farming', 'sustainability'
    ],

    // Energy & Environment
    'Clean Technology': [
      'cleantech', 'clean energy', 'renewable energy', 'solar', 'wind',
      'sustainability', 'carbon', 'climate tech', 'green technology',
      'environmental', 'energy storage'
    ],

    // Manufacturing & Industrial
    'Industrial Technology': [
      'industrial', 'manufacturing', 'iot', 'internet of things',
      'smart manufacturing', 'industry 4.0', 'sensors', 'hardware'
    ],

    // Legal & Compliance
    'Legal Technology': [
      'legaltech', 'legal technology', 'contract management', 'compliance',
      'legal services', 'law', 'litigation', 'document management'
    ]
  };

  // Common technology indicators
  private static readonly TECH_INDICATORS = [
    'api', 'platform', 'software', 'app', 'mobile', 'web', 'cloud',
    'digital', 'online', 'technology', 'tech', 'system', 'solution'
  ];

  /**
   * Extract industry information from tags and description
   */
  static extractIndustry(
    tags: string[] = [],
    description?: string,
    companyName?: string
  ): IndustryExtractionResult {
    const normalizedTags = tags.map(tag => tag.toLowerCase().trim());
    const searchText = [
      companyName || '',
      description || '',
      ...tags
    ].join(' ').toLowerCase();

    // Track the best match
    let bestMatch: IndustryExtractionResult = {
      primaryIndustry: 'Technology',
      subIndustries: [],
      confidence: 0,
      matchedTags: [],
      extractionMethod: 'fallback'
    };

    // 1. Exact industry name matching in tags
    for (const [industry, keywords] of Object.entries(this.INDUSTRY_MAPPINGS)) {
      const industryLower = industry.toLowerCase();
      if (normalizedTags.some(tag => tag === industryLower || tag.includes(industryLower))) {
        return {
          primaryIndustry: industry,
          subIndustries: this.extractSubIndustries(normalizedTags, industry),
          confidence: 0.95,
          matchedTags: normalizedTags.filter(tag => tag === industryLower || tag.includes(industryLower)),
          extractionMethod: 'exact'
        };
      }
    }

    // 2. Keyword matching with improved scoring
    for (const [industry, keywords] of Object.entries(this.INDUSTRY_MAPPINGS)) {
      const matches = keywords.filter(keyword => 
        normalizedTags.some(tag => tag.includes(keyword)) ||
        searchText.includes(keyword)
      );

      if (matches.length > 0) {
        // Improved confidence calculation - give higher scores for exact matches
        let confidence = Math.min(0.9, (matches.length / keywords.length) * 3);
        
        // Boost confidence for exact tag matches
        const exactMatches = matches.filter(keyword => 
          normalizedTags.some(tag => tag === keyword || tag === keyword.replace(' ', ''))
        );
        if (exactMatches.length > 0) {
          confidence = Math.min(0.9, confidence + 0.3);
        }

        // Special boost for high-priority industry indicators
        if (this.isHighPriorityIndustry(industry, matches)) {
          confidence = Math.min(0.9, confidence + 0.2);
        }

        if (confidence > bestMatch.confidence) {
          bestMatch = {
            primaryIndustry: industry,
            subIndustries: this.extractSubIndustries(normalizedTags, industry),
            confidence,
            matchedTags: matches,
            extractionMethod: 'keyword'
          };
        }
      }
    }

    // 3. Pattern matching for common formats
    const patternMatch = this.extractByPatterns(normalizedTags, searchText);
    if (patternMatch && patternMatch.confidence > bestMatch.confidence) {
      bestMatch = patternMatch;
    }

    // 4. Tech industry fallback
    if (bestMatch.confidence < 0.3) {
      const hasTechIndicators = this.TECH_INDICATORS.some(indicator =>
        normalizedTags.some(tag => tag.includes(indicator)) ||
        searchText.includes(indicator)
      );

      if (hasTechIndicators) {
        bestMatch = {
          primaryIndustry: 'Technology',
          subIndustries: [],
          confidence: 0.4,
          matchedTags: this.TECH_INDICATORS.filter(indicator => searchText.includes(indicator)),
          extractionMethod: 'pattern'
        };
      }
    }

    return bestMatch;
  }

  /**
   * Extract sub-industries based on additional tag analysis
   */
  private static extractSubIndustries(tags: string[], primaryIndustry: string): string[] {
    const subIndustries: string[] = [];

    // Look for additional industry matches that could be sub-industries
    for (const [industry, keywords] of Object.entries(this.INDUSTRY_MAPPINGS)) {
      if (industry === primaryIndustry) continue;

      const hasMatch = keywords.some(keyword =>
        tags.some(tag => tag.includes(keyword))
      );

      if (hasMatch) {
        subIndustries.push(industry);
      }
    }

    return subIndustries.slice(0, 3); // Limit to top 3 sub-industries
  }

  /**
   * Check if industry has high-priority indicators that should boost confidence
   */
  private static isHighPriorityIndustry(industry: string, matches: string[]): boolean {
    const highPriorityIndicators = {
      'Financial Technology': ['fintech', 'payments', 'cryptocurrency', 'crypto', 'blockchain'],
      'Artificial Intelligence': ['ai', 'artificial intelligence', 'machine learning', 'llm'],
      'Healthcare Technology': ['healthtech', 'telemedicine', 'digital health'],
      'Enterprise Software': ['saas', 'enterprise'],
      'E-commerce': ['e-commerce', 'ecommerce'],
      'Developer Tools': ['developer tools', 'devtools', 'api'],
      'Cybersecurity': ['cybersecurity', 'security']
    };

    const priorityTerms = highPriorityIndicators[industry as keyof typeof highPriorityIndicators];
    if (!priorityTerms) return false;

    return matches.some(match => priorityTerms.includes(match.toLowerCase()));
  }

  /**
   * Pattern-based industry extraction
   */
  private static extractByPatterns(tags: string[], searchText: string): IndustryExtractionResult | null {
    // Check for specific high-priority patterns first
    const tagString = tags.join(' ').toLowerCase();
    
    // Financial Technology patterns (prioritize over B2B)
    if (tags.some(tag => ['fintech', 'payments', 'crypto', 'cryptocurrency', 'blockchain'].includes(tag.toLowerCase()))) {
      return {
        primaryIndustry: 'Financial Technology',
        subIndustries: [],
        confidence: 0.8,
        matchedTags: tags.filter(tag => ['fintech', 'payments', 'crypto', 'cryptocurrency', 'blockchain'].includes(tag.toLowerCase())),
        extractionMethod: 'pattern'
      };
    }

    // AI patterns (catch variations like "AI Safety")
    if (tags.some(tag => tag.toLowerCase().includes('ai')) || searchText.includes('artificial intelligence')) {
      return {
        primaryIndustry: 'Artificial Intelligence',
        subIndustries: [],
        confidence: 0.8,
        matchedTags: tags.filter(tag => tag.toLowerCase().includes('ai')),
        extractionMethod: 'pattern'
      };
    }

    // SaaS pattern (high confidence)
    if (tags.includes('saas') || searchText.includes('software as a service')) {
      return {
        primaryIndustry: 'Enterprise Software',
        subIndustries: [],
        confidence: 0.8,
        matchedTags: ['saas'],
        extractionMethod: 'pattern'
      };
    }

    // B2B/B2C patterns (lower priority)
    if (tags.includes('b2b') || searchText.includes('business to business')) {
      return {
        primaryIndustry: 'Enterprise Software',
        subIndustries: [],
        confidence: 0.6,
        matchedTags: ['b2b'],
        extractionMethod: 'pattern'
      };
    }

    if (tags.includes('b2c') || searchText.includes('business to consumer')) {
      return {
        primaryIndustry: 'Consumer Products',
        subIndustries: [],
        confidence: 0.6,
        matchedTags: ['b2c'],
        extractionMethod: 'pattern'
      };
    }

    return null;
  }

  /**
   * Get all supported industries
   */
  static getSupportedIndustries(): string[] {
    return Object.keys(this.INDUSTRY_MAPPINGS);
  }

  /**
   * Validate if an industry is supported
   */
  static isValidIndustry(industry: string): boolean {
    return Object.keys(this.INDUSTRY_MAPPINGS).includes(industry);
  }

  /**
   * Extract multiple industries from complex tags
   */
  static extractMultipleIndustries(
    tags: string[] = [],
    description?: string,
    companyName?: string
  ): string[] {
    const result = this.extractIndustry(tags, description, companyName);
    const industries = [result.primaryIndustry];
    
    // Add sub-industries with high confidence
    result.subIndustries.forEach(sub => {
      if (!industries.includes(sub)) {
        industries.push(sub);
      }
    });

    return industries;
  }
}

// Export convenience functions
export const extractIndustry = IndustryExtractionService.extractIndustry.bind(IndustryExtractionService);
export const extractMultipleIndustries = IndustryExtractionService.extractMultipleIndustries.bind(IndustryExtractionService);
export const getSupportedIndustries = IndustryExtractionService.getSupportedIndustries.bind(IndustryExtractionService);