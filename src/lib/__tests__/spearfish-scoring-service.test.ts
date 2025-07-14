/**
 * Tests for Spearfish Scoring Service
 * 
 * Unit tests for the spearfish scoring algorithm implementation
 */

import { 
  SpearfishScoringAlgorithm, 
  calculateSpearfishScore, 
  batchCalculateSpearfishScores,
  CompanyData,
  ScoringCriteria,
  ScoringWeights,
  DEFAULT_WEIGHTS,
  SCORING_CONFIG
} from '../spearfish-scoring-service';

describe('SpearfishScoringAlgorithm', () => {
  let algorithm: SpearfishScoringAlgorithm;

  beforeEach(() => {
    algorithm = new SpearfishScoringAlgorithm();
  });

  describe('Constructor and Weight Validation', () => {
    it('should create an instance with default weights', () => {
      expect(algorithm).toBeInstanceOf(SpearfishScoringAlgorithm);
    });

    it('should validate that weights sum to 1.0', () => {
      const invalidWeights: ScoringWeights = {
        ...DEFAULT_WEIGHTS,
        targetBatch: 0.5, // This will make the sum > 1.0
      };

      expect(() => {
        new SpearfishScoringAlgorithm(invalidWeights);
      }).toThrow('Weights must sum to 1.0');
    });

    it('should accept valid custom weights', () => {
      const customWeights: ScoringWeights = {
        targetBatch: 0.3,
        companyAge: 0.2,
        fundingStage: 0.2,
        githubActivity: 0.1,
        b2bFocus: 0.1,
        huggingfaceActivity: 0.05,
        conferencePresence: 0.02,
        nameQuality: 0.02,
        hiringStatus: 0.01,
      };

      expect(() => {
        new SpearfishScoringAlgorithm(customWeights);
      }).not.toThrow();
    });
  });

  describe('Score Calculation', () => {
    const mockCompanyData: CompanyData = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'TestCorp',
      batch: 'W22',
      industry: 'Artificial Intelligence',
      one_liner: 'AI-powered B2B platform for developers',
      long_description: 'A comprehensive AI platform that helps businesses with Series A funding',
      launched_at: Math.floor(Date.now() / 1000) - (20 * 30 * 24 * 60 * 60), // 20 months ago
      github_repos: [{}, {}, {}], // 3 repos
      huggingface_models: [{}, {}], // 2 models
      is_hiring: true,
      ai_confidence_score: 0.95,
      status: 'Active',
      tags: ['AI', 'B2B', 'Developer Tools'],
      regions: ['San Francisco'],
      team_size: 15,
    };

    it('should calculate a score between 0 and 10', () => {
      const result = algorithm.calculateScore(mockCompanyData);
      
      expect(result.totalScore).toBeGreaterThanOrEqual(0);
      expect(result.totalScore).toBeLessThanOrEqual(10);
    });

    it('should return a normalized score between 0 and 100', () => {
      const result = algorithm.calculateScore(mockCompanyData);
      
      expect(result.normalizedScore).toBeGreaterThanOrEqual(0);
      expect(result.normalizedScore).toBeLessThanOrEqual(100);
    });

    it('should include all required fields in the result', () => {
      const result = algorithm.calculateScore(mockCompanyData);
      
      expect(result).toHaveProperty('totalScore');
      expect(result).toHaveProperty('normalizedScore');
      expect(result).toHaveProperty('breakdown');
      expect(result).toHaveProperty('weights');
      expect(result).toHaveProperty('calculatedAt');
      expect(result).toHaveProperty('algorithmVersion');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('metadata');
    });

    it('should have correct algorithm version', () => {
      const result = algorithm.calculateScore(mockCompanyData);
      
      expect(result.algorithmVersion).toBe(SCORING_CONFIG.ALGORITHM_VERSION);
    });
  });

  describe('Individual Scoring Criteria', () => {
    const createTestCompany = (overrides: Partial<CompanyData> = {}): CompanyData => ({
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'TestCorp',
      batch: 'W22',
      industry: 'Technology',
      one_liner: 'Test company',
      long_description: 'Test description',
      launched_at: Math.floor(Date.now() / 1000) - (20 * 30 * 24 * 60 * 60),
      github_repos: [],
      huggingface_models: [],
      is_hiring: false,
      ai_confidence_score: 0.5,
      status: 'Active',
      tags: [],
      regions: [],
      team_size: 10,
      ...overrides,
    });

    it('should give high score for target batch companies', () => {
      const targetBatchCompany = createTestCompany({ batch: 'W22' });
      const nonTargetBatchCompany = createTestCompany({ batch: 'W21' });

      const targetResult = algorithm.calculateScore(targetBatchCompany);
      const nonTargetResult = algorithm.calculateScore(nonTargetBatchCompany);

      expect(targetResult.breakdown.targetBatch).toBe(10);
      expect(nonTargetResult.breakdown.targetBatch).toBe(0);
    });

    it('should score company age optimally for 18-24 months', () => {
      const optimalAgeCompany = createTestCompany({
        launched_at: Math.floor(Date.now() / 1000) - (20 * 30 * 24 * 60 * 60), // 20 months
      });
      
      const result = algorithm.calculateScore(optimalAgeCompany);
      expect(result.breakdown.companyAge).toBe(10);
    });

    it('should detect Series A funding stage', () => {
      const seriesACompany = createTestCompany({
        long_description: 'We recently raised our Series A funding round',
      });

      const result = algorithm.calculateScore(seriesACompany);
      expect(result.breakdown.fundingStage).toBe(10);
    });

    it('should score GitHub activity based on repo count', () => {
      const highGithubActivity = createTestCompany({
        github_repos: Array(12).fill({}), // 12 repos
      });

      const result = algorithm.calculateScore(highGithubActivity);
      expect(result.breakdown.githubActivity).toBe(10);
    });

    it('should detect B2B focus from description', () => {
      const b2bCompany = createTestCompany({
        one_liner: 'B2B SaaS platform for enterprise',
        long_description: 'API-first business solution',
      });

      const result = algorithm.calculateScore(b2bCompany);
      expect(result.breakdown.b2bFocus).toBeGreaterThan(0);
    });

    it('should score hiring status correctly', () => {
      const hiringCompany = createTestCompany({ is_hiring: true });
      const nonHiringCompany = createTestCompany({ is_hiring: false });

      const hiringResult = algorithm.calculateScore(hiringCompany);
      const nonHiringResult = algorithm.calculateScore(nonHiringCompany);

      expect(hiringResult.breakdown.hiringStatus).toBe(8);
      expect(nonHiringResult.breakdown.hiringStatus).toBe(4);
    });

    it('should penalize boring company names', () => {
      const boringNameCompany = createTestCompany({ name: 'AI Corp' });
      const goodNameCompany = createTestCompany({ name: 'Spearfish' });

      const boringResult = algorithm.calculateScore(boringNameCompany);
      const goodResult = algorithm.calculateScore(goodNameCompany);

      expect(boringResult.breakdown.nameQuality).toBe(3);
      expect(goodResult.breakdown.nameQuality).toBe(8);
    });
  });

  describe('Confidence Calculation', () => {
    it('should have higher confidence with complete data', () => {
      const completeCompany: CompanyData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'TestCorp',
        batch: 'W22',
        industry: 'AI',
        one_liner: 'AI platform',
        long_description: 'Full description',
        launched_at: Math.floor(Date.now() / 1000) - (20 * 30 * 24 * 60 * 60),
        github_repos: [{}, {}],
        huggingface_models: [{}],
        is_hiring: true,
        ai_confidence_score: 0.95,
        status: 'Active',
        tags: ['AI'],
        regions: ['SF'],
        team_size: 10,
      };

      const incompleteCompany: CompanyData = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'TestCorp2',
        batch: 'W22',
        status: 'Active',
        tags: [],
        regions: [],
        github_repos: [],
        huggingface_models: [],
        is_hiring: false,
      };

      const completeResult = algorithm.calculateScore(completeCompany);
      const incompleteResult = algorithm.calculateScore(incompleteCompany);

      expect(completeResult.confidence).toBeGreaterThan(incompleteResult.confidence);
    });

    it('should have confidence between 0 and 1', () => {
      const company: CompanyData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'TestCorp',
        batch: 'W22',
        status: 'Active',
        tags: [],
        regions: [],
        github_repos: [],
        huggingface_models: [],
        is_hiring: false,
      };

      const result = algorithm.calculateScore(company);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Metadata Generation', () => {
    it('should track missing data points', () => {
      const incompleteCompany: CompanyData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'TestCorp',
        batch: 'W22',
        status: 'Active',
        tags: [],
        regions: [],
        github_repos: [],
        huggingface_models: [],
        is_hiring: false,
      };

      const result = algorithm.calculateScore(incompleteCompany);
      
      expect(result.metadata.missingDataPoints).toContain('launched_at');
      expect(result.metadata.missingDataPoints).toContain('github_repos');
      expect(result.metadata.missingDataPoints).toContain('huggingface_models');
    });

    it('should provide approximation notes', () => {
      const incompleteCompany: CompanyData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'TestCorp',
        batch: 'W22',
        status: 'Active',
        tags: [],
        regions: [],
        github_repos: [],
        huggingface_models: [],
        is_hiring: false,
      };

      const result = algorithm.calculateScore(incompleteCompany);
      
      expect(result.metadata.approximations).toContain('Used default middle score for company age');
      expect(result.metadata.approximations).toContain('Used minimal GitHub activity score');
    });
  });
});

describe('Convenience Functions', () => {
  const mockCompany: CompanyData = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'TestCorp',
    batch: 'W22',
    status: 'Active',
    tags: [],
    regions: [],
    github_repos: [],
    huggingface_models: [],
    is_hiring: false,
  };

  describe('calculateSpearfishScore', () => {
    it('should calculate score for a single company', () => {
      const result = calculateSpearfishScore(mockCompany);
      
      expect(result).toHaveProperty('totalScore');
      expect(result).toHaveProperty('normalizedScore');
      expect(result.totalScore).toBeGreaterThanOrEqual(0);
      expect(result.totalScore).toBeLessThanOrEqual(10);
    });

    it('should accept custom weights', () => {
      const customWeights: ScoringWeights = {
        targetBatch: 0.5,
        companyAge: 0.1,
        fundingStage: 0.1,
        githubActivity: 0.1,
        b2bFocus: 0.1,
        huggingfaceActivity: 0.05,
        conferencePresence: 0.02,
        nameQuality: 0.02,
        hiringStatus: 0.01,
      };

      const result = calculateSpearfishScore(mockCompany, customWeights);
      expect(result.weights).toEqual(customWeights);
    });
  });

  describe('batchCalculateSpearfishScores', () => {
    it('should calculate scores for multiple companies', async () => {
      const companies = [
        { ...mockCompany, id: '123e4567-e89b-12d3-a456-426614174000' },
        { ...mockCompany, id: '123e4567-e89b-12d3-a456-426614174001', batch: 'S22' },
        { ...mockCompany, id: '123e4567-e89b-12d3-a456-426614174002', batch: 'W23' },
      ];

      const results = await batchCalculateSpearfishScores(companies);
      
      expect(results).toHaveLength(3);
      expect(results[0].totalScore).toBeGreaterThanOrEqual(0);
      expect(results[1].totalScore).toBeGreaterThanOrEqual(0);
      expect(results[2].totalScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty array', async () => {
      const results = await batchCalculateSpearfishScores([]);
      expect(results).toHaveLength(0);
    });
  });
});

describe('Edge Cases and Error Handling', () => {
  let algorithm: SpearfishScoringAlgorithm;

  beforeEach(() => {
    algorithm = new SpearfishScoringAlgorithm();
  });

  it('should handle missing optional fields gracefully', () => {
    const minimalCompany: CompanyData = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'TestCorp',
      batch: 'W22',
      status: 'Active',
      tags: [],
      regions: [],
      github_repos: [],
      huggingface_models: [],
      is_hiring: false,
    };

    expect(() => {
      algorithm.calculateScore(minimalCompany);
    }).not.toThrow();
  });

  it('should handle extreme values', () => {
    const extremeCompany: CompanyData = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'TestCorp',
      batch: 'W22',
      status: 'Active',
      tags: [],
      regions: [],
      github_repos: Array(1000).fill({}), // Extreme number of repos
      huggingface_models: Array(100).fill({}), // Extreme number of models
      is_hiring: true,
      launched_at: 1, // Very old timestamp
      team_size: 10000, // Very large team
    };

    const result = algorithm.calculateScore(extremeCompany);
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.totalScore).toBeLessThanOrEqual(10);
  });

  it('should handle invalid batch names', () => {
    const invalidBatchCompany: CompanyData = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'TestCorp',
      batch: 'InvalidBatch',
      status: 'Active',
      tags: [],
      regions: [],
      github_repos: [],
      huggingface_models: [],
      is_hiring: false,
    };

    const result = algorithm.calculateScore(invalidBatchCompany);
    expect(result.breakdown.targetBatch).toBe(0);
  });
});