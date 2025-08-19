/**
 * Data Sync Service
 * 
 * Maintains consistency between database tables and ensures
 * the companies table has up-to-date GitHub and HF data
 * for website display.
 */

import { createServiceClient } from './supabase-server';
import { logInfo, logDebug, logWarn, logError } from './logger';

// =============================================================================
// Type Definitions
// =============================================================================

export interface SyncResult {
  success: boolean;
  companiesProcessed: number;
  companiesUpdated: number;
  errors: Array<{
    companyId: string;
    companyName: string;
    error: string;
  }>;
  processingTime: number;
}

export interface GitHubRepoData {
  full_name: string;
  html_url: string;
  description: string | null;
  stars_count: number;
  forks_count: number;
  language: string | null;
  is_primary: boolean;
  last_synced: string;
}

export interface HuggingFaceModelData {
  model_id: string;
  model_name: string;
  author: string;
  task: string | null;
  downloads: number;
  likes: number;
  model_card_url: string;
  is_primary: boolean;
  last_synced: string;
}

// =============================================================================
// Data Sync Service Class
// =============================================================================

export class DataSyncService {
  private supabase = createServiceClient();

  /**
   * CRITICAL FIX: Sync existing GitHub associations to companies table
   * This will populate the empty github_repos JSONB fields
   */
  async syncGitHubDataToCompanies(): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: false,
      companiesProcessed: 0,
      companiesUpdated: 0,
      errors: [],
      processingTime: 0
    };

    try {
      logInfo('🔄 Starting GitHub data sync to companies table...');

      // Get all companies that have GitHub associations
      const { data: associations, error: assocError } = await this.supabase
        .from('company_github_repositories')
        .select(`
          company_id,
          companies!inner(id, name),
          github_repositories!inner(
            full_name,
            html_url,
            description,
            stars_count,
            forks_count,
            language,
            last_synced_at
          ),
          is_primary,
          confidence_score
        `)
        .order('company_id')
        .order('is_primary', { ascending: false })
        .order('confidence_score', { ascending: false });

      if (assocError) {
        throw new Error(`Failed to fetch associations: ${assocError.message}`);
      }

      if (!associations || associations.length === 0) {
        logWarn('No GitHub associations found to sync');
        result.success = true;
        return result;
      }

      // Group associations by company
      const companiesByRepo = new Map<string, {
        company: any;
        repos: GitHubRepoData[];
      }>();

      associations.forEach(assoc => {
        const companyId = assoc.company_id;
        
        if (!companiesByRepo.has(companyId)) {
          companiesByRepo.set(companyId, {
            company: assoc.companies,
            repos: []
          });
        }

        companiesByRepo.get(companyId)!.repos.push({
          full_name: assoc.github_repositories.full_name,
          html_url: assoc.github_repositories.html_url,
          description: assoc.github_repositories.description,
          stars_count: assoc.github_repositories.stars_count,
          forks_count: assoc.github_repositories.forks_count,
          language: assoc.github_repositories.language,
          is_primary: assoc.is_primary,
          last_synced: assoc.github_repositories.last_synced_at
        });
      });

      logInfo(`📊 Found ${companiesByRepo.size} companies with GitHub repos`);
      result.companiesProcessed = companiesByRepo.size;

      // Update each company's github_repos field
      for (const [companyId, data] of companiesByRepo) {
        try {
          const { error: updateError } = await this.supabase
            .from('companies')
            .update({
              github_repos: data.repos,
              updated_at: new Date().toISOString()
            })
            .eq('id', companyId);

          if (updateError) {
            result.errors.push({
              companyId,
              companyName: data.company.name,
              error: updateError.message
            });
            logError(`Failed to update company ${data.company.name}`, { error: updateError.message });
          } else {
            result.companiesUpdated++;
            logDebug(`✅ Updated ${data.company.name} with ${data.repos.length} repos`);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push({
            companyId,
            companyName: data.company.name,
            error: errorMsg
          });
          logError(`Error updating company ${data.company.name}`, { error: errorMsg });
        }
      }

      result.success = result.errors.length === 0;
      result.processingTime = Date.now() - startTime;

      logInfo(`🎉 GitHub sync complete!`, {
        companiesProcessed: result.companiesProcessed,
        companiesUpdated: result.companiesUpdated,
        errors: result.errors.length,
        processingTimeMs: result.processingTime
      });

      return result;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logError('❌ GitHub sync failed', { error: errorMsg });
      
      result.processingTime = Date.now() - startTime;
      result.errors.push({
        companyId: 'system',
        companyName: 'system',
        error: errorMsg
      });
      
      return result;
    }
  }

  /**
   * Sync existing HuggingFace associations to companies table
   * This will populate the huggingface_models JSONB fields
   */
  async syncHuggingFaceDataToCompanies(): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: false,
      companiesProcessed: 0,
      companiesUpdated: 0,
      errors: [],
      processingTime: 0
    };

    try {
      logInfo('🤗 Starting HuggingFace data sync to companies table...');

      // Get all companies that have HuggingFace associations
      const { data: associations, error: assocError } = await this.supabase
        .from('company_huggingface_models')
        .select(`
          company_id,
          companies!inner(id, name),
          huggingface_models!inner(
            model_id,
            model_name,
            author,
            task,
            downloads,
            likes,
            model_card_url,
            last_synced_at
          ),
          is_primary,
          confidence_score
        `)
        .order('company_id')
        .order('is_primary', { ascending: false })
        .order('confidence_score', { ascending: false });

      if (assocError) {
        throw new Error(`Failed to fetch HF associations: ${assocError.message}`);
      }

      if (!associations || associations.length === 0) {
        logWarn('No HuggingFace associations found to sync');
        result.success = true;
        return result;
      }

      // Group associations by company
      const companiesByModel = new Map<string, {
        company: any;
        models: HuggingFaceModelData[];
      }>();

      associations.forEach(assoc => {
        const companyId = assoc.company_id;
        
        if (!companiesByModel.has(companyId)) {
          companiesByModel.set(companyId, {
            company: assoc.companies,
            models: []
          });
        }

        companiesByModel.get(companyId)!.models.push({
          model_id: assoc.huggingface_models.model_id,
          model_name: assoc.huggingface_models.model_name,
          author: assoc.huggingface_models.author,
          task: assoc.huggingface_models.task,
          downloads: assoc.huggingface_models.downloads,
          likes: assoc.huggingface_models.likes,
          model_card_url: assoc.huggingface_models.model_card_url,
          is_primary: assoc.is_primary,
          last_synced: assoc.huggingface_models.last_synced_at
        });
      });

      logInfo(`📊 Found ${companiesByModel.size} companies with HuggingFace models`);
      result.companiesProcessed = companiesByModel.size;

      // Update each company's huggingface_models field
      for (const [companyId, data] of companiesByModel) {
        try {
          const { error: updateError } = await this.supabase
            .from('companies')
            .update({
              huggingface_models: data.models,
              updated_at: new Date().toISOString()
            })
            .eq('id', companyId);

          if (updateError) {
            result.errors.push({
              companyId,
              companyName: data.company.name,
              error: updateError.message
            });
            logError(`Failed to update company ${data.company.name}`, { error: updateError.message });
          } else {
            result.companiesUpdated++;
            logDebug(`✅ Updated ${data.company.name} with ${data.models.length} HF models`);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push({
            companyId,
            companyName: data.company.name,
            error: errorMsg
          });
          logError(`Error updating company ${data.company.name}`, { error: errorMsg });
        }
      }

      result.success = result.errors.length === 0;
      result.processingTime = Date.now() - startTime;

      logInfo(`🎉 HuggingFace sync complete!`, {
        companiesProcessed: result.companiesProcessed,
        companiesUpdated: result.companiesUpdated,
        errors: result.errors.length,
        processingTimeMs: result.processingTime
      });

      return result;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logError('❌ HuggingFace sync failed', { error: errorMsg });
      
      result.processingTime = Date.now() - startTime;
      result.errors.push({
        companyId: 'system',
        companyName: 'system',
        error: errorMsg
      });
      
      return result;
    }
  }

  /**
   * Verify data consistency between tables
   */
  async verifyDataConsistency(): Promise<{
    githubConsistent: boolean;
    huggingfaceConsistent: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      // Check GitHub data consistency
      const { data: companiesWithEmptyGithub } = await this.supabase
        .from('companies')
        .select('id, name, github_repos')
        .eq('github_repos', JSON.stringify([]));

      const { data: associationsForEmptyCompanies } = await this.supabase
        .from('company_github_repositories')
        .select('company_id, companies!inner(name)')
        .in('company_id', companiesWithEmptyGithub?.map(c => c.id) || []);

      if (associationsForEmptyCompanies && associationsForEmptyCompanies.length > 0) {
        issues.push(`${associationsForEmptyCompanies.length} companies have GitHub associations but empty github_repos field`);
      }

      // Check for orphaned data
      const { count: orphanedRepos } = await this.supabase
        .from('github_repositories')
        .select('*', { count: 'exact', head: true })
        .not('id', 'in', `(
          SELECT repository_id 
          FROM company_github_repositories 
          WHERE repository_id IS NOT NULL
        )`);

      if (orphanedRepos && orphanedRepos > 0) {
        issues.push(`${orphanedRepos} GitHub repositories are not associated with any company`);
      }

      return {
        githubConsistent: issues.length === 0,
        huggingfaceConsistent: true, // No HF data to check yet
        issues
      };

    } catch (error) {
      logError('Error verifying data consistency', { error });
      return {
        githubConsistent: false,
        huggingfaceConsistent: false,
        issues: [`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Get sync status for monitoring
   */
  async getSyncStatus() {
    try {
      const { count: totalCompanies } = await this.supabase
        .from('companies')
        .select('*', { count: 'exact', head: true });

      const { count: companiesWithGithub } = await this.supabase
        .from('companies')
        .select('*', { count: 'exact', head: true })
        .not('github_repos', 'eq', JSON.stringify([]));

      const { count: companiesWithHF } = await this.supabase
        .from('companies')
        .select('*', { count: 'exact', head: true })
        .not('huggingface_models', 'eq', JSON.stringify([]));

      const { count: githubRepos } = await this.supabase
        .from('github_repositories')
        .select('*', { count: 'exact', head: true });

      const { count: associations } = await this.supabase
        .from('company_github_repositories')
        .select('*', { count: 'exact', head: true });

      return {
        totalCompanies: totalCompanies || 0,
        companiesWithGithubData: companiesWithGithub || 0,
        companiesWithHFData: companiesWithHF || 0,
        totalGitHubRepos: githubRepos || 0,
        totalAssociations: associations || 0,
        githubDataPercentage: totalCompanies ? Math.round((companiesWithGithub / totalCompanies) * 100) : 0,
        hfDataPercentage: totalCompanies ? Math.round((companiesWithHF / totalCompanies) * 100) : 0,
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      logError('Error getting sync status', { error });
      throw error;
    }
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Create a new data sync service instance
 */
export function createDataSyncService(): DataSyncService {
  return new DataSyncService();
}

/**
 * Quick function to sync GitHub data
 */
export async function syncGitHubData(): Promise<SyncResult> {
  const service = createDataSyncService();
  return service.syncGitHubDataToCompanies();
}

/**
 * Quick function to sync HuggingFace data
 */
export async function syncHuggingFaceData(): Promise<SyncResult> {
  const service = createDataSyncService();
  return service.syncHuggingFaceDataToCompanies();
}

/**
 * Quick function to verify data consistency
 */
export async function verifyDataConsistency() {
  const service = createDataSyncService();
  return service.verifyDataConsistency();
}

// Export default instance
export const dataSyncService = createDataSyncService();