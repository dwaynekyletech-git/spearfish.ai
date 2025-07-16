/**
 * Founder and Funding Data Scraper Service
 * 
 * Web scraper to extract founder profiles and funding information
 * from various sources starting with easy wins.
 */

import { CompanyData } from './spearfish-scoring-service';

// =============================================================================
// Type Definitions
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
// Scraper Service Class
// =============================================================================

export class FounderScraperService {
  private puppeteerAvailable: boolean = false;

  constructor() {
    // Check if Puppeteer MCP is available
    this.checkPuppeteerAvailability();
  }

  private async checkPuppeteerAvailability(): Promise<void> {
    try {
      // This would be implemented when we have MCP integration
      // For now, we'll simulate with fetch
      this.puppeteerAvailable = true;
    } catch (error) {
      console.warn('Puppeteer MCP not available, falling back to fetch');
      this.puppeteerAvailable = false;
    }
  }

  // =============================================================================
  // Main Scraping Methods
  // =============================================================================

  /**
   * Scrape team data for a company (founders only)
   */
  async scrapeCompanyData(company: CompanyData): Promise<CompanyTeamData> {
    const teamData: CompanyTeamData = {
      company_id: company.id,
      founders: [],
      last_updated: new Date().toISOString(),
      sources: []
    };

    try {
      // Scrape YC company page (only source needed - all founders should be found here)
      const ycUrl = (company as any).yc_url || `https://www.ycombinator.com/companies/${company.name.toLowerCase().replace(/\s+/g, '')}`;
      
      console.log(`🔍 Scraping YC page: ${ycUrl}`);
      const ycData = await this.scrapeYCCompanyPage(ycUrl);
      this.mergeTeamData(teamData, ycData);
      
      console.log(`✅ Found ${ycData.founders?.length || 0} founders on YC page`);
      return this.cleanTeamData(teamData);

    } catch (error) {
      console.error(`Error scraping data for ${company.name}:`, error);
      return teamData;
    }
  }

  // =============================================================================
  // YC Company Page Scraping
  // =============================================================================

  /**
   * Scrape YC company page for founder and funding info
   */
  private async scrapeYCCompanyPage(ycUrl: string): Promise<Partial<CompanyTeamData>> {
    try {
      console.log(`🔍 Fetching YC page: ${ycUrl}`);
      const response = await fetch(ycUrl);
      
      if (!response.ok) {
        console.log(`❌ YC page not found: ${ycUrl} (${response.status})`);
        return { sources: [ycUrl] };
      }
      
      const html = await response.text();
      
      const data: Partial<CompanyTeamData> = {
        founders: [],
        sources: [ycUrl]
      };

      console.log(`✅ Successfully fetched YC page, parsing founders...`);

      // First, try to find the "Active Founders" section specifically
      const activeFounders = this.parseActiveFoundersSection(html);
      if (activeFounders.length > 0) {
        console.log(`✅ Found ${activeFounders.length} founders in Active Founders section`);
        data.founders!.push(...activeFounders);
        return data;
      }

      // If no Active Founders section, fall back to other patterns
      console.log(`🔍 No Active Founders section found, trying other patterns...`);

      // YC company pages have multiple possible founder section formats
      const founderSectionPatterns = [
        // New YC page format with founder cards
        /<div[^>]*class="[^"]*founder[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        // Founder profile sections
        /<div[^>]*data-[^>]*founder[^>]*>([\s\S]*?)<\/div>/gi,
        // Team member sections
        /<div[^>]*class="[^"]*team-member[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        // General person/profile sections that might contain founders
        /<div[^>]*class="[^"]*person[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
      ];

      const foundFounders = new Set<string>();
      
      for (const pattern of founderSectionPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
          const sectionHtml = match[1];
          const founder = this.parseFounderFromYC(sectionHtml);
          if (founder && !foundFounders.has(founder.name)) {
            foundFounders.add(founder.name);
            data.founders!.push(founder);
            console.log(`✅ Found YC founder: ${founder.name} - ${founder.title}`);
          }
        }
      }

      // If structured founder sections didn't work, try general text parsing
      if (data.founders!.length === 0) {
        console.log(`🔍 No structured founder data found, trying general text parsing...`);
        const textFounders = this.parseFoundersFromYCText(html);
        data.founders!.push(...textFounders);
        
        for (const founder of textFounders) {
          console.log(`✅ Found YC founder via text parsing: ${founder.name} - ${founder.title}`);
        }
      }

      console.log(`📊 YC page scraping results: ${data.founders!.length} founders found`);
      return data;

    } catch (error) {
      console.error('Error scraping YC page:', error);
      return { sources: [ycUrl] };
    }
  }

  /**
   * Parse the "Active Founders" section from YC company pages
   */
  private parseActiveFoundersSection(html: string): FounderProfile[] {
    const founders: FounderProfile[] = [];
    
    try {
      // Look for the "Active Founders" text and get surrounding content
      // The structure is typically: <div>Active Founders</div> followed by founder cards
      const activeFoundersMatch = html.match(/>Active\s+Founders<\/[^>]+>([\s\S]*?)(?:<div[^>]*class="[^"]*(?:prose|my-4|text-2xl)[^"]*"[^>]*>|<h[1-6]|<footer|$)/i);
      
      if (!activeFoundersMatch) {
        return founders;
      }
      
      const foundersSection = activeFoundersMatch[1];
      console.log('🔍 Found Active Founders section, parsing individual founders...');
      
      // Based on the HTML structure, each founder is in a card with specific patterns
      // Look for founder cards with the structure: image, name (in text-xl font-bold), "Founder" title, bio
      
      // Pattern 1: Extract founder cards based on the structure we saw
      // More flexible pattern to catch variations in the HTML structure
      const founderCardPattern = /<div[^>]*class="[^"]*text-xl font-bold[^"]*"[^>]*>([^<]+)<\/div>[\s\S]*?<div[^>]*>\s*Founder\s*<\/div>/gi;
      let match;
      
      // Reset regex index to ensure we catch all matches
      founderCardPattern.lastIndex = 0;
      
      while ((match = founderCardPattern.exec(foundersSection)) !== null) {
        const name = match[1].trim();
        if (this.isValidPersonName(name)) {
          // Look for bio and social links near this founder
          const founderIndex = foundersSection.indexOf(match[0]);
          const founderEndIndex = founderIndex + 2000; // Look ahead for bio/links
          const founderBlock = foundersSection.substring(founderIndex, founderEndIndex);
          
          // Extract bio if present (in prose div with whitespace-pre-line)
          const bioMatch = founderBlock.match(/<div[^>]*class="[^"]*prose max-w-full whitespace-pre-line[^"]*"[^>]*>([^<]+(?:\n[^<]*)*)<\/div>/i);
          const bio = bioMatch ? bioMatch[1].replace(/\n+/g, ' ').trim() : undefined;
          
          // Extract LinkedIn URL (handle both https and http)
          const linkedinMatch = founderBlock.match(/href="https?:\/\/(?:www\.)?linkedin\.com\/in\/([^"]+)"/i);
          const twitterMatch = founderBlock.match(/href="https:\/\/(?:www\.)?(twitter\.com|x\.com)\/([^"]+)"/i);
          
          founders.push({
            name: name,
            title: 'Founder',
            linkedin_url: linkedinMatch ? `https://linkedin.com/in/${linkedinMatch[1]}` : undefined,
            twitter_url: twitterMatch ? `https://${twitterMatch[1]}/${twitterMatch[2]}` : undefined,
            bio: bio
          });
          
          console.log(`✅ Found founder in Active Founders section: ${name}`);
        }
      }
      
      // If the main pattern didn't find multiple founders, try a simpler approach
      if (founders.length <= 1) {
        console.log('🔍 Trying simpler pattern to find more founders...');
        
        // Look for all "text-xl font-bold" divs that contain person names
        const namePattern = /<div[^>]*class="[^"]*text-xl font-bold[^"]*"[^>]*>([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)<\/div>/gi;
        namePattern.lastIndex = 0;
        
        const foundNames = new Set(founders.map(f => f.name)); // Track already found names
        
        while ((match = namePattern.exec(foundersSection)) !== null) {
          const name = match[1].trim();
          if (this.isValidPersonName(name) && !foundNames.has(name)) {
            // Check if "Founder" appears near this name
            const nameIndex = foundersSection.indexOf(match[0]);
            const contextAfter = foundersSection.substring(nameIndex, nameIndex + 200);
            
            if (contextAfter.includes('Founder')) {
              founders.push({
                name: name,
                title: 'Founder'
              });
              foundNames.add(name);
              console.log(`✅ Found additional founder: ${name}`);
            }
          }
        }
      }
      
      // Pattern 3: Fallback - Look for any person name followed by "Founder" in the section
      if (founders.length === 0) {
        console.log('🔍 Using fallback pattern to find founders...');
        
        // Look for any div that contains a person's name followed by "Founder"
        const altPattern = />([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)<\/[^>]+>[\s\S]*?Founder/gi;
        altPattern.lastIndex = 0;
        
        while ((match = altPattern.exec(foundersSection)) !== null) {
          const name = match[1].trim();
          if (this.isValidPersonName(name) && !founders.find(f => f.name === name)) {
            founders.push({
              name: name,
              title: 'Founder'
            });
            console.log(`✅ Found founder via fallback pattern: ${name}`);
          }
        }
      }
      
    } catch (error) {
      console.error('Error parsing Active Founders section:', error);
    }
    
    return founders;
  }

  private parseFounderFromYC(founderHtml: string): FounderProfile | null {
    try {
      // Multiple patterns for extracting names and titles from YC founder sections
      const namePatterns = [
        /class="name"[^>]*>([^<]+)/i,
        /<h[1-6][^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)/i,
        /<div[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)/i,
        // Generic patterns for founder names in YC format
        /([A-Z][a-z]+ [A-Z][a-z]+(?:, PhD)?)/
      ];
      
      const titlePatterns = [
        /class="title"[^>]*>([^<]+)/i,
        /<div[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)/i,
        /(CEO|CTO|Co-founder|Founder|Chief Executive|Chief Technology)/i
      ];

      let nameMatch = null;
      let titleMatch = null;

      // Try each name pattern
      for (const pattern of namePatterns) {
        nameMatch = founderHtml.match(pattern);
        if (nameMatch) break;
      }

      // Try each title pattern
      for (const pattern of titlePatterns) {
        titleMatch = founderHtml.match(pattern);
        if (titleMatch) break;
      }

      if (!nameMatch) return null;

      const name = nameMatch[1].trim();
      if (!this.isValidPersonName(name)) return null;

      const linkedinMatch = founderHtml.match(/linkedin\.com\/in\/([^"]+)/);
      const twitterMatch = founderHtml.match(/twitter\.com\/([^"]+)/);

      return {
        name: name,
        title: titleMatch ? titleMatch[1].trim() : 'Founder',
        linkedin_url: linkedinMatch ? `https://linkedin.com/in/${linkedinMatch[1]}` : undefined,
        twitter_url: twitterMatch ? `https://twitter.com/${twitterMatch[1]}` : undefined,
      };

    } catch (error) {
      console.error('Error parsing founder from YC:', error);
      return null;
    }
  }

  /**
   * Parse founders from YC page using general text patterns
   */
  private parseFoundersFromYCText(html: string): FounderProfile[] {
    const founders: FounderProfile[] = [];
    
    // YC pages often have structured sections with founder information
    // Look for common patterns like "Founded by John Doe and Jane Smith"
    const founderTextPatterns = [
      // "Founded by Name1 and Name2"
      /Founded by ([A-Z][a-z]+ [A-Z][a-z]+(?:, PhD)?)(?: and ([A-Z][a-z]+ [A-Z][a-z]+(?:, PhD)?))?/gi,
      // "Founders: Name1, Name2"
      /Founders?:?\s*([A-Z][a-z]+ [A-Z][a-z]+(?:, PhD)?)(?:,?\s*(?:and\s*)?([A-Z][a-z]+ [A-Z][a-z]+(?:, PhD)?))?/gi,
      // "CEO Name, CTO Name"
      /(CEO|Co-founder|Founder)\s+([A-Z][a-z]+ [A-Z][a-z]+(?:, PhD)?)/gi,
      // Look for name followed by founder/CEO/CTO within reasonable distance
      /([A-Z][a-z]+ [A-Z][a-z]+(?:, PhD)?)[^.]{0,50}(CEO|CTO|Co-founder|Founder)/gi
    ];

    for (const pattern of founderTextPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        // Handle different match groups based on pattern
        if (pattern.source.includes('Founded by')) {
          // "Founded by" pattern
          const name1 = match[1];
          const name2 = match[2];
          
          if (name1 && this.isValidPersonName(name1)) {
            founders.push({ name: name1.trim(), title: 'Founder' });
          }
          if (name2 && this.isValidPersonName(name2)) {
            founders.push({ name: name2.trim(), title: 'Founder' });
          }
        } else if (pattern.source.includes('Founders')) {
          // "Founders:" pattern
          const name1 = match[1];
          const name2 = match[2];
          
          if (name1 && this.isValidPersonName(name1)) {
            founders.push({ name: name1.trim(), title: 'Founder' });
          }
          if (name2 && this.isValidPersonName(name2)) {
            founders.push({ name: name2.trim(), title: 'Founder' });
          }
        } else if (pattern.source.includes('CEO|Co-founder')) {
          // Title + Name pattern
          const title = match[1];
          const name = match[2];
          
          if (name && this.isValidPersonName(name)) {
            founders.push({ name: name.trim(), title: title });
          }
        } else {
          // Name + Title pattern
          const name = match[1];
          const title = match[2];
          
          if (name && this.isValidPersonName(name)) {
            founders.push({ name: name.trim(), title: title });
          }
        }
      }
    }

    // Remove duplicates
    const uniqueFounders = founders.filter((founder, index, self) =>
      index === self.findIndex(f => f.name.toLowerCase() === founder.name.toLowerCase())
    );

    return uniqueFounders;
  }

  // =============================================================================
  // Utility Methods
  // =============================================================================

  /**
   * Merge team data from multiple sources
   */
  private mergeTeamData(target: CompanyTeamData, source: Partial<CompanyTeamData>): void {
    if (source.founders) {
      target.founders.push(...source.founders);
    }
    
    if (source.sources) {
      target.sources.push(...source.sources);
    }
  }

  /**
   * Clean and deduplicate scraped team data
   */
  cleanTeamData(data: CompanyTeamData): CompanyTeamData {
    // Remove duplicate founders
    const uniqueFounders = data.founders.filter((founder, index, self) =>
      index === self.findIndex(f => f.name === founder.name)
    );

    // Remove duplicate sources
    const uniqueSources = Array.from(new Set(data.sources));

    return {
      ...data,
      founders: uniqueFounders,
      sources: uniqueSources
    };
  }

  // Legacy method for backward compatibility
  cleanData(data: CompanyTeamData): CompanyTeamData {
    return this.cleanTeamData(data);
  }

  /**
   * Validate that a string looks like a real person name, not industry terms
   */
  private isValidPersonName(name: string): boolean {
    // Basic length check
    if (name.length < 3 || name.length > 50) {
      return false;
    }
    
    // Must match proper name format (handles middle initials, PhD, etc.)
    // Examples: "John Doe", "John P. Doe", "John Doe PhD", "John P. Doe, PhD"
    if (!/^[A-Z][a-z]+( [A-Z]\.?)? [A-Z][a-z]+(,? PhD)?$/i.test(name)) {
      return false;
    }
    
    // Specific blacklist for common false positives we've seen
    const specificBlacklist = [
      'you come', 'feel free', 'work at', 'light text', 'startup dire', 'founder dire',
      'linkcolor cursor', 'colors duration', 'drug discovery', 'drug delivery', 
      'material science', 'data science', 'machine learning', 'artificial intelligence',
      'computer vision', 'software development', 'product management', 'business development',
      'of airbnb', 'which began', 'just donated', 'strategic advisory', 'housing resources',
      'make products', 'full whitespace', 'prose max', 'prose font',
      'of growthbook', 'graham is', 'previously he', 'jeremy is', 'after virgin',
      'elevate pay', 'step one', 'company name', 'company website', 'team member'
    ];
    
    for (const blacklisted of specificBlacklist) {
      if (name.toLowerCase() === blacklisted.toLowerCase()) {
        return false;
      }
    }
    
    // Blacklist common industry terms that aren't names
    const industryTerms = [
      'Drug Discovery', 'Drug Delivery', 'Material Science', 'Data Science',
      'Machine Learning', 'Artificial Intelligence', 'Computer Vision',
      'Software Development', 'Product Management', 'Business Development',
      'Sales Manager', 'Marketing Manager', 'Operations Manager',
      'Tech Lead', 'Engineering Lead', 'Design Lead', 'Product Lead',
      'Growth Manager', 'Customer Success', 'Human Resources',
      'Financial Services', 'Investment Banking', 'Venture Capital',
      'Private Equity', 'Real Estate', 'Healthcare Services',
      'Biotechnology Research', 'Clinical Research', 'Market Research',
      'User Experience', 'User Interface', 'Full Stack', 'Front End',
      'Back End', 'Mobile Development', 'Web Development',
      'Cloud Computing', 'Cyber Security', 'Information Technology'
    ];
    
    // Check if the name matches any industry term
    for (const term of industryTerms) {
      if (name.toLowerCase() === term.toLowerCase()) {
        return false;
      }
    }
    
    // Additional checks for common non-name patterns
    if (name.includes('Development') || name.includes('Management') || 
        name.includes('Research') || name.includes('Services') ||
        name.includes('Technology') || name.includes('Solutions')) {
      return false;
    }
    
    // Check for common title words that shouldn't be in names
    const titleWords = ['CEO', 'CTO', 'CFO', 'COO', 'VP', 'Director', 'Manager', 'Lead', 'Head'];
    for (const word of titleWords) {
      if (name.includes(word)) {
        return false;
      }
    }
    
    // Filter out JavaScript/programming terms
    const programmingTerms = [
      'instanceof', 'constructor', 'prototype', 'function', 'return', 'var', 'let', 'const',
      'class', 'interface', 'import', 'export', 'module', 'require', 'typeof', 'undefined',
      'null', 'true', 'false', 'this', 'super', 'extends', 'implements', 'async', 'await',
      'promise', 'callback', 'object', 'array', 'string', 'number', 'boolean', 'symbol'
    ];
    
    for (const term of programmingTerms) {
      if (name.toLowerCase().includes(term.toLowerCase())) {
        return false;
      }
    }
    
    // Filter out common HTML/CSS terms
    const webTerms = [
      'div', 'span', 'class', 'style', 'href', 'src', 'alt', 'title', 'data', 'id',
      'container', 'wrapper', 'content', 'header', 'footer', 'nav', 'main', 'section',
      'article', 'aside', 'button', 'input', 'form', 'label', 'select', 'option',
      'cursor', 'color', 'text', 'link', 'image', 'border', 'margin', 'padding'
    ];
    
    for (const term of webTerms) {
      if (name.toLowerCase().includes(term.toLowerCase())) {
        return false;
      }
    }
    
    // Filter out common UI/design terms that might appear on YC pages
    const uiTerms = [
      'link color', 'text color', 'background', 'font size', 'line height',
      'border radius', 'box shadow', 'flex box', 'grid layout'
    ];
    
    for (const term of uiTerms) {
      if (name.toLowerCase().includes(term.toLowerCase())) {
        return false;
      }
    }
    
    // Must contain at least one vowel in each word (real names have vowels)
    const words = name.split(' ');
    for (const word of words) {
      if (!/[aeiouAEIOU]/.test(word)) {
        return false;
      }
    }
    
    // Additional check: both words should look like real names
    // First word and last word should not be common English words
    const commonWords = [
      'come', 'free', 'work', 'light', 'dark', 'color', 'text', 'link', 'size',
      'time', 'date', 'page', 'site', 'home', 'about', 'contact', 'help', 'info',
      'after', 'before', 'during', 'company', 'team', 'member', 'former', 'current',
      'step', 'first', 'second', 'third', 'next', 'previous', 'previously',
      'elevate', 'virgin', 'started', 'founded', 'created', 'launched'
    ];
    
    for (const word of words) {
      if (commonWords.includes(word.toLowerCase())) {
        return false;
      }
    }
    
    // Reject names that start with prepositions or articles
    const firstWord = words[0].toLowerCase();
    const badStartWords = ['of', 'the', 'a', 'an', 'is', 'was', 'he', 'she', 'they', 'we'];
    if (badStartWords.includes(firstWord)) {
      return false;
    }
    
    return true;
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Create a new founder scraper service instance
 */
export function createFounderScraperService(): FounderScraperService {
  return new FounderScraperService();
}

// Export default instance
export const founderScraperService = createFounderScraperService();