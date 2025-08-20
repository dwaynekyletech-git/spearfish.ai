/**
 * Y Combinator Database Access Layer
 * 
 * Comprehensive TypeScript interface for managing YC company data in Supabase
 * with support for AI classification, sync management, and advanced querying.
 */

import { createClient } from '@supabase/supabase-js';
import { CompanyData } from './spearfish-scoring-service';

// =============================================================================
// Type Definitions
// =============================================================================

export interface DatabaseCompany {
  id: string;
  yc_api_id: number | null;
  yc_id: string | null;
  name: string;
  slug: string | null;
  former_names: string[];
  website_url: string | null;
  all_locations: string | null;
  one_liner: string | null;
  long_description: string | null;
  batch: string | null;
  stage: string | null;
  status: 'Active' | 'Acquired' | 'Public' | 'Inactive';
  industry: string | null;
  subindustry: string | null;
  industries: string[];
  tags: string[];
  tags_highlighted: string[];
  regions: string[];
  team_size: number | null;
  launched_at: number | null;
  small_logo_thumb_url: string | null;
  is_hiring: boolean;
  nonprofit: boolean;
  top_company: boolean;
  app_video_public: boolean;
  demo_day_video_public: boolean;
  yc_url: string | null;
  yc_api_url: string | null;
  is_ai_related: boolean;
  ai_confidence_score: number | null;
  ai_classification_date: string | null;
  spearfish_score: number | null;
  github_repos: any[];
  huggingface_models: any[];
  last_sync_date: string;
  sync_status: 'pending' | 'synced' | 'error' | 'manual';
  created_at: string;
  updated_at: string;
}

export interface SyncLog {
  id: string;
  sync_type: 'full' | 'incremental' | 'manual';
  batch_name: string | null;
  companies_processed: number;
  companies_updated: number;
  companies_created: number;
  companies_failed: number;
  ai_classifications: number;
  start_time: string;
  end_time: string | null;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  error_message: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface SyncStatistics {
  total_companies: number;
  synced_companies: number;
  pending_companies: number;
  error_companies: number;
  ai_companies: number;
  last_sync_date: string | null;
  avg_ai_confidence: number | null;
}

export interface CompanySearchOptions {
  searchTerm?: string;
  batches?: string[];
  industries?: string[];
  aiOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface CompanySearchResult extends Omit<DatabaseCompany, 'tags' | 'regions'> {
  tags: string[];
  regions: string[];
  similarity_score?: number;
}

// =============================================================================
// YC Database Service Class
// =============================================================================

export class YCDatabaseService {
  private supabase;
  private adminSupabase;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }

    // Regular client for user operations
    this.supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Admin client for bypass RLS operations (YC data sync, etc.)
    if (supabaseServiceKey) {
      this.adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    } else {
      console.warn('Service role key not available - some operations may fail due to RLS');
      this.adminSupabase = this.supabase;
    }
  }

  // =============================================================================
  // Company CRUD Operations
  // =============================================================================

  /**
   * Upsert a company from YC API data using direct database operations
   */
  async upsertCompany(company: CompanyData | any): Promise<string> {
    try {
      // Prepare company data for database
      const companyData = {
        yc_api_id: company.id,
        name: company.name,
        slug: company.slug,
        former_names: company.former_names || [],
        website_url: company.website || null,
        all_locations: company.all_locations || null,
        one_liner: company.one_liner || null,
        long_description: company.long_description || null,
        batch: company.batch,
        stage: company.stage || null,
        status: company.status,
        industry: company.industry || null,
        subindustry: company.subindustry || null,
        industries: company.industries || [],
        tags: company.tags || [],
        tags_highlighted: company.tags_highlighted || [],
        regions: company.regions || [],
        team_size: company.team_size || null,
        launched_at: company.launched_at || null,
        small_logo_thumb_url: company.small_logo_thumb_url || null,
        is_hiring: company.isHiring || false,
        nonprofit: company.nonprofit || false,
        top_company: company.top_company || false,
        app_video_public: company.app_video_public || false,
        demo_day_video_public: company.demo_day_video_public || false,
        yc_url: company.url || null,
        yc_api_url: company.api || null,
        is_ai_related: 'isAIRelated' in company ? company.isAIRelated : false,
        ai_confidence_score: 'aiConfidence' in company ? company.aiConfidence : null,
        ai_classification_date: 'isAIRelated' in company ? new Date().toISOString() : null,
        sync_status: 'synced',
        last_sync_date: new Date().toISOString()
      };

      // Use upsert with conflict resolution on yc_api_id
      const { data, error } = await this.adminSupabase
        .from('companies')
        .upsert([companyData], {
          onConflict: 'yc_api_id',
          ignoreDuplicates: false
        })
        .select('id')
        .single();

      if (error) {
        throw new Error(`Failed to upsert company: ${error.message}`);
      }

      return data.id as string;
    } catch (error) {
      console.error('Error upserting company:', error);
      throw error;
    }
  }

  /**
   * Bulk upsert multiple companies
   */
  async upsertCompanies(companies: (CompanyData | any)[]): Promise<{
    successful: string[];
    failed: { company: any; error: string }[];
  }> {
    const results = {
      successful: [] as string[],
      failed: [] as { company: any; error: string }[]
    };

    for (const company of companies) {
      try {
        const id = await this.upsertCompany(company);
        results.successful.push(id);
      } catch (error) {
        results.failed.push({
          company,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Get companies by batch
   */
  async getCompaniesByBatch(
    batches: string[] = ['Winter 2022', 'Summer 2022', 'Winter 2023'],
    aiOnly: boolean = false,
    limit: number = 50,
    offset: number = 0
  ): Promise<CompanySearchResult[]> {
    try {
      const { data, error } = await this.adminSupabase.rpc('get_companies_by_batch', {
        p_batches: batches,
        p_ai_only: aiOnly,
        p_limit: limit,
        p_offset: offset
      });

      if (error) {
        throw new Error(`Failed to get companies by batch: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error getting companies by batch:', error);
      throw error;
    }
  }

  /**
   * Search companies with full-text search
   */
  async searchCompanies(options: CompanySearchOptions): Promise<CompanySearchResult[]> {
    try {
      const { data, error } = await this.adminSupabase.rpc('search_yc_companies', {
        p_search_term: options.searchTerm || null,
        p_batches: options.batches || null,
        p_industries: options.industries || null,
        p_ai_only: options.aiOnly || false,
        p_limit: options.limit || 20
      });

      if (error) {
        throw new Error(`Failed to search companies: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error searching companies:', error);
      throw error;
    }
  }

  /**
   * Get a specific company by ID
   */
  async getCompanyById(id: string): Promise<DatabaseCompany | null> {
    try {
      const { data, error } = await this.supabase
        .from('companies')
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found error
        throw new Error(`Failed to get company: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error getting company by ID:', error);
      throw error;
    }
  }

  /**
   * Get company by YC API ID
   */
  async getCompanyByYCApiId(ycApiId: number): Promise<DatabaseCompany | null> {
    try {
      const { data, error } = await this.supabase
        .from('companies')
        .select('*')
        .eq('yc_api_id', ycApiId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new Error(`Failed to get company by YC API ID: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error getting company by YC API ID:', error);
      throw error;
    }
  }

  // =============================================================================
  // AI Classification Management
  // =============================================================================

  /**
   * Update AI classification for a company
   */
  async updateAIClassification(
    companyId: string,
    isAIRelated: boolean,
    confidenceScore?: number
  ): Promise<boolean> {
    try {
      const { data, error } = await this.adminSupabase.rpc('update_ai_classification', {
        p_company_id: companyId,
        p_is_ai_related: isAIRelated,
        p_ai_confidence_score: confidenceScore || null
      });

      if (error) {
        throw new Error(`Failed to update AI classification: ${error.message}`);
      }

      return data as boolean;
    } catch (error) {
      console.error('Error updating AI classification:', error);
      throw error;
    }
  }

  /**
   * Get companies that need AI classification
   */
  async getCompaniesNeedingAIClassification(limit: number = 100): Promise<DatabaseCompany[]> {
    try {
      const { data, error } = await this.adminSupabase
        .from('companies')
        .select('*')
        .is('ai_classification_date', null)
        .eq('sync_status', 'synced')
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to get companies needing AI classification: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error getting companies needing AI classification:', error);
      throw error;
    }
  }

  // =============================================================================
  // Sync Management
  // =============================================================================

  /**
   * Create a new sync log entry
   */
  async createSyncLog(
    syncType: 'full' | 'incremental' | 'manual',
    batchName?: string,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    try {
      const { data, error } = await this.adminSupabase.rpc('create_sync_log', {
        p_sync_type: syncType,
        p_batch_name: batchName || null,
        p_metadata: JSON.stringify(metadata)
      });

      if (error) {
        throw new Error(`Failed to create sync log: ${error.message}`);
      }

      return data as string;
    } catch (error) {
      console.error('Error creating sync log:', error);
      throw error;
    }
  }

  /**
   * Update sync log with progress
   */
  async updateSyncLog(
    logId: string,
    updates: {
      companiesProcessed?: number;
      companiesUpdated?: number;
      companiesCreated?: number;
      companiesFailed?: number;
      aiClassifications?: number;
      status?: 'running' | 'completed' | 'failed' | 'cancelled';
      errorMessage?: string;
    }
  ): Promise<boolean> {
    try {
      const { data, error } = await this.adminSupabase.rpc('update_sync_log', {
        p_log_id: logId,
        p_companies_processed: updates.companiesProcessed || null,
        p_companies_updated: updates.companiesUpdated || null,
        p_companies_created: updates.companiesCreated || null,
        p_companies_failed: updates.companiesFailed || null,
        p_ai_classifications: updates.aiClassifications || null,
        p_status: updates.status || null,
        p_error_message: updates.errorMessage || null
      });

      if (error) {
        throw new Error(`Failed to update sync log: ${error.message}`);
      }

      return data as boolean;
    } catch (error) {
      console.error('Error updating sync log:', error);
      throw error;
    }
  }

  /**
   * Get sync statistics
   */
  async getSyncStatistics(): Promise<SyncStatistics> {
    try {
      const { data, error } = await this.adminSupabase.rpc('get_sync_statistics');

      if (error) {
        throw new Error(`Failed to get sync statistics: ${error.message}`);
      }

      return data[0] as SyncStatistics;
    } catch (error) {
      console.error('Error getting sync statistics:', error);
      throw error;
    }
  }

  /**
   * Get recent sync logs
   */
  async getRecentSyncLogs(limit: number = 10): Promise<SyncLog[]> {
    try {
      const { data, error } = await this.supabase
        .from('yc_sync_logs')
        .select('*')
        .order('start_time', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to get sync logs: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error getting sync logs:', error);
      throw error;
    }
  }

  // =============================================================================
  // Analytics and Reporting
  // =============================================================================

  /**
   * Get company statistics by batch
   */
  async getCompanyStatsByBatch(): Promise<Record<string, any>[]> {
    try {
      const { data, error } = await this.supabase
        .from('companies')
        .select('batch, is_ai_related, status, industry')
        .eq('sync_status', 'synced');

      if (error) {
        throw new Error(`Failed to get company stats: ${error.message}`);
      }

      // Group and aggregate data
      const stats = (data || []).reduce((acc, company) => {
        const batch = company.batch || 'Unknown';
        if (!acc[batch]) {
          acc[batch] = {
            total: 0,
            ai_related: 0,
            active: 0,
            industries: {}
          };
        }
        
        acc[batch].total++;
        if (company.is_ai_related) acc[batch].ai_related++;
        if (company.status === 'Active') acc[batch].active++;
        
        const industry = company.industry || 'Unknown';
        acc[batch].industries[industry] = (acc[batch].industries[industry] || 0) + 1;
        
        return acc;
      }, {} as Record<string, any>);

      return Object.entries(stats).map(([batch, data]) => ({
        batch,
        ...data
      }));
    } catch (error) {
      console.error('Error getting company stats by batch:', error);
      throw error;
    }
  }

  /**
   * Get top industries by AI company count
   */
  async getTopAIIndustries(limit: number = 10): Promise<{ industry: string; count: number }[]> {
    try {
      const { data, error } = await this.supabase
        .from('companies')
        .select('industry')
        .eq('is_ai_related', true)
        .eq('sync_status', 'synced')
        .not('industry', 'is', null);

      if (error) {
        throw new Error(`Failed to get top AI industries: ${error.message}`);
      }

      // Count by industry
      const industryCount = (data || []).reduce((acc, company) => {
        const industry = company.industry;
        acc[industry] = (acc[industry] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return Object.entries(industryCount)
        .map(([industry, count]) => ({ industry, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting top AI industries:', error);
      throw error;
    }
  }

  // =============================================================================
  // Data Clearing Operations
  // =============================================================================

  /**
   * Clear all companies and related data
   * WARNING: This will delete ALL companies, founders, funding data, etc.
   */
  async clearAllCompanies(): Promise<{
    companiesDeleted: number;
    foundersDeleted: number;
    fundingDeleted: number;
  }> {
    try {
      // Get counts before deletion for reporting
      const [companiesCount, foundersCount, fundingCount] = await Promise.all([
        this.adminSupabase.from('companies').select('*', { count: 'exact', head: true }),
        this.adminSupabase.from('founders').select('*', { count: 'exact', head: true }),
        this.adminSupabase.from('company_funding_summary').select('*', { count: 'exact', head: true })
      ]);

      const beforeCounts = {
        companies: companiesCount.count || 0,
        founders: foundersCount.count || 0,
        funding: fundingCount.count || 0
      };

      // Delete in proper order (child tables first)
      await this.adminSupabase.from('founders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await this.adminSupabase.from('company_funding_summary').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await this.adminSupabase.from('github_repositories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await this.adminSupabase.from('github_repository_metrics').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await this.adminSupabase.from('score_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await this.adminSupabase.from('research_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await this.adminSupabase.from('companies').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      return {
        companiesDeleted: beforeCounts.companies,
        foundersDeleted: beforeCounts.founders,
        fundingDeleted: beforeCounts.funding
      };
    } catch (error) {
      console.error('Error clearing all companies:', error);
      throw error;
    }
  }

  /**
   * Clear companies by specific batches
   */
  async clearCompaniesByBatches(batches: string[]): Promise<{
    companiesDeleted: number;
    foundersDeleted: number;
  }> {
    try {
      // Get company IDs for the specified batches
      const { data: companiesToDelete, error: selectError } = await this.adminSupabase
        .from('companies')
        .select('id')
        .in('batch', batches);

      if (selectError) {
        throw new Error(`Failed to get companies for deletion: ${selectError.message}`);
      }

      if (!companiesToDelete || companiesToDelete.length === 0) {
        return { companiesDeleted: 0, foundersDeleted: 0 };
      }

      const companyIds = companiesToDelete.map(c => c.id);

      // Count related records before deletion
      const [foundersCount] = await Promise.all([
        this.adminSupabase.from('founders').select('*', { count: 'exact', head: true }).in('company_id', companyIds)
      ]);

      // Delete related data first
      await this.adminSupabase.from('founders').delete().in('company_id', companyIds);
      await this.adminSupabase.from('company_funding_summary').delete().in('company_id', companyIds);
      await this.adminSupabase.from('github_repositories').delete().in('company_id', companyIds);
      await this.adminSupabase.from('score_history').delete().in('company_id', companyIds);
      await this.adminSupabase.from('research_sessions').delete().in('company_id', companyIds);

      // Finally delete companies
      const { error: deleteError } = await this.adminSupabase
        .from('companies')
        .delete()
        .in('batch', batches);

      if (deleteError) {
        throw new Error(`Failed to delete companies: ${deleteError.message}`);
      }

      return {
        companiesDeleted: companiesToDelete.length,
        foundersDeleted: foundersCount.count || 0
      };
    } catch (error) {
      console.error('Error clearing companies by batches:', error);
      throw error;
    }
  }

  /**
   * Clear companies by data source (e.g., 'apify', 'manual_json')
   */
  async clearCompaniesBySource(dataSource: string): Promise<{
    companiesDeleted: number;
    foundersDeleted: number;
  }> {
    try {
      // Get company IDs for the specified data source
      const { data: companiesToDelete, error: selectError } = await this.adminSupabase
        .from('companies')
        .select('id')
        .eq('sync_status', dataSource);

      if (selectError) {
        throw new Error(`Failed to get companies for deletion: ${selectError.message}`);
      }

      if (!companiesToDelete || companiesToDelete.length === 0) {
        return { companiesDeleted: 0, foundersDeleted: 0 };
      }

      const companyIds = companiesToDelete.map(c => c.id);

      // Count related records before deletion
      const [foundersCount] = await Promise.all([
        this.adminSupabase.from('founders').select('*', { count: 'exact', head: true }).in('company_id', companyIds)
      ]);

      // Delete related data first
      await this.adminSupabase.from('founders').delete().in('company_id', companyIds);
      await this.adminSupabase.from('company_funding_summary').delete().in('company_id', companyIds);
      await this.adminSupabase.from('github_repositories').delete().in('company_id', companyIds);
      await this.adminSupabase.from('score_history').delete().in('company_id', companyIds);
      await this.adminSupabase.from('research_sessions').delete().in('company_id', companyIds);

      // Finally delete companies
      const { error: deleteError } = await this.adminSupabase
        .from('companies')
        .delete()
        .eq('sync_status', dataSource);

      if (deleteError) {
        throw new Error(`Failed to delete companies: ${deleteError.message}`);
      }

      return {
        companiesDeleted: companiesToDelete.length,
        foundersDeleted: foundersCount.count || 0
      };
    } catch (error) {
      console.error('Error clearing companies by source:', error);
      throw error;
    }
  }

  // =============================================================================
  // Health and Maintenance
  // =============================================================================

  /**
   * Test database connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('companies')
        .select('count', { count: 'exact', head: true });

      return !error;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }

  /**
   * Get database health metrics
   */
  async getHealthMetrics(): Promise<{
    isConnected: boolean;
    totalCompanies: number;
    lastSyncDate: string | null;
    pendingSyncs: number;
    errorSyncs: number;
  }> {
    try {
      const [isConnected, stats] = await Promise.all([
        this.testConnection(),
        this.getSyncStatistics()
      ]);

      return {
        isConnected,
        totalCompanies: stats.total_companies,
        lastSyncDate: stats.last_sync_date,
        pendingSyncs: stats.pending_companies,
        errorSyncs: stats.error_companies
      };
    } catch (error) {
      console.error('Error getting health metrics:', error);
      return {
        isConnected: false,
        totalCompanies: 0,
        lastSyncDate: null,
        pendingSyncs: 0,
        errorSyncs: 0
      };
    }
  }
}

// =============================================================================
// Convenience Functions and Exports
// =============================================================================

/**
 * Create a new YC database service instance
 */
export function createYCDatabaseService(): YCDatabaseService {
  return new YCDatabaseService();
}

/**
 * Convert YC API company to database format
 */
export function convertYCCompanyToDatabase(company: CompanyData | any): Partial<DatabaseCompany> {
  return {
    yc_api_id: company.id,
    name: company.name,
    slug: company.slug,
    former_names: company.former_names || [],
    website_url: company.website,
    all_locations: company.all_locations,
    one_liner: company.one_liner,
    long_description: company.long_description,
    batch: company.batch,
    stage: company.stage,
    status: company.status,
    industry: company.industry,
    subindustry: company.subindustry,
    industries: company.industries || [],
    tags: company.tags || [],
    tags_highlighted: company.tags_highlighted || [],
    regions: company.regions || [],
    team_size: company.team_size,
    launched_at: company.launched_at,
    small_logo_thumb_url: company.small_logo_thumb_url,
    is_hiring: company.isHiring || false,
    nonprofit: company.nonprofit || false,
    top_company: company.top_company || false,
    app_video_public: company.app_video_public || false,
    demo_day_video_public: company.demo_day_video_public || false,
    yc_url: company.url,
    yc_api_url: company.api,
    sync_status: 'synced'
  };
}

// Export default instance
export const ycDatabase = createYCDatabaseService();