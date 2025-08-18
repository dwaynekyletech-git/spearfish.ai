/**
 * Founder Database Service
 * 
 * Handles storing and retrieving founder and funding data from the database
 */

import { createClient } from '@supabase/supabase-js';
import { CompanyTeamData, FounderProfile } from './founder-scraper-service';
import { logInfo, logDebug, logWarn, logError } from './logger';

// =============================================================================
// Type Definitions
// =============================================================================

export interface StoredFounder {
  id: string;
  company_id: string;
  name: string;
  title: string;
  bio?: string;
  linkedin_url?: string;
  twitter_url?: string;
  email?: string;
  image_url?: string;
  background?: string[];
  education?: string[];
  source_url?: string;
  created_at: string;
  updated_at: string;
}

export interface StoredFundingSummary {
  id: string;
  company_id: string;
  total_funding?: string;
  key_investors: string[];
  last_updated: string;
  sources: string[];
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Database Service Class
// =============================================================================

export class FounderDatabaseService {
  private supabase;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  // =============================================================================
  // Founder Management
  // =============================================================================

  /**
   * Save founder data to the database
   */
  async saveFounder(companyId: string, founder: FounderProfile, sourceUrl?: string): Promise<string> {
    try {
      const { data, error } = await this.supabase.rpc('upsert_founder_data', {
        p_company_id: companyId,
        p_name: founder.name,
        p_title: founder.title,
        p_bio: founder.bio || null,
        p_linkedin_url: founder.linkedin_url || null,
        p_twitter_url: founder.twitter_url || null,
        p_email: founder.email || null,
        p_image_url: founder.image_url || null,
        p_background: JSON.stringify(founder.background || []),
        p_education: JSON.stringify(founder.education || []),
        p_source_url: sourceUrl || null
      });

      if (error) {
        console.error('Error saving founder:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Failed to save founder:', error);
      throw error;
    }
  }

  /**
   * Get all founders for a company
   */
  async getFounders(companyId: string): Promise<StoredFounder[]> {
    try {
      const { data, error } = await this.supabase
        .from('founders')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching founders:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Failed to fetch founders:', error);
      return [];
    }
  }

  /**
   * Delete all founders for a company (useful before re-scraping)
   */
  async clearFounders(companyId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('founders')
        .delete()
        .eq('company_id', companyId);

      if (error) {
        console.error('Error clearing founders:', error);
        throw error;
      }
    } catch (error) {
      console.error('Failed to clear founders:', error);
      throw error;
    }
  }

  // =============================================================================
  // Funding Management
  // =============================================================================

  /**
   * Save funding summary to the database
   */
  async saveFundingSummary(companyId: string, fundingData: any): Promise<string> {
    try {
      const { data, error } = await this.supabase.rpc('upsert_funding_summary', {
        p_company_id: companyId,
        p_total_funding: fundingData.total_funding || null,
        p_key_investors: JSON.stringify(fundingData.key_investors || []),
        p_sources: JSON.stringify(fundingData.sources || [])
      });

      if (error) {
        console.error('Error saving funding summary:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Failed to save funding summary:', error);
      throw error;
    }
  }

  /**
   * Get funding summary for a company
   */
  async getFundingSummary(companyId: string): Promise<StoredFundingSummary | null> {
    try {
      const { data, error } = await this.supabase
        .from('company_funding_summary')
        .select('*')
        .eq('company_id', companyId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('Error fetching funding summary:', error);
        throw error;
      }

      return data || null;
    } catch (error) {
      console.error('Failed to fetch funding summary:', error);
      return null;
    }
  }

  // =============================================================================
  // Combined Operations
  // =============================================================================

  /**
   * Save complete team data (founders only)
   */
  async saveTeamData(companyId: string, teamData: CompanyTeamData): Promise<void> {
    try {
      logDebug('Saving team data for company', { companyId });

      // Save all founders
      const founderPromises = teamData.founders.map(founder => 
        this.saveFounder(companyId, founder, teamData.sources[0])
      );
      
      await Promise.all(founderPromises);
      logInfo('Saved founders', { foundersCount: teamData.founders.length });

      // Save basic funding summary with just sources (no funding amounts)
      const basicFundingData = {
        company_id: companyId,
        founders: teamData.founders,
        funding_rounds: [],
        key_investors: [],
        total_funding: null,
        last_updated: teamData.last_updated,
        sources: teamData.sources
      };
      
      await this.saveFundingSummary(companyId, basicFundingData);
      logDebug('Saved team sources');

    } catch (error) {
      console.error('Failed to save team data:', error);
      throw error;
    }
  }

  // Legacy method for backward compatibility
  async saveFundingData(companyId: string, teamData: CompanyTeamData): Promise<void> {
    return this.saveTeamData(companyId, teamData);
  }

  /**
   * Get complete team and funding data for a company
   */
  async getCompanyTeamData(companyId: string): Promise<{
    founders: StoredFounder[];
    funding: StoredFundingSummary | null;
  }> {
    try {
      const [founders, funding] = await Promise.all([
        this.getFounders(companyId),
        this.getFundingSummary(companyId)
      ]);

      return { founders, funding };
    } catch (error) {
      console.error('Failed to fetch company team data:', error);
      return { founders: [], funding: null };
    }
  }

  // =============================================================================
  // Batch Operations
  // =============================================================================

  /**
   * Get companies that need founder data scraping
   */
  async getCompaniesNeedingScraping(limit: number = 10): Promise<any[]> {
    try {
      // Get companies that don't have founders yet or haven't been updated recently
      const { data, error } = await this.supabase
        .from('companies')
        .select(`
          id, name, slug, website_url, yc_url, batch, status,
          founders:founders(count)
        `)
        .is('founders.id', null) // No founders yet
        .limit(limit);

      if (error) {
        console.error('Error fetching companies needing scraping:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Failed to fetch companies needing scraping:', error);
      return [];
    }
  }

  /**
   * Check if a company has been scraped recently (within last 7 days)
   */
  async isRecentlyScrapped(companyId: string): Promise<boolean> {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await this.supabase
        .from('company_funding_summary')
        .select('last_updated')
        .eq('company_id', companyId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking scraping status:', error);
        return false;
      }

      if (!data) return false;

      const lastUpdated = new Date(data.last_updated);
      return lastUpdated > sevenDaysAgo;
    } catch (error) {
      console.error('Failed to check scraping status:', error);
      return false;
    }
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Create a new founder database service instance
 */
export function createFounderDatabaseService(): FounderDatabaseService {
  return new FounderDatabaseService();
}

// Export default instance
export const founderDatabaseService = createFounderDatabaseService();