/**
 * HuggingFace Model Discovery Service
 * 
 * Automatically discovers HuggingFace models for companies by:
 * 1. Searching by organization/author name
 * 2. Looking for models by company name variations
 * 3. Analyzing website URLs for HuggingFace links
 * 4. Keyword-based model search with strict validation
 */

import { createServiceClient } from './supabase-server';
import { safeFetch, getSSRFConfig } from './security/url-validator';
import { logInfo, logDebug, logWarn, logError } from './logger';

// =============================================================================
// Type Definitions
// =============================================================================

export interface HuggingFaceModel {
  id: string; // HF model ID like "meta-llama/Llama-2-7b"
  author: string; // Organization or user
  modelName: string; // Display name
  task?: string; // Primary task
  framework?: string; // Framework used
  downloads: number;
  likes: number;
  trendingScore?: number;
  createdAt: string;
  updatedAt: string;
  lastModified?: string;
  tags: string[];
  libraryName?: string;
  pipelineTag?: string;
  modelIndex?: any;
  private: boolean;
  gated: boolean;
  disabled: boolean;
  sha?: string;
  modelCardUrl: string;
  repositoryUrl: string;
}

export interface HFDiscoveryResult {
  companyId: string;
  companyName: string;
  searchMethods: string[];
  modelsFound: HuggingFaceModel[];
  modelsAssociated: number;
  confidence: 'high' | 'medium' | 'low';
  issues: string[];
}

export interface HFBatchDiscoveryResult {
  success: boolean;
  companiesProcessed: number;
  totalModelsFound: number;
  totalModelsStored: number;
  results: HFDiscoveryResult[];
  processingTime: number;
  rateLimitRemaining: number | null;
}

// =============================================================================
// HuggingFace Discovery Service Class
// =============================================================================

export class HuggingFaceDiscoveryService {
  private supabase = createServiceClient();
  private hfToken = process.env.HUGGINGFACE_TOKEN;
  private rateLimitRemaining: number | null = null;
  private baseUrl = 'https://huggingface.co/api';

  constructor() {
    if (!this.hfToken) {
      logWarn('⚠️ HuggingFace token not found - discovery will be limited');
    }
  }

  /**
   * Discover HuggingFace models for companies that don't have any yet
   */
  async discoverModelsForCompanies(limit: number = 10): Promise<HFBatchDiscoveryResult> {
    const startTime = Date.now();
    const result: HFBatchDiscoveryResult = {
      success: false,
      companiesProcessed: 0,
      totalModelsFound: 0,
      totalModelsStored: 0,
      results: [],
      processingTime: 0,
      rateLimitRemaining: null
    };

    try {
      logInfo('🤗 Starting HuggingFace model discovery');

      // Get companies without HF data
      const { data: companies, error } = await this.supabase
        .from('companies')
        .select('id, name, slug, website_url, one_liner')
        .eq('huggingface_models', JSON.stringify([]))
        .limit(limit);

      if (error) {
        throw new Error(`Failed to fetch companies: ${error.message}`);
      }

      if (!companies || companies.length === 0) {
        logInfo('✅ No companies need HuggingFace discovery');
        result.success = true;
        return result;
      }

      logInfo(`📊 Found ${companies.length} companies needing HF model discovery`);
      result.companiesProcessed = companies.length;

      // Process each company
      for (const company of companies) {
        if (this.rateLimitRemaining !== null && this.rateLimitRemaining < 5) {
          logWarn(`⏸️ HuggingFace rate limit low (${this.rateLimitRemaining}), stopping discovery`);
          break;
        }

        try {
          const discoveryResult = await this.discoverModelsForCompany(company);
          result.results.push(discoveryResult);
          result.totalModelsFound += discoveryResult.modelsFound.length;
          result.totalModelsStored += discoveryResult.modelsAssociated;

          // Small delay to respect rate limits
          await this.delay(2000); // HF API is less aggressive than GitHub

        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          logError(`Error discovering models for ${company.name}`, { error: errorMsg });
          
          result.results.push({
            companyId: company.id,
            companyName: company.name,
            searchMethods: [],
            modelsFound: [],
            modelsAssociated: 0,
            confidence: 'low',
            issues: [errorMsg]
          });
        }
      }

      result.success = true;
      result.processingTime = Date.now() - startTime;
      result.rateLimitRemaining = this.rateLimitRemaining;

      logInfo('🎉 HuggingFace discovery complete', {
        companiesProcessed: result.companiesProcessed,
        totalModelsFound: result.totalModelsFound,
        totalModelsStored: result.totalModelsStored
      });

      return result;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logError('❌ HuggingFace discovery failed', { error: errorMsg });
      
      result.processingTime = Date.now() - startTime;
      throw error;
    }
  }

  /**
   * Discover models for a single company
   */
  async discoverModelsForCompany(company: any): Promise<HFDiscoveryResult> {
    const result: HFDiscoveryResult = {
      companyId: company.id,
      companyName: company.name,
      searchMethods: [],
      modelsFound: [],
      modelsAssociated: 0,
      confidence: 'low',
      issues: []
    };

    logDebug(`🔍 Discovering HF models for ${company.name}`);

    try {
      // Method 1: Search by exact organization/author name
      const orgModels = await this.searchByAuthor(company.name);
      if (orgModels.length > 0) {
        result.searchMethods.push('organization');
        result.modelsFound.push(...orgModels);
        result.confidence = 'high';
      }

      // Method 2: Search by company slug (if different from name)
      if (company.slug && company.slug !== company.name.toLowerCase().replace(/\s+/g, '')) {
        const slugModels = await this.searchByAuthor(company.slug);
        if (slugModels.length > 0) {
          result.searchMethods.push('slug');
          result.modelsFound.push(...this.deduplicateModels(result.modelsFound, slugModels));
        }
      }

      // Method 3: Search models by company name (keyword search)
      if (result.modelsFound.length === 0) {
        const searchModels = await this.searchModels(company.name);
        if (searchModels.length > 0) {
          result.searchMethods.push('search');
          result.modelsFound.push(...searchModels);
          result.confidence = result.confidence === 'low' ? 'medium' : result.confidence;
        }
      }

      // Method 4: Extract from website URL (if it contains huggingface.co)
      if (company.website_url && company.website_url.includes('huggingface.co')) {
        const websiteModels = await this.extractFromWebsiteURL(company.website_url, company.name);
        if (websiteModels.length > 0) {
          result.searchMethods.push('website');
          result.modelsFound.push(...this.deduplicateModels(result.modelsFound, websiteModels));
        }
      }

      // Filter and validate models with STRICT ownership validation
      const discoveryMethod = result.searchMethods[0] || 'search';
      result.modelsFound = await this.filterRelevantModels(result.modelsFound, company, discoveryMethod);

      // Store discovered models (only if they passed validation)
      if (result.modelsFound.length > 0) {
        logInfo(`✅ Found ${result.modelsFound.length} validated models for ${company.name}`);
        result.modelsAssociated = await this.storeDiscoveredModels(company.id, result.modelsFound, discoveryMethod);
        result.confidence = result.modelsFound.length > 3 ? 'high' : result.confidence === 'low' ? 'medium' : result.confidence;
      } else {
        logInfo(`❌ No valid HF models found for ${company.name} - models didn't pass ownership validation`);
        result.confidence = 'low';
        result.issues.push('No models passed strict ownership validation');
      }

      logDebug(`✅ ${company.name}: Found ${result.modelsFound.length} models, stored ${result.modelsAssociated}`);

      return result;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      result.issues.push(errorMsg);
      logError(`Error in discovery for ${company.name}`, { error: errorMsg });
      return result;
    }
  }

  /**
   * Search for models by author/organization name
   */
  private async searchByAuthor(authorName: string): Promise<HuggingFaceModel[]> {
    try {
      const cleanAuthorName = this.cleanAuthorName(authorName);
      const url = `${this.baseUrl}/models?author=${encodeURIComponent(cleanAuthorName)}&limit=50`;
      
      const response = await safeFetch(url, {
        headers: {
          'Authorization': this.hfToken ? `Bearer ${this.hfToken}` : '',
          'User-Agent': 'SpearfishAI/1.0'
        }
      }, getSSRFConfig('general'));

      this.updateRateLimit(response.headers);

      if (response.status === 404) {
        // Author/organization doesn't exist
        return [];
      }

      if (!response.ok) {
        throw new Error(`HuggingFace API error: ${response.status} ${response.statusText}`);
      }

      const models = await response.json();
      return this.transformHFModels(models);

    } catch (error) {
      logDebug(`No author found for ${authorName}`, { error: error instanceof Error ? error.message : error });
      return [];
    }
  }

  /**
   * Search models by name/keywords
   */
  private async searchModels(companyName: string): Promise<HuggingFaceModel[]> {
    try {
      const query = encodeURIComponent(companyName);
      const url = `${this.baseUrl}/models?search=${query}&limit=20`;
      
      const response = await safeFetch(url, {
        headers: {
          'Authorization': this.hfToken ? `Bearer ${this.hfToken}` : '',
          'User-Agent': 'SpearfishAI/1.0'
        }
      }, getSSRFConfig('general'));

      this.updateRateLimit(response.headers);

      if (!response.ok) {
        throw new Error(`HuggingFace search API error: ${response.status} ${response.statusText}`);
      }

      const models = await response.json();
      return this.transformHFModels(models);

    } catch (error) {
      logDebug(`Search failed for ${companyName}`, { error: error instanceof Error ? error.message : error });
      return [];
    }
  }

  /**
   * Extract model from HuggingFace URL
   */
  private async extractFromWebsiteURL(websiteUrl: string, companyName: string): Promise<HuggingFaceModel[]> {
    try {
      // Extract author from huggingface.co URL (e.g., https://huggingface.co/author)
      const match = websiteUrl.match(/https?:\/\/huggingface\.co\/([^\/\?]+)/);
      if (!match) return [];

      const author = match[1];
      return await this.searchByAuthor(author);

    } catch (error) {
      logDebug(`Failed to extract from website URL ${websiteUrl}`, { error });
      return [];
    }
  }

  /**
   * Filter models to only include ones that actually belong to the company
   * This is the CRITICAL method that prevents false positives
   */
  private async filterRelevantModels(models: HuggingFaceModel[], company: any, discoveryMethod: string): Promise<HuggingFaceModel[]> {
    // Generate valid company name variations for matching
    const companyVariations = this.generateCompanyVariations(company.name, company.slug);
    
    logDebug(`🔍 Validating ${models.length} models for ${company.name} (method: ${discoveryMethod})`, {
      companyVariations,
      modelAuthors: models.map(m => m.author)
    });

    const validatedModels = models.filter(model => {
      // STEP 1: STRICT OWNERSHIP VALIDATION
      const authorMatches = this.doesAuthorMatchCompany(model.author, companyVariations);
      
      logDebug(`Validating ${model.id}`, {
        author: model.author,
        authorMatches,
        method: discoveryMethod
      });

      // If discovered via organization search, trust it more (they searched for the org directly)
      if (discoveryMethod === 'organization' || discoveryMethod === 'slug') {
        if (authorMatches) {
          logDebug(`✅ ACCEPTED: ${model.id} - org search with author match`);
          return true;
        } else {
          logDebug(`❌ REJECTED: ${model.id} - org search but author doesn't match`);
          return false;
        }
      }
      
      // For search results or website extraction, be VERY strict
      if (discoveryMethod === 'search' || discoveryMethod === 'website') {
        // Must have author match for search results
        if (!authorMatches) {
          logDebug(`❌ REJECTED: ${model.id} - ${discoveryMethod} but author '${model.author}' doesn't match company`);
          return false;
        }
        
        // Additional validation: check if model name also suggests it belongs to company
        const modelNameMatches = this.doesModelNameMatchCompany(model.modelName, companyVariations);
        
        if (authorMatches || modelNameMatches) {
          logDebug(`✅ ACCEPTED: ${model.id} - ${discoveryMethod} with strong match`);
        } else {
          logDebug(`❌ REJECTED: ${model.id} - ${discoveryMethod} but weak match`);
          return false;
        }
      }
      
      // STEP 2: SECONDARY QUALITY FILTERS (only for models that passed ownership validation)
      
      // Skip private models unless they have high engagement
      if (model.private && model.likes < 5) {
        logDebug(`❌ REJECTED: ${model.id} - private with low engagement`);
        return false;
      }

      // Skip disabled models
      if (model.disabled) {
        logDebug(`❌ REJECTED: ${model.id} - disabled model`);
        return false;
      }

      // Skip very old models without recent activity (unless popular)
      const lastActivity = new Date(model.lastModified || model.updatedAt);
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      if (lastActivity < oneYearAgo && model.downloads < 100 && model.likes < 5) {
        logDebug(`❌ REJECTED: ${model.id} - too old with low engagement`);
        return false;
      }

      logDebug(`✅ ACCEPTED: ${model.id} - passed all validation`);
      return true;
    }).sort((a, b) => b.downloads - a.downloads); // Sort by popularity
    
    logInfo(`🎯 Validation complete for ${company.name}: ${validatedModels.length}/${models.length} models passed`, {
      accepted: validatedModels.map(m => m.id),
      method: discoveryMethod
    });
    
    return validatedModels;
  }

  /**
   * Store discovered models in the database
   */
  private async storeDiscoveredModels(companyId: string, models: HuggingFaceModel[], discoveryMethod: string): Promise<number> {
    let storedCount = 0;

    for (const model of models) {
      try {
        // First, store/update the model
        const { data: storedModel, error: modelError } = await this.supabase
          .from('huggingface_models')
          .upsert({
            model_id: model.id,
            author: model.author,
            model_name: model.modelName,
            task: model.task,
            framework: model.framework,
            downloads: model.downloads,
            likes: model.likes,
            trending_score: model.trendingScore,
            created_at_hf: model.createdAt,
            updated_at_hf: model.updatedAt,
            last_modified_hf: model.lastModified,
            tags: model.tags,
            library_name: model.libraryName,
            pipeline_tag: model.pipelineTag,
            model_index: model.modelIndex,
            private: model.private,
            gated: model.gated,
            disabled: model.disabled,
            sha: model.sha,
            model_card_url: model.modelCardUrl,
            repository_url: model.repositoryUrl,
            last_synced_at: new Date().toISOString()
          }, {
            onConflict: 'model_id',
            ignoreDuplicates: false
          })
          .select()
          .single();

        if (modelError) {
          logError(`Failed to store model ${model.id}`, { error: modelError.message });
          continue;
        }

        // Then, create the company-model association
        const { error: assocError } = await this.supabase
          .from('company_huggingface_models')
          .upsert({
            company_id: companyId,
            model_id: storedModel.id,
            is_primary: storedCount === 0, // First model is primary
            discovery_method: discoveryMethod,
            confidence_score: this.calculateConfidence(model, discoveryMethod),
            notes: `Discovered via ${discoveryMethod} search`
          }, {
            onConflict: 'company_id,model_id',
            ignoreDuplicates: true
          });

        if (assocError) {
          logError(`Failed to create association for ${model.id}`, { error: assocError.message });
          continue;
        }

        storedCount++;

      } catch (error) {
        logError(`Exception storing ${model.id}`, { error: error instanceof Error ? error.message : error });
      }
    }

    return storedCount;
  }

  // =============================================================================
  // Helper Methods
  // =============================================================================

  private cleanAuthorName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private deduplicateModels(existing: HuggingFaceModel[], newModels: HuggingFaceModel[]): HuggingFaceModel[] {
    const existingIds = new Set(existing.map(m => m.id));
    return newModels.filter(m => !existingIds.has(m.id));
  }

  private transformHFModels(models: any[]): HuggingFaceModel[] {
    return models.map(model => ({
      id: model.id || model.modelId,
      author: this.extractAuthor(model.id || model.modelId),
      modelName: model.name || this.extractModelName(model.id || model.modelId),
      task: model.pipeline_tag || model.task,
      framework: model.library_name || model.framework,
      downloads: model.downloads || 0,
      likes: model.likes || 0,
      trendingScore: model.trending_score || 0,
      createdAt: model.createdAt || new Date().toISOString(),
      updatedAt: model.lastModified || model.updatedAt || new Date().toISOString(),
      lastModified: model.lastModified,
      tags: model.tags || [],
      libraryName: model.library_name,
      pipelineTag: model.pipeline_tag,
      modelIndex: model.model_index || {},
      private: model.private || false,
      gated: model.gated || false,
      disabled: model.disabled || false,
      sha: model.sha,
      modelCardUrl: `https://huggingface.co/${model.id || model.modelId}`,
      repositoryUrl: `https://huggingface.co/${model.id || model.modelId}/tree/main`
    }));
  }

  /**
   * Generate company name variations for matching
   */
  private generateCompanyVariations(name: string, slug?: string): string[] {
    const variations = new Set<string>();
    
    // Add original name (lowercased)
    variations.add(name.toLowerCase());
    
    // Add slug if provided and different from name
    if (slug && slug.toLowerCase() !== name.toLowerCase()) {
      variations.add(slug.toLowerCase());
    }
    
    // Remove common company suffixes and add variations
    const cleanName = name
      .toLowerCase()
      .replace(/\s+(ai|inc|labs|technologies|tech|io|hq|co|corp|corporation|ltd|llc)$/i, '')
      .trim();
    
    if (cleanName !== name.toLowerCase()) {
      variations.add(cleanName);
    }
    
    // Add hyphenated version (spaces → hyphens)
    const hyphenated = cleanName.replace(/\s+/g, '-');
    if (hyphenated !== cleanName) {
      variations.add(hyphenated);
    }
    
    // Add no-space version (spaces → nothing)
    const nospace = cleanName.replace(/\s+/g, '');
    if (nospace !== cleanName && nospace.length > 2) {
      variations.add(nospace);
    }
    
    // Add underscored version (spaces → underscores)
    const underscored = cleanName.replace(/\s+/g, '_');
    if (underscored !== cleanName) {
      variations.add(underscored);
    }
    
    logDebug(`Generated company variations for "${name}":`, Array.from(variations));
    return Array.from(variations).filter(v => v.length > 1); // Remove single chars
  }

  /**
   * Check if model author matches the company
   */
  private doesAuthorMatchCompany(author: string, companyVariations: string[]): boolean {
    const authorLower = author.toLowerCase();
    
    for (const variation of companyVariations) {
      // Exact match (best case)
      if (authorLower === variation) {
        return true;
      }
      
      // Author contains variation (e.g., "meta-ai" contains "meta")
      if (variation.length > 3 && authorLower.includes(variation)) {
        return true;
      }
      
      // Variation contains author (e.g., "openai labs" contains "openai")  
      if (authorLower.length > 3 && variation.includes(authorLower)) {
        return true;
      }
      
      // High similarity match (80%+ similar)
      if (this.calculateSimilarity(authorLower, variation) > 0.8) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check if model name suggests it belongs to the company
   */
  private doesModelNameMatchCompany(modelName: string, companyVariations: string[]): boolean {
    const modelLower = modelName.toLowerCase();
    
    return companyVariations.some(variation => {
      // Model name starts with company name
      if (modelLower.startsWith(variation) && variation.length > 2) {
        return true;
      }
      
      // Model name contains company name  
      if (variation.length > 3 && modelLower.includes(variation)) {
        return true;
      }
      
      return false;
    });
  }

  /**
   * Calculate similarity between two strings (0-1 scale)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1;
    
    const distance = this.levenshteinDistance(str1, str2);
    return 1 - (distance / maxLen);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion  
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private extractAuthor(modelId: string): string {
    return modelId.split('/')[0] || '';
  }

  private extractModelName(modelId: string): string {
    return modelId.split('/')[1] || modelId;
  }

  private calculateConfidence(model: HuggingFaceModel, method: string): number {
    let confidence = 0.5; // Base confidence

    // Method-based confidence
    switch (method) {
      case 'organization':
        confidence = 0.95;
        break;
      case 'slug':
        confidence = 0.90;
        break;
      case 'website':
        confidence = 0.85;
        break;
      case 'search':
        confidence = 0.70;
        break;
    }

    // Adjust based on model characteristics
    if (model.downloads > 1000) confidence += 0.05;
    if (model.likes > 10) confidence += 0.05;
    if (model.tags.length > 0) confidence += 0.05;
    if (!model.private && !model.gated) confidence += 0.05;

    return Math.min(confidence, 1.0);
  }

  private updateRateLimit(headers: Headers): void {
    // HuggingFace may use different header names
    const remaining = headers.get('x-ratelimit-remaining') || headers.get('ratelimit-remaining');
    if (remaining) {
      this.rateLimitRemaining = parseInt(remaining, 10);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Create a new HuggingFace discovery service instance
 */
export function createHuggingFaceDiscoveryService(): HuggingFaceDiscoveryService {
  return new HuggingFaceDiscoveryService();
}

/**
 * Quick function to discover models for companies without HF data
 */
export async function discoverMissingHuggingFaceModels(limit: number = 10): Promise<HFBatchDiscoveryResult> {
  const service = createHuggingFaceDiscoveryService();
  return service.discoverModelsForCompanies(limit);
}

// Export default instance
export const huggingfaceDiscoveryService = createHuggingFaceDiscoveryService();