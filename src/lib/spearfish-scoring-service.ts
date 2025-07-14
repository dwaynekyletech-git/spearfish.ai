/**
 * Spearfish Scoring Service
 * 
 * Implements comprehensive weighted scoring system based on spearfishing methodology criteria
 * for evaluating Y Combinator companies. Scores range from 0-10 with detailed breakdowns.
 */

import { z } from 'zod';

// =============================================================================
// Types and Schemas
// =============================================================================

export const ScoringCriteriaSchema = z.object({
  // Heavy weight criteria (W22/S22/W23 batches)
  targetBatch: z.number().min(0).max(10).describe('Score for being in target YC batch'),
  
  // High weight criteria (18-24 months age, Series A stage)
  companyAge: z.number().min(0).max(10).describe('Score based on optimal company age'),
  fundingStage: z.number().min(0).max(10).describe('Score for being in Series A stage'),
  
  // Medium weight criteria
  githubActivity: z.number().min(0).max(10).describe('GitHub star growth >1K/month'),
  b2bFocus: z.number().min(0).max(10).describe('B2B market focus score'),
  huggingfaceActivity: z.number().min(0).max(10).describe('HuggingFace downloads >100K'),
  
  // Low weight criteria
  conferencePresence: z.number().min(0).max(10).describe('Conference and event presence'),
  nameQuality: z.number().min(0).max(10).describe('Professional name quality (inverse of boring)'),
  hiringStatus: z.number().min(0).max(10).describe('Active hiring status'),
});

export const ScoringWeightsSchema = z.object({
  // Heavy weight (40% total)
  targetBatch: z.number().min(0).max(1).default(0.4),
  
  // High weight (30% total)
  companyAge: z.number().min(0).max(1).default(0.15),
  fundingStage: z.number().min(0).max(1).default(0.15),
  
  // Medium weight (20% total)
  githubActivity: z.number().min(0).max(1).default(0.07),
  b2bFocus: z.number().min(0).max(1).default(0.07),
  huggingfaceActivity: z.number().min(0).max(1).default(0.06),
  
  // Low weight (10% total)
  conferencePresence: z.number().min(0).max(1).default(0.03),
  nameQuality: z.number().min(0).max(1).default(0.04),
  hiringStatus: z.number().min(0).max(1).default(0.03),
});

export const CompanyDataSchema = z.object({
  id: z.string().uuid(),
  yc_api_id: z.number().optional(),
  name: z.string(),
  batch: z.string(),
  industry: z.string().optional(),
  subindustry: z.string().optional(),
  one_liner: z.string().optional(),
  long_description: z.string().optional(),
  website_url: z.string().optional(),
  team_size: z.number().optional(),
  launched_at: z.number().optional(), // Unix timestamp
  status: z.enum(['Active', 'Acquired', 'Public', 'Inactive']).default('Active'),
  tags: z.array(z.string()).default([]),
  regions: z.array(z.string()).default([]),
  is_hiring: z.boolean().default(false),
  github_repos: z.array(z.any()).default([]),
  huggingface_models: z.array(z.any()).default([]),
  ai_confidence_score: z.number().min(0).max(1).optional(),
  spearfish_score: z.number().min(0).max(10).optional(),
});

export const ScoringResultSchema = z.object({
  totalScore: z.number().min(0).max(10),
  normalizedScore: z.number().min(0).max(100), // 0-100 scale for UI
  breakdown: ScoringCriteriaSchema,
  weights: ScoringWeightsSchema,
  calculatedAt: z.date(),
  algorithmVersion: z.string().default('1.0'),
  confidence: z.number().min(0).max(1).describe('Confidence in score accuracy'),
  metadata: z.object({
    missingDataPoints: z.array(z.string()),
    approximations: z.array(z.string()),
    warnings: z.array(z.string()),
  }),
});

export type ScoringCriteria = z.infer<typeof ScoringCriteriaSchema>;
export type ScoringWeights = z.infer<typeof ScoringWeightsSchema>;
export type CompanyData = z.infer<typeof CompanyDataSchema>;
export type ScoringResult = z.infer<typeof ScoringResultSchema>;

// =============================================================================
// Scoring Constants and Configuration
// =============================================================================

export const SCORING_CONFIG = {
  TARGET_BATCHES: ['W22', 'S22', 'W23'],
  OPTIMAL_AGE_MONTHS: { min: 18, max: 24 },
  SERIES_A_KEYWORDS: ['Series A', 'series a', 'Series-A', 'raised', 'funding', 'investment'],
  B2B_KEYWORDS: ['B2B', 'business', 'enterprise', 'SaaS', 'API', 'platform', 'developer'],
  CONFERENCE_KEYWORDS: ['conference', 'summit', 'event', 'speaking', 'presenting', 'keynote'],
  BORING_NAME_PATTERNS: [
    /^(AI|ML|Data|Tech|Cyber|Cloud|Digital|Smart|Auto|Micro|Nano|Meta|Super|Ultra|Hyper)/i,
    /Corp$|Inc$|LLC$|Ltd$/i,
    /\d{4}$/,
    /^[A-Z]{2,4}$/,
  ],
  ALGORITHM_VERSION: '1.0',
} as const;

export const DEFAULT_WEIGHTS: ScoringWeights = {
  targetBatch: 0.4,
  companyAge: 0.15,
  fundingStage: 0.15,
  githubActivity: 0.07,
  b2bFocus: 0.07,
  huggingfaceActivity: 0.06,
  conferencePresence: 0.03,
  nameQuality: 0.04,
  hiringStatus: 0.03,
};

// =============================================================================
// Core Scoring Algorithm
// =============================================================================

export class SpearfishScoringAlgorithm {
  private weights: ScoringWeights;
  private config: typeof SCORING_CONFIG;

  constructor(weights: ScoringWeights = DEFAULT_WEIGHTS) {
    this.weights = ScoringWeightsSchema.parse(weights);
    this.config = SCORING_CONFIG;
    this.validateWeights();
  }

  /**
   * Calculate comprehensive spearfish score for a company
   */
  calculateScore(company: CompanyData): ScoringResult {
    const validatedCompany = CompanyDataSchema.parse(company);
    const criteria = this.evaluateAllCriteria(validatedCompany);
    
    const totalScore = this.calculateWeightedScore(criteria);
    const normalizedScore = Math.round(totalScore * 10); // Convert to 0-100 scale
    
    const result: ScoringResult = {
      totalScore,
      normalizedScore,
      breakdown: criteria,
      weights: this.weights,
      calculatedAt: new Date(),
      algorithmVersion: this.config.ALGORITHM_VERSION,
      confidence: this.calculateConfidence(validatedCompany, criteria),
      metadata: this.generateMetadata(validatedCompany, criteria),
    };

    return ScoringResultSchema.parse(result);
  }

  /**
   * Evaluate all scoring criteria for a company
   */
  private evaluateAllCriteria(company: CompanyData): ScoringCriteria {
    return {
      targetBatch: this.evaluateTargetBatch(company),
      companyAge: this.evaluateCompanyAge(company),
      fundingStage: this.evaluateFundingStage(company),
      githubActivity: this.evaluateGithubActivity(company),
      b2bFocus: this.evaluateB2BFocus(company),
      huggingfaceActivity: this.evaluateHuggingFaceActivity(company),
      conferencePresence: this.evaluateConferencePresence(company),
      nameQuality: this.evaluateNameQuality(company),
      hiringStatus: this.evaluateHiringStatus(company),
    };
  }

  /**
   * Calculate weighted total score
   */
  private calculateWeightedScore(criteria: ScoringCriteria): number {
    const weightedSum = 
      criteria.targetBatch * this.weights.targetBatch +
      criteria.companyAge * this.weights.companyAge +
      criteria.fundingStage * this.weights.fundingStage +
      criteria.githubActivity * this.weights.githubActivity +
      criteria.b2bFocus * this.weights.b2bFocus +
      criteria.huggingfaceActivity * this.weights.huggingfaceActivity +
      criteria.conferencePresence * this.weights.conferencePresence +
      criteria.nameQuality * this.weights.nameQuality +
      criteria.hiringStatus * this.weights.hiringStatus;

    return Math.min(Math.max(weightedSum, 0), 10);
  }

  // =============================================================================
  // Individual Criteria Evaluation Methods
  // =============================================================================

  /**
   * Evaluate target batch score (Heavy weight)
   */
  private evaluateTargetBatch(company: CompanyData): number {
    if (!company.batch) return 0;
    
    const normalizedBatch = this.normalizeBatch(company.batch);
    return (this.config.TARGET_BATCHES as readonly string[]).includes(normalizedBatch) ? 10 : 0;
  }

  /**
   * Evaluate company age score (High weight)
   */
  private evaluateCompanyAge(company: CompanyData): number {
    if (!company.launched_at) return 5; // Default middle score for missing data
    
    const launchDate = new Date(company.launched_at * 1000);
    const monthsOld = (Date.now() - launchDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    
    const { min, max } = this.config.OPTIMAL_AGE_MONTHS;
    
    if (monthsOld >= min && monthsOld <= max) {
      return 10; // Perfect age range
    } else if (monthsOld < min) {
      return Math.max(0, 10 - (min - monthsOld) * 0.5); // Too young
    } else {
      return Math.max(0, 10 - (monthsOld - max) * 0.3); // Too old
    }
  }

  /**
   * Evaluate funding stage score (High weight)
   */
  private evaluateFundingStage(company: CompanyData): number {
    const description = `${company.one_liner || ''} ${company.long_description || ''}`.toLowerCase();
    
    for (const keyword of this.config.SERIES_A_KEYWORDS) {
      if (description.includes(keyword.toLowerCase())) {
        return 10;
      }
    }
    
    return 3; // Default score for unknown funding stage
  }

  /**
   * Evaluate GitHub activity score (Medium weight)
   */
  private evaluateGithubActivity(company: CompanyData): number {
    if (!company.github_repos || company.github_repos.length === 0) {
      return 2; // Low default for no GitHub presence
    }
    
    // This is a simplified implementation
    // In a real system, you'd fetch actual GitHub data
    const repoCount = company.github_repos.length;
    
    if (repoCount >= 10) return 10;
    if (repoCount >= 5) return 7;
    if (repoCount >= 2) return 5;
    return 3;
  }

  /**
   * Evaluate B2B focus score (Medium weight)
   */
  private evaluateB2BFocus(company: CompanyData): number {
    const text = `${company.one_liner || ''} ${company.long_description || ''} ${company.industry || ''}`.toLowerCase();
    
    let score = 0;
    for (const keyword of this.config.B2B_KEYWORDS) {
      if (text.includes(keyword.toLowerCase())) {
        score += 2;
      }
    }
    
    return Math.min(score, 10);
  }

  /**
   * Evaluate HuggingFace activity score (Medium weight)
   */
  private evaluateHuggingFaceActivity(company: CompanyData): number {
    if (!company.huggingface_models || company.huggingface_models.length === 0) {
      return 1; // Low default for no HuggingFace presence
    }
    
    // This is a simplified implementation
    // In a real system, you'd fetch actual HuggingFace download data
    const modelCount = company.huggingface_models.length;
    
    if (modelCount >= 5) return 10;
    if (modelCount >= 2) return 7;
    return 5;
  }

  /**
   * Evaluate conference presence score (Low weight)
   */
  private evaluateConferencePresence(company: CompanyData): number {
    const text = `${company.one_liner || ''} ${company.long_description || ''}`.toLowerCase();
    
    for (const keyword of this.config.CONFERENCE_KEYWORDS) {
      if (text.includes(keyword.toLowerCase())) {
        return 8;
      }
    }
    
    return 2; // Default low score
  }

  /**
   * Evaluate name quality score (Low weight) - inverse of boring
   */
  private evaluateNameQuality(company: CompanyData): number {
    if (!company.name) return 5;
    
    for (const pattern of this.config.BORING_NAME_PATTERNS) {
      if (pattern.test(company.name)) {
        return 3; // Boring name
      }
    }
    
    return 8; // Non-boring name
  }

  /**
   * Evaluate hiring status score (Low weight)
   */
  private evaluateHiringStatus(company: CompanyData): number {
    return company.is_hiring ? 8 : 4;
  }

  // =============================================================================
  // Helper Methods
  // =============================================================================

  /**
   * Normalize batch name to standard format
   */
  private normalizeBatch(batch: string): string {
    const match = batch.match(/^(Winter|Summer)\s+(\d{4})$/);
    if (match) {
      const [, season, year] = match;
      const shortSeason = season === 'Winter' ? 'W' : 'S';
      const shortYear = year.slice(-2);
      return `${shortSeason}${shortYear}`;
    }
    return batch;
  }

  /**
   * Calculate confidence in score accuracy
   */
  private calculateConfidence(company: CompanyData, criteria: ScoringCriteria): number {
    const requiredFields: (keyof CompanyData)[] = ['batch', 'launched_at', 'one_liner', 'github_repos', 'huggingface_models'];
    const availableFields = requiredFields.filter(field => {
      const value = company[field];
      return value !== undefined && value !== null && value !== '';
    });
    
    const dataCompleteness = availableFields.length / requiredFields.length;
    const scoreVariance = this.calculateScoreVariance(criteria);
    
    return Math.min(dataCompleteness * 0.7 + (1 - scoreVariance) * 0.3, 1);
  }

  /**
   * Calculate score variance to assess confidence
   */
  private calculateScoreVariance(criteria: ScoringCriteria): number {
    const scores = Object.values(criteria) as number[];
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    return Math.sqrt(variance) / 10; // Normalize to 0-1 range
  }

  /**
   * Generate metadata about the scoring process
   */
  private generateMetadata(company: CompanyData, criteria: ScoringCriteria): {
    missingDataPoints: string[];
    approximations: string[];
    warnings: string[];
  } {
    const missingDataPoints: string[] = [];
    const approximations: string[] = [];
    const warnings: string[] = [];

    if (!company.launched_at) {
      missingDataPoints.push('launched_at');
      approximations.push('Used default middle score for company age');
    }

    if (!company.github_repos || company.github_repos.length === 0) {
      missingDataPoints.push('github_repos');
      approximations.push('Used minimal GitHub activity score');
    }

    if (!company.huggingface_models || company.huggingface_models.length === 0) {
      missingDataPoints.push('huggingface_models');
      approximations.push('Used minimal HuggingFace activity score');
    }

    if (criteria.fundingStage === 3) {
      warnings.push('Funding stage could not be determined from available data');
    }

    return { missingDataPoints, approximations, warnings };
  }

  /**
   * Validate that weights sum to 1.0
   */
  private validateWeights(): void {
    const totalWeight = Object.values(this.weights).reduce((sum, weight) => sum + weight, 0);
    if (Math.abs(totalWeight - 1.0) > 0.001) {
      throw new Error(`Weights must sum to 1.0, got ${totalWeight}`);
    }
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Create a new scoring algorithm instance
 */
export function createSpearfishScoringAlgorithm(weights?: ScoringWeights): SpearfishScoringAlgorithm {
  return new SpearfishScoringAlgorithm(weights);
}

/**
 * Quick function to calculate score for a company
 */
export function calculateSpearfishScore(company: CompanyData, weights?: ScoringWeights): ScoringResult {
  const algorithm = createSpearfishScoringAlgorithm(weights);
  return algorithm.calculateScore(company);
}

/**
 * Batch scoring function for multiple companies
 */
export async function batchCalculateSpearfishScores(
  companies: CompanyData[],
  weights?: ScoringWeights
): Promise<ScoringResult[]> {
  const algorithm = createSpearfishScoringAlgorithm(weights);
  
  return companies.map(company => {
    try {
      return algorithm.calculateScore(company);
    } catch (error) {
      console.error(`Error calculating score for company ${company.name}:`, error);
      throw error;
    }
  });
}

// Export default instance
export const spearfishScoringService = createSpearfishScoringAlgorithm();