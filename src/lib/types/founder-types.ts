/**
 * Founder and Team Data Types
 * 
 * Standalone type definitions for founder profiles and company team data.
 * Used across various services including Apify integration and database operations.
 */

// =============================================================================
// Founder Profile Types
// =============================================================================

export interface FounderProfile {
  name: string;
  title: string;
  bio?: string;
  linkedin_url?: string;
  twitter_url?: string;
  email?: string;
  image_url?: string;
  background?: string[];
  education?: string[];
}

export interface CompanyTeamData {
  company_id: string;
  founders: FounderProfile[];
  last_updated: string;
  sources: string[];
}

// =============================================================================
// Database Entity Types
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
  data_source?: string;
  apify_scraped_at?: string;
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