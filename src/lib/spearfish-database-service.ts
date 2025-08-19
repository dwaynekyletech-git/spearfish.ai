/**
 * Spearfish Database Service
 * 
 * Database integration layer for storing and retrieving spearfish scores
 * with historical tracking and batch operations.
 */

import { createServerClient, createServiceClient } from './supabase-server';
import { createClerkSupabaseClient } from './supabase-client';
import { CompanyData, ScoringResult, spearfishScoringService } from './spearfish-scoring-service';
import { z } from 'zod';

// =============================================================================
// Database Schema Types
// =============================================================================

export const ScoreHistorySchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  spearfish_score: z.number().min(0).max(10),
  normalized_score: z.number().min(0).max(100),
  score_breakdown: z.record(z.number()),
  algorithm_version: z.string(),
  confidence: z.number().min(0).max(1),
  metadata: z.object({
    missingDataPoints: z.array(z.string()),
    approximations: z.array(z.string()),
    warnings: z.array(z.string()),
  }),
  calculated_at: z.date(),
  created_at: z.date(),
});

export const CompanyScoreUpdateSchema = z.object({
  company_id: z.string().uuid(),
  spearfish_score: z.number().min(0).max(10),
  score_metadata: z.object({
    normalized_score: z.number().min(0).max(100),
    breakdown: z.record(z.number()),
    algorithm_version: z.string(),
    confidence: z.number().min(0).max(1),
    calculated_at: z.date(),
  }),
});

export const BatchScoreUpdateSchema = z.object({
  updates: z.array(CompanyScoreUpdateSchema),
  batch_id: z.string().uuid(),
  total_processed: z.number().min(0),
  successful_updates: z.number().min(0),
  failed_updates: z.number().min(0),
  processing_time_ms: z.number().min(0),
});

export type ScoreHistory = z.infer<typeof ScoreHistorySchema>;
export type CompanyScoreUpdate = z.infer<typeof CompanyScoreUpdateSchema>;
export type BatchScoreUpdate = z.infer<typeof BatchScoreUpdateSchema>;

// =============================================================================
// Database Service
// =============================================================================

export class SpearfishDatabaseService {
  private supabase: Promise<any> | any;
  private isServer: boolean;
  private useServiceRole: boolean;

  constructor(useServerClient: boolean = false, useServiceRole: boolean = false) {
    this.isServer = useServerClient;
    this.useServiceRole = useServiceRole;
    
    if (useServiceRole) {
      this.supabase = createServiceClient();
    } else if (useServerClient) {
      this.supabase = createServerClient();
    } else {
      this.supabase = createClerkSupabaseClient();
    }
  }

  private async getSupabase() {
    if (this.useServiceRole) {
      return this.supabase;
    } else if (this.isServer) {
      return await this.supabase;
    }
    return this.supabase;
  }

  /**
   * Update spearfish score for a single company
   */
  async updateCompanyScore(companyId: string, scoringResult: ScoringResult): Promise<boolean> {
    try {
      const supabase = await this.getSupabase();
      
      // Update main companies table
      const { error: updateError } = await supabase
        .from('companies')
        .update({
          spearfish_score: scoringResult.totalScore,
          updated_at: new Date().toISOString(),
        })
        .eq('id', companyId);

      if (updateError) {
        console.error('Error updating company score:', updateError);
        return false;
      }

      // Insert into score history
      const { error: historyError } = await supabase
        .from('score_history')
        .insert({
          company_id: companyId,
          spearfish_score: scoringResult.totalScore,
          normalized_score: scoringResult.normalizedScore,
          score_breakdown: scoringResult.breakdown,
          algorithm_version: scoringResult.algorithmVersion,
          confidence: scoringResult.confidence,
          metadata: scoringResult.metadata,
          calculated_at: scoringResult.calculatedAt.toISOString(),
        });

      if (historyError) {
        console.error('Error inserting score history:', historyError);
        // Don't fail the whole operation if history fails
      }

      return true;
    } catch (error) {
      console.error('Unexpected error updating company score:', error);
      return false;
    }
  }

  /**
   * Batch update spearfish scores for multiple companies
   */
  async batchUpdateCompanyScores(
    companyData: CompanyData[],
    batchId?: string
  ): Promise<BatchScoreUpdate> {
    const startTime = Date.now();
    const updates: CompanyScoreUpdate[] = [];
    const batch_id = batchId || crypto.randomUUID();
    
    let successful_updates = 0;
    let failed_updates = 0;

    try {
      // Process companies in chunks to avoid overwhelming the database
      const chunkSize = 10;
      for (let i = 0; i < companyData.length; i += chunkSize) {
        const chunk = companyData.slice(i, i + chunkSize);
        
        await Promise.all(chunk.map(async (company) => {
          try {
            const scoringResult = spearfishScoringService.calculateScore(company);
            const success = await this.updateCompanyScore(company.id, scoringResult);
            
            if (success) {
              updates.push({
                company_id: company.id,
                spearfish_score: scoringResult.totalScore,
                score_metadata: {
                  normalized_score: scoringResult.normalizedScore,
                  breakdown: scoringResult.breakdown,
                  algorithm_version: scoringResult.algorithmVersion,
                  confidence: scoringResult.confidence,
                  calculated_at: scoringResult.calculatedAt,
                },
              });
              successful_updates++;
            } else {
              failed_updates++;
            }
          } catch (error) {
            console.error(`Error processing company ${company.name}:`, error);
            failed_updates++;
          }
        }));
      }

      // Log batch operation
      await this.logBatchOperation(batch_id, {
        total_processed: companyData.length,
        successful_updates,
        failed_updates,
        processing_time_ms: Date.now() - startTime,
      });

      return {
        updates,
        batch_id,
        total_processed: companyData.length,
        successful_updates,
        failed_updates,
        processing_time_ms: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Error in batch score update:', error);
      throw error;
    }
  }

  /**
   * Get companies with their current spearfish scores
   */
  async getCompaniesWithScores(
    options: {
      limit?: number;
      offset?: number;
      batches?: string[];
      aiOnly?: boolean;
      minScore?: number;
      orderBy?: 'score' | 'name' | 'batch' | 'updated_at';
      orderDirection?: 'asc' | 'desc';
    } = {}
  ): Promise<CompanyData[]> {
    try {
      const supabase = await this.getSupabase();
      let query = supabase
        .from('companies')
        .select(`
          id,
          yc_api_id,
          name,
          batch,
          industry,
          subindustry,
          one_liner,
          long_description,
          website_url,
          team_size,
          launched_at,
          status,
          tags,
          regions,
          is_hiring,
          small_logo_thumb_url,
          github_repos,
          huggingface_models,
          ai_confidence_score,
          spearfish_score,
          created_at,
          updated_at
        `);

      // Apply filters
      if (options.batches && options.batches.length > 0) {
        query = query.in('batch', options.batches);
      }

      if (options.aiOnly) {
        query = query.eq('is_ai_related', true);
      }

      if (options.minScore !== undefined) {
        query = query.gte('spearfish_score', options.minScore);
      }

      // Apply ordering
      const orderBy = options.orderBy || 'score';
      const orderDirection = options.orderDirection || 'desc';
      
      switch (orderBy) {
        case 'score':
          query = query.order('spearfish_score', { ascending: orderDirection === 'asc', nullsFirst: false });
          break;
        case 'name':
          query = query.order('name', { ascending: orderDirection === 'asc' });
          break;
        case 'batch':
          query = query.order('batch', { ascending: orderDirection === 'asc' });
          break;
        case 'updated_at':
          query = query.order('updated_at', { ascending: orderDirection === 'asc' });
          break;
      }

      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching companies with scores:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in getCompaniesWithScores:', error);
      throw error;
    }
  }

  /**
   * Get score history for a company
   */
  async getCompanyScoreHistory(
    companyId: string,
    options: {
      limit?: number;
      fromDate?: Date;
      toDate?: Date;
    } = {}
  ): Promise<ScoreHistory[]> {
    try {
      const supabase = await this.getSupabase();
      let query = supabase
        .from('score_history')
        .select('*')
        .eq('company_id', companyId)
        .order('calculated_at', { ascending: false });

      if (options.fromDate) {
        query = query.gte('calculated_at', options.fromDate.toISOString());
      }

      if (options.toDate) {
        query = query.lte('calculated_at', options.toDate.toISOString());
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching score history:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in getCompanyScoreHistory:', error);
      throw error;
    }
  }

  /**
   * Get companies that need score recalculation
   */
  async getCompaniesNeedingRecalculation(
    options: {
      olderThan?: Date;
      batchSize?: number;
      batches?: string[];
      forceAll?: boolean;
      algorithmVersion?: string;
    } = {}
  ): Promise<CompanyData[]> {
    try {
      const supabase = await this.getSupabase();
      console.log('🔍 Database service: Using server client:', this.isServer);
      let query = supabase
        .from('companies')
        .select(`
          id,
          yc_api_id,
          name,
          batch,
          industry,
          subindustry,
          one_liner,
          long_description,
          website_url,
          team_size,
          launched_at,
          status,
          tags,
          regions,
          is_hiring,
          github_repos,
          huggingface_models,
          ai_confidence_score,
          spearfish_score,
          updated_at
        `)
        .eq('sync_status', 'synced');
        
      console.log('🔍 Initial query created with sync_status = synced');

      // Force all companies if requested (for algorithm version updates)
      if (options.forceAll) {
        // No additional filters - process all synced companies
        console.log('📋 ForceAll mode: Processing all synced companies');
      } else if (options.algorithmVersion) {
        // Find companies that don't have the latest algorithm version
        // This requires checking the score_history table for the latest score
        const { data: companiesWithOldVersions, error: versionError } = await supabase.rpc(
          'get_companies_with_old_algorithm_version',
          { target_version: options.algorithmVersion }
        );
        
        if (!versionError && companiesWithOldVersions) {
          const companyIds = companiesWithOldVersions.map((c: any) => c.company_id);
          query = query.in('id', companyIds);
        } else {
          // Fallback: treat as forceAll if the RPC doesn't exist
          console.warn('RPC function not available, falling back to time-based filtering');
        }
      } else {
        // Find companies with old scores or no scores
        if (options.olderThan) {
          query = query.or(`spearfish_score.is.null,updated_at.lt.${options.olderThan.toISOString()}`);
        } else {
          query = query.is('spearfish_score', null);
        }
      }

      if (options.batches && options.batches.length > 0 && !options.forceAll) {
        query = query.in('batch', options.batches);
      }

      if (options.batchSize) {
        query = query.limit(options.batchSize);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching companies needing recalculation:', error);
        throw error;
      }

      console.log(`📊 Found ${(data || []).length} companies for recalculation (forceAll: ${options.forceAll})`);
      return data || [];
    } catch (error) {
      console.error('Error in getCompaniesNeedingRecalculation:', error);
      throw error;
    }
  }

  /**
   * Get scoring statistics
   */
  async getScoringStatistics(): Promise<{
    totalCompanies: number;
    scoredCompanies: number;
    averageScore: number;
    scoreDistribution: Record<string, number>;
    lastCalculated: Date | null;
  }> {
    try {
      const supabase = await this.getSupabase();
      const { data, error } = await supabase
        .from('companies')
        .select('spearfish_score, updated_at')
        .eq('sync_status', 'synced');

      if (error) {
        console.error('Error fetching scoring statistics:', error);
        throw error;
      }

      const totalCompanies = data.length;
      const scoredCompanies = data.filter((c: any) => c.spearfish_score !== null).length;
      const scores = data.filter((c: any) => c.spearfish_score !== null).map((c: any) => c.spearfish_score);
      const averageScore = scores.length > 0 ? scores.reduce((sum: number, score: number) => sum + score, 0) / scores.length : 0;
      
      // Score distribution in ranges
      const scoreDistribution = {
        '0-2': 0,
        '2-4': 0,
        '4-6': 0,
        '6-8': 0,
        '8-10': 0,
      };

      scores.forEach((score: number) => {
        if (score >= 0 && score < 2) scoreDistribution['0-2']++;
        else if (score >= 2 && score < 4) scoreDistribution['2-4']++;
        else if (score >= 4 && score < 6) scoreDistribution['4-6']++;
        else if (score >= 6 && score < 8) scoreDistribution['6-8']++;
        else if (score >= 8 && score <= 10) scoreDistribution['8-10']++;
      });

      const lastCalculated = data.length > 0 ? 
        new Date(Math.max(...data.map((c: any) => new Date(c.updated_at).getTime()))) : null;

      return {
        totalCompanies,
        scoredCompanies,
        averageScore: Math.round(averageScore * 100) / 100,
        scoreDistribution,
        lastCalculated,
      };
    } catch (error) {
      console.error('Error in getScoringStatistics:', error);
      throw error;
    }
  }

  /**
   * Log batch operation for monitoring
   */
  private async logBatchOperation(
    batchId: string,
    stats: {
      total_processed: number;
      successful_updates: number;
      failed_updates: number;
      processing_time_ms: number;
    }
  ): Promise<void> {
    try {
      const supabase = await this.getSupabase();
      await supabase
        .from('score_batch_logs')
        .insert({
          batch_id: batchId,
          total_processed: stats.total_processed,
          successful_updates: stats.successful_updates,
          failed_updates: stats.failed_updates,
          processing_time_ms: stats.processing_time_ms,
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Error logging batch operation:', error);
      // Don't throw - this is just for monitoring
    }
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Create a new spearfish database service instance
 */
export function createSpearfishDatabaseService(useServerClient: boolean = false, useServiceRole: boolean = false): SpearfishDatabaseService {
  return new SpearfishDatabaseService(useServerClient, useServiceRole);
}

/**
 * Quick function to update a single company score
 */
export async function updateCompanySpearfishScore(
  companyId: string,
  companyData: CompanyData,
  useServerClient: boolean = false
): Promise<boolean> {
  const service = createSpearfishDatabaseService(useServerClient);
  const scoringResult = spearfishScoringService.calculateScore(companyData);
  return await service.updateCompanyScore(companyId, scoringResult);
}

/**
 * Quick function to get top-scoring companies
 */
export async function getTopScoringCompanies(
  limit: number = 20,
  useServerClient: boolean = false
): Promise<CompanyData[]> {
  const service = createSpearfishDatabaseService(useServerClient);
  return await service.getCompaniesWithScores({
    limit,
    orderBy: 'score',
    orderDirection: 'desc',
    aiOnly: true,
  });
}

// Export default instance
export const spearfishDatabaseService = createSpearfishDatabaseService();