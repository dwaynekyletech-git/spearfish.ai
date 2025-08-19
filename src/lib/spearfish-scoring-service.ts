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
  team_size: z.number().nullable().optional(),
  launched_at: z.number().optional(), // Unix timestamp
  status: z.enum(['Active', 'Acquired', 'Public', 'Inactive']).default('Active'),
  tags: z.union([z.array(z.string()), z.string()]).transform(val => 
    typeof val === 'string' ? (val ? val.split(',').map(s => s.trim()) : []) : val
  ).default([]),
  regions: z.union([z.array(z.string()), z.string()]).transform(val => 
    typeof val === 'string' ? (val ? val.split(',').map(s => s.trim()) : []) : val
  ).default([]),
  is_hiring: z.boolean().default(false),
  small_logo_thumb_url: z.string().optional(),
  github_repos: z.array(z.any()).default([]),
  huggingface_models: z.array(z.any()).default([]),
  ai_confidence_score: z.number().min(0).max(1).nullable().optional(),
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
  ALGORITHM_VERSION: '2.0', // Updated to use real GitHub and HuggingFace data
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
   * Uses company age as proxy for Series A readiness (18-30 months = likely Series A stage)
   */
  private evaluateFundingStage(company: CompanyData): number {
    if (!company.launched_at) return 3; // Default for missing launch data
    
    const launchDate = new Date(company.launched_at * 1000);
    const monthsOld = (Date.now() - launchDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    
    // Series A readiness based on company age
    if (monthsOld >= 18 && monthsOld <= 30) {
      return 10; // Optimal Series A timing
    } else if (monthsOld >= 12 && monthsOld <= 36) {
      return 7;  // Close to Series A timing
    } else if (monthsOld >= 6 && monthsOld <= 42) {
      return 5;  // Possible Series A timing
    }
    
    return 3; // Too early or too late for typical Series A
  }

  /**
   * Evaluate GitHub activity score (Medium weight)
   * Now uses real GitHub data including stars, forks, and activity metrics
   */
  private evaluateGithubActivity(company: CompanyData): number {
    if (!company.github_repos || company.github_repos.length === 0) {
      return 1; // Low default for no GitHub presence
    }
    
    // Calculate metrics from real GitHub data
    const repos = company.github_repos as any[];
    let totalStars = 0;
    let totalForks = 0;
    let activeRepos = 0;
    let maxStarsPerRepo = 0;
    
    repos.forEach(repo => {
      const stars = repo.stars_count || 0;
      const forks = repo.forks_count || 0;
      
      totalStars += stars;
      totalForks += forks;
      maxStarsPerRepo = Math.max(maxStarsPerRepo, stars);
      
      // Count as active if it has recent activity (stars or forks)
      if (stars > 0 || forks > 0) {
        activeRepos++;
      }
    });
    
    const repoCount = repos.length;
    const avgStarsPerRepo = repoCount > 0 ? totalStars / repoCount : 0;
    
    // Scoring based on multiple factors
    let score = 0;
    
    // Factor 1: Total star count (40% of GitHub score)
    if (totalStars >= 10000) score += 4.0;
    else if (totalStars >= 5000) score += 3.5;
    else if (totalStars >= 1000) score += 3.0;
    else if (totalStars >= 500) score += 2.5;
    else if (totalStars >= 100) score += 2.0;
    else if (totalStars >= 50) score += 1.5;
    else if (totalStars >= 10) score += 1.0;
    else if (totalStars > 0) score += 0.5;
    
    // Factor 2: Repository count and quality (30% of GitHub score)
    if (repoCount >= 10 && avgStarsPerRepo >= 50) score += 3.0;
    else if (repoCount >= 5 && avgStarsPerRepo >= 20) score += 2.5;
    else if (repoCount >= 3 && avgStarsPerRepo >= 10) score += 2.0;
    else if (repoCount >= 2) score += 1.5;
    else if (repoCount >= 1) score += 1.0;
    
    // Factor 3: Community engagement via forks (20% of GitHub score)
    if (totalForks >= 1000) score += 2.0;
    else if (totalForks >= 500) score += 1.5;
    else if (totalForks >= 100) score += 1.0;
    else if (totalForks >= 20) score += 0.5;
    
    // Factor 4: Flagship repository strength (10% of GitHub score)
    if (maxStarsPerRepo >= 5000) score += 1.0;
    else if (maxStarsPerRepo >= 1000) score += 0.8;
    else if (maxStarsPerRepo >= 500) score += 0.6;
    else if (maxStarsPerRepo >= 100) score += 0.4;
    else if (maxStarsPerRepo >= 50) score += 0.2;
    
    return Math.min(Math.max(score, 1), 10);
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
   * Now uses real HuggingFace data including downloads, likes, and model engagement
   */
  private evaluateHuggingFaceActivity(company: CompanyData): number {
    if (!company.huggingface_models || company.huggingface_models.length === 0) {
      return 1; // Low default for no HuggingFace presence
    }
    
    // Calculate metrics from real HuggingFace data
    const models = company.huggingface_models as any[];
    let totalDownloads = 0;
    let totalLikes = 0;
    let activeModels = 0;
    let maxDownloadsPerModel = 0;
    let maxLikesPerModel = 0;
    const taskTypes = new Set<string>();
    
    models.forEach(model => {
      const downloads = model.downloads || 0;
      const likes = model.likes || 0;
      const task = model.task;
      
      totalDownloads += downloads;
      totalLikes += likes;
      maxDownloadsPerModel = Math.max(maxDownloadsPerModel, downloads);
      maxLikesPerModel = Math.max(maxLikesPerModel, likes);
      
      if (task) {
        taskTypes.add(task);
      }
      
      // Count as active if it has downloads or likes
      if (downloads > 0 || likes > 0) {
        activeModels++;
      }
    });
    
    const modelCount = models.length;
    const avgDownloadsPerModel = modelCount > 0 ? totalDownloads / modelCount : 0;
    const taskDiversity = taskTypes.size;
    
    // Scoring based on multiple factors
    let score = 0;
    
    // Factor 1: Total download count (45% of HF score)
    if (totalDownloads >= 1000000) score += 4.5;      // 1M+ downloads
    else if (totalDownloads >= 500000) score += 4.0;  // 500K+ downloads
    else if (totalDownloads >= 100000) score += 3.5;  // 100K+ downloads
    else if (totalDownloads >= 50000) score += 3.0;   // 50K+ downloads
    else if (totalDownloads >= 10000) score += 2.5;   // 10K+ downloads
    else if (totalDownloads >= 5000) score += 2.0;    // 5K+ downloads
    else if (totalDownloads >= 1000) score += 1.5;    // 1K+ downloads
    else if (totalDownloads >= 100) score += 1.0;     // 100+ downloads
    else if (totalDownloads > 0) score += 0.5;        // Some downloads
    
    // Factor 2: Community engagement via likes (25% of HF score)
    if (totalLikes >= 500) score += 2.5;
    else if (totalLikes >= 200) score += 2.0;
    else if (totalLikes >= 100) score += 1.5;
    else if (totalLikes >= 50) score += 1.0;
    else if (totalLikes >= 20) score += 0.8;
    else if (totalLikes >= 10) score += 0.6;
    else if (totalLikes >= 5) score += 0.4;
    else if (totalLikes > 0) score += 0.2;
    
    // Factor 3: Model portfolio and quality (20% of HF score)
    if (modelCount >= 10 && avgDownloadsPerModel >= 1000) score += 2.0;
    else if (modelCount >= 5 && avgDownloadsPerModel >= 500) score += 1.5;
    else if (modelCount >= 3 && avgDownloadsPerModel >= 100) score += 1.0;
    else if (modelCount >= 2) score += 0.8;
    else if (modelCount >= 1) score += 0.5;
    
    // Factor 4: Flagship model strength (10% of HF score)
    if (maxDownloadsPerModel >= 500000) score += 1.0;
    else if (maxDownloadsPerModel >= 100000) score += 0.8;
    else if (maxDownloadsPerModel >= 50000) score += 0.6;
    else if (maxDownloadsPerModel >= 10000) score += 0.4;
    else if (maxDownloadsPerModel >= 1000) score += 0.2;
    
    // Bonus: Task diversity (indicates versatility)
    if (taskDiversity >= 3) score += 0.5;
    else if (taskDiversity >= 2) score += 0.3;
    
    return Math.min(Math.max(score, 1), 10);
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
      approximations.push('Used minimal GitHub activity score (no repositories found)');
    } else {
      // Check if we have real GitHub data with metrics
      const repos = company.github_repos as any[];
      const hasMetrics = repos.some(repo => 
        repo.stars_count !== undefined || repo.forks_count !== undefined
      );
      if (!hasMetrics) {
        approximations.push('GitHub repos found but missing engagement metrics');
      }
    }

    if (!company.huggingface_models || company.huggingface_models.length === 0) {
      missingDataPoints.push('huggingface_models');
      approximations.push('Used minimal HuggingFace activity score (no models found)');
    } else {
      // Check if we have real HuggingFace data with metrics
      const models = company.huggingface_models as any[];
      const hasMetrics = models.some(model => 
        model.downloads !== undefined || model.likes !== undefined
      );
      if (!hasMetrics) {
        approximations.push('HuggingFace models found but missing engagement metrics');
      }
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