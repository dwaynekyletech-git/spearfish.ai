// @ts-nocheck
/**
 * Integrated AI Classification + Database Service
 * 
 * Combines AI classification with database storage for seamless
 * YC company processing and management.
 */

import { aiClassificationService, AIClassificationResult, BatchClassificationResult } from './ai-classification-service';
import { ycDatabase } from './yc-database';
import { getTargetAICompanies, getTargetBatchCompanies } from './yc-api';
import { YCCompany, ValidatedCompany } from './company-data-service';

// =============================================================================
// Type Definitions
// =============================================================================

export interface IntegratedProcessingResult {
  syncLogId: string;
  companiesProcessed: number;
  companiesClassified: number;
  companiesStoredInDB: number;
  aiRelatedFound: number;
  errors: Array<{
    company: string;
    stage: 'classification' | 'database';
    error: string;
  }>;
  classificationStats: {
    averageConfidence: number;
    averageProcessingTime: number;
    highConfidenceCount: number;
  };
  processingTime: number;
}

export interface ClassifyAndStoreOptions {
  batches?: string[];
  limit?: number;
  forceReclassify?: boolean;
  strictMode?: boolean;
  includeExistingData?: boolean;
}

// =============================================================================
// Integrated AI Service Class
// =============================================================================

export class IntegratedAIService {
  private aiService = aiClassificationService;
  private database = ycDatabase;

  /**
   * Complete workflow: Fetch YC companies, classify with AI, store in database
   */
  async processYCCompanies(options: ClassifyAndStoreOptions = {}): Promise<IntegratedProcessingResult> {
    const startTime = Date.now();
    
    // Create sync log
    const syncLogId = await this.database.createSyncLog(
      'manual',
      options.batches?.join(',') || 'all-target-batches',
      {
        ai_classification: true,
        options,
        timestamp: new Date().toISOString()
      }
    );

    const result: IntegratedProcessingResult = {
      syncLogId,
      companiesProcessed: 0,
      companiesClassified: 0,
      companiesStoredInDB: 0,
      aiRelatedFound: 0,
      errors: [],
      classificationStats: {
        averageConfidence: 0,
        averageProcessingTime: 0,
        highConfidenceCount: 0
      },
      processingTime: 0
    };

    try {
      console.log('🚀 Starting integrated YC company processing...');
      
      // Step 1: Fetch companies from YC API
      console.log('📥 Fetching companies from YC API...');
      
      const companies = options.batches 
        ? await getTargetBatchCompanies()
        : await getTargetAICompanies();

      let targetCompanies = companies;
      if (options.limit) {
        targetCompanies = companies.slice(0, options.limit);
      }

      result.companiesProcessed = targetCompanies.length;
      console.log(`📊 Processing ${result.companiesProcessed} companies`);

      // Update sync log
      await this.database.updateSyncLog(syncLogId, {
        companiesProcessed: result.companiesProcessed,
        status: 'running'
      });

      // Step 2: Filter companies that need classification
      let companiesToClassify = targetCompanies;
      
      if (!options.forceReclassify) {
        // Only classify companies not already classified
        companiesToClassify = await this.filterUnclassifiedCompanies(targetCompanies);
        console.log(`🔍 ${companiesToClassify.length} companies need AI classification`);
      }

      // Step 3: AI Classification
      if (companiesToClassify.length > 0) {
        console.log('🤖 Starting AI classification...');
        
        const classificationResults = await this.aiService.classifyCompaniesBatch(
          companiesToClassify,
          { 
            strictMode: options.strictMode,
            includeReasoning: true 
          }
        );

        result.companiesClassified = classificationResults.length;
        
        // Calculate classification stats
        const stats = this.aiService.calculateClassificationStats(classificationResults);
        result.classificationStats = {
          averageConfidence: stats.averageConfidence,
          averageProcessingTime: stats.averageProcessingTime,
          highConfidenceCount: stats.highConfidence
        };

        console.log(`✅ AI classification complete: ${stats.aiRelated} AI-related companies found`);

        // Step 4: Store in database
        console.log('💾 Storing companies in database...');
        
        const storageResults = await this.storeClassificationResults(
          classificationResults,
          targetCompanies
        );

        result.companiesStoredInDB = storageResults.successful;
        result.aiRelatedFound = storageResults.aiRelatedCount;
        result.errors.push(...storageResults.errors);

        console.log(`📁 Database storage complete: ${result.companiesStoredInDB} companies stored`);
      }

      // Step 5: Update sync log with final results
      await this.database.updateSyncLog(syncLogId, {
        companiesUpdated: result.companiesStoredInDB,
        aiClassifications: result.companiesClassified,
        status: result.errors.length === 0 ? 'completed' : 'completed'
      });

      result.processingTime = Date.now() - startTime;
      
      console.log('🎉 Integrated processing complete!');
      console.log(`📈 Results: ${result.aiRelatedFound} AI companies found in ${result.processingTime}ms`);

      return result;

    } catch (error) {
      console.error('❌ Error in integrated processing:', error);
      
      await this.database.updateSyncLog(syncLogId, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  /**
   * Classify companies that are already in the database
   */
  async classifyExistingCompanies(limit: number = 50): Promise<IntegratedProcessingResult> {
    const startTime = Date.now();
    
    // Get companies that need classification
    const companies = await this.database.getCompaniesNeedingAIClassification(limit);
    
    if (companies.length === 0) {
      return {
        syncLogId: '',
        companiesProcessed: 0,
        companiesClassified: 0,
        companiesStoredInDB: 0,
        aiRelatedFound: 0,
        errors: [],
        classificationStats: {
          averageConfidence: 0,
          averageProcessingTime: 0,
          highConfidenceCount: 0
        },
        processingTime: Date.now() - startTime
      };
    }

    console.log(`🔄 Classifying ${companies.length} existing companies...`);

    // Create sync log
    const syncLogId = await this.database.createSyncLog(
      'manual',
      'existing-companies',
      { 
        classification_only: true,
        companies_count: companies.length
      }
    );

    // Convert database companies to YC format for classification
    const ycCompanies = companies.map(company => this.convertDatabaseToYCCompany(company));

    // Classify
    const classificationResults = await this.aiService.classifyCompaniesBatch(ycCompanies);
    
    // Update database with classifications
    let aiRelatedCount = 0;
    const errors: Array<{ company: string; stage: 'classification' | 'database'; error: string }> = [];

    for (const result of classificationResults) {
      if (result.error) {
        errors.push({
          company: result.companyName,
          stage: 'classification',
          error: result.error
        });
        continue;
      }

      try {
        // Find original company ID
        const originalCompany = companies.find(c => c.name === result.companyName);
        if (originalCompany) {
          await this.database.updateAIClassification(
            originalCompany.id,
            result.result.isAIRelated,
            result.result.confidence
          );

          if (result.result.isAIRelated) {
            aiRelatedCount++;
          }
        }
      } catch (error) {
        errors.push({
          company: result.companyName,
          stage: 'database',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Calculate stats
    const stats = this.aiService.calculateClassificationStats(classificationResults);

    // Update sync log
    await this.database.updateSyncLog(syncLogId, {
      companiesProcessed: companies.length,
      aiClassifications: classificationResults.length,
      companiesUpdated: classificationResults.length - errors.length,
      status: 'completed'
    });

    return {
      syncLogId,
      companiesProcessed: companies.length,
      companiesClassified: classificationResults.length,
      companiesStoredInDB: classificationResults.length - errors.length,
      aiRelatedFound: aiRelatedCount,
      errors,
      classificationStats: {
        averageConfidence: stats.averageConfidence,
        averageProcessingTime: stats.averageProcessingTime,
        highConfidenceCount: stats.highConfidence
      },
      processingTime: Date.now() - startTime
    };
  }

  /**
   * Get classification summary and statistics
   */
  async getClassificationSummary() {
    const stats = await this.database.getSyncStatistics();
    const recentLogs = await this.database.getRecentSyncLogs(5);
    
    return {
      overview: {
        totalCompanies: stats.total_companies,
        aiCompanies: stats.ai_companies,
        aiPercentage: stats.ai_companies > 0 ? 
          Math.round((stats.ai_companies / stats.total_companies) * 100) : 0,
        averageConfidence: stats.avg_ai_confidence,
        lastSync: stats.last_sync_date
      },
      recentActivity: recentLogs.map(log => ({
        id: log.id,
        type: log.sync_type,
        batch: log.batch_name,
        processed: log.companies_processed,
        aiClassifications: log.ai_classifications,
        status: log.status,
        date: log.start_time
      }))
    };
  }

  // =============================================================================
  // Private Helper Methods
  // =============================================================================

  private async filterUnclassifiedCompanies(companies: YCCompany[]): Promise<YCCompany[]> {
    const unclassified: YCCompany[] = [];
    
    for (const company of companies) {
      try {
        const existing = await this.database.getCompanyByYCApiId(company.id);
        
        if (!existing || !existing.ai_classification_date) {
          unclassified.push(company);
        }
      } catch (error) {
        // If we can't find it, assume it needs classification
        unclassified.push(company);
      }
    }
    
    return unclassified;
  }

  private async storeClassificationResults(
    classificationResults: BatchClassificationResult[],
    originalCompanies: YCCompany[]
  ): Promise<{
    successful: number;
    failed: number;
    aiRelatedCount: number;
    errors: Array<{ company: string; stage: 'database'; error: string }>;
  }> {
    let successful = 0;
    let failed = 0;
    let aiRelatedCount = 0;
    const errors: Array<{ company: string; stage: 'database'; error: string }> = [];

    for (const result of classificationResults) {
      if (result.error) {
        failed++;
        continue;
      }

      try {
        // Find the original company data
        const originalCompany = originalCompanies.find(c => c.id === result.companyId);
        if (!originalCompany) {
          failed++;
          continue;
        }

        // Store company with AI classification
        const enhancedCompany = {
          ...originalCompany,
          isAIRelated: result.result.isAIRelated,
          aiConfidence: result.result.confidence
        };

        await this.database.upsertCompany(enhancedCompany);
        successful++;

        if (result.result.isAIRelated) {
          aiRelatedCount++;
        }

      } catch (error) {
        failed++;
        errors.push({
          company: result.companyName,
          stage: 'database',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return { successful, failed, aiRelatedCount, errors };
  }

  private convertDatabaseToYCCompany(dbCompany: any): YCCompany {
    return {
      id: dbCompany.yc_api_id || 0,
      name: dbCompany.name,
      slug: dbCompany.slug || '',
      website: dbCompany.website_url || '',
      one_liner: dbCompany.one_liner || '',
      long_description: dbCompany.long_description || '',
      batch: dbCompany.batch || '',
      status: dbCompany.status || 'Active',
      industry: dbCompany.industry || '',
      subindustry: dbCompany.subindustry || '',
      tags: Array.isArray(dbCompany.tags) ? dbCompany.tags : [],
      regions: Array.isArray(dbCompany.regions) ? dbCompany.regions : [],
      team_size: dbCompany.team_size || 0,
      launched_at: dbCompany.launched_at || 0,
      small_logo_thumb_url: dbCompany.small_logo_thumb_url,
      isHiring: dbCompany.is_hiring || false
    };
  }
}

// =============================================================================
// Convenience Functions and Exports
// =============================================================================

/**
 * Create a new integrated AI service instance
 */
export function createIntegratedAIService(): IntegratedAIService {
  return new IntegratedAIService();
}

/**
 * Quick function to process YC companies with AI classification
 */
export async function processYCCompaniesWithAI(
  options: ClassifyAndStoreOptions = {}
): Promise<IntegratedProcessingResult> {
  const service = createIntegratedAIService();
  return service.processYCCompanies(options);
}

/**
 * Quick function to classify existing companies in database
 */
export async function classifyExistingCompaniesInDB(
  limit: number = 50
): Promise<IntegratedProcessingResult> {
  const service = createIntegratedAIService();
  return service.classifyExistingCompanies(limit);
}

// Export default instance
export const integratedAIService = createIntegratedAIService();