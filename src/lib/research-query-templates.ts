import { z } from 'zod';

// Types for research query templates
export interface QueryTemplate {
  id: string;
  name: string;
  description: string;
  category: 'technical' | 'business' | 'team' | 'competitive' | 'market' | 'funding';
  systemPrompt: string;
  queryTemplate: string;
  focusAreas: string[];
  expectedOutputs: string[];
  searchDomains?: string[];
  recencyFilter?: 'hour' | 'day' | 'week' | 'month';
  priority: 'low' | 'medium' | 'high';
}

export interface QueryVariables {
  companyName: string;
  industry?: string;
  foundedYear?: number;
  size?: string;
  stage?: string;
  location?: string;
  website?: string;
  githubRepos?: string[];
  competitors?: string[];
  keyPeople?: string[];
  technologies?: string[];
  focusAreas?: string[];
}

export const RESEARCH_QUERY_TEMPLATES: QueryTemplate[] = [
  // Technical Intelligence Templates
  {
    id: 'technical-challenges',
    name: 'Technical Challenges Analysis',
    description: 'Identify current technical challenges, GitHub issues, and engineering bottlenecks',
    category: 'technical',
    systemPrompt: `You are a senior technical analyst specializing in software engineering challenges. Your task is to identify specific technical problems, engineering bottlenecks, and development challenges that a company is currently facing.

Focus on:
1. Open GitHub issues that indicate technical debt or architectural problems
2. Performance bottlenecks and scaling challenges mentioned in engineering blogs or talks
3. Infrastructure issues, deployment problems, or DevOps challenges
4. Security vulnerabilities or compliance requirements
5. Integration challenges with third-party services or APIs
6. Technical hiring patterns that indicate skill gaps
7. Stack modernization needs or legacy system problems

Provide specific, actionable technical insights with concrete examples and evidence.`,
    queryTemplate: `Analyze the current technical challenges facing {companyName}. Research their GitHub repositories, engineering blog posts, job postings, and recent technical discussions to identify:

1. Open technical issues and bugs that are causing problems
2. Performance bottlenecks and scaling challenges
3. Infrastructure and deployment issues
4. Security vulnerabilities or compliance gaps
5. Integration challenges with external systems
6. Technical debt and architectural problems
7. Specific engineering skills they're hiring for

Focus on finding concrete, solvable technical problems that could be addressed through external expertise, tools, or solutions.`,
    focusAreas: ['GitHub issues', 'performance problems', 'scaling challenges', 'technical debt', 'infrastructure', 'security'],
    expectedOutputs: ['specific technical problems', 'GitHub issue analysis', 'performance bottlenecks', 'infrastructure challenges', 'security concerns'],
    searchDomains: ['github.com', 'stackoverflow.com', 'medium.com', 'dev.to', 'hackernews.com'],
    recencyFilter: 'week',
    priority: 'high'
  },
  
  {
    id: 'tech-stack-analysis',
    name: 'Technology Stack Analysis',
    description: 'Analyze technology choices, architecture decisions, and modernization needs',
    category: 'technical',
    systemPrompt: `You are a technology architect analyzing company technology stacks. Your goal is to understand their current technology choices, identify modernization opportunities, and find areas where they might need external expertise.

Focus on:
1. Current technology stack and architecture patterns
2. Recent technology adoption or migration projects
3. Integration challenges with existing systems
4. Performance optimization needs
5. Cloud migration or infrastructure modernization
6. Developer tool and workflow improvements
7. API strategy and microservices adoption

Provide insights that could lead to consulting opportunities or tool recommendations.`,
    queryTemplate: `Research the technology stack and architecture decisions at {companyName}. Analyze their:

1. Current programming languages, frameworks, and databases
2. Cloud infrastructure and deployment strategies
3. Recent technology migrations or modernization projects
4. Integration patterns and API strategies
5. Development tools and workflows
6. Performance optimization efforts
7. Security and compliance technology requirements

Identify specific areas where they might benefit from external expertise, tools, or architectural guidance.`,
    focusAreas: ['technology stack', 'architecture', 'cloud migration', 'API design', 'performance optimization', 'developer tools'],
    expectedOutputs: ['technology assessment', 'modernization opportunities', 'integration challenges', 'performance needs'],
    searchDomains: ['github.com', 'techcrunch.com', 'stackshare.io', 'medium.com'],
    recencyFilter: 'month',
    priority: 'medium'
  },

  // Business Intelligence Templates
  {
    id: 'business-challenges',
    name: 'Business Challenges Analysis',
    description: 'Identify current business challenges, growth obstacles, and operational problems',
    category: 'business',
    systemPrompt: `You are a business analyst specializing in identifying operational challenges and growth obstacles. Your task is to find specific business problems that could be solved through external partnerships, tools, or expertise.

Focus on:
1. Revenue growth challenges and customer acquisition problems
2. Operational inefficiencies and process bottlenecks
3. Market expansion difficulties and competitive pressures
4. Regulatory compliance and legal challenges
5. Customer retention and satisfaction issues
6. Supply chain or vendor management problems
7. Data analysis and business intelligence gaps

Provide actionable business insights that reveal opportunities for external solutions.`,
    queryTemplate: `Analyze the current business challenges facing {companyName}. Research their recent activities, press releases, and industry discussions to identify:

1. Revenue growth obstacles and customer acquisition challenges
2. Operational inefficiencies and process problems
3. Market expansion difficulties and competitive threats
4. Regulatory compliance or legal challenges
5. Customer satisfaction and retention issues
6. Data analysis and business intelligence needs
7. Partnership and vendor management challenges

Focus on finding specific business problems that could be addressed through external consulting, tools, or strategic partnerships.`,
    focusAreas: ['revenue growth', 'customer acquisition', 'operational efficiency', 'market expansion', 'compliance', 'data analysis'],
    expectedOutputs: ['business challenges', 'growth obstacles', 'operational problems', 'market opportunities'],
    searchDomains: ['crunchbase.com', 'linkedin.com', 'techcrunch.com', 'businessinsider.com'],
    recencyFilter: 'month',
    priority: 'high'
  },

  {
    id: 'recent-activities',
    name: 'Recent Company Activities',
    description: 'Track recent product launches, funding, partnerships, and strategic initiatives',
    category: 'business',
    systemPrompt: `You are a business intelligence analyst tracking recent company activities. Your goal is to identify recent developments that indicate business priorities, challenges, or opportunities.

Focus on:
1. Product launches and feature releases
2. Funding rounds and investment activities
3. Partnership announcements and strategic alliances
4. Hiring patterns and team expansion
5. Market expansion and new customer segments
6. Regulatory announcements and compliance updates
7. Competitive responses and positioning changes

Provide insights that reveal current business priorities and potential collaboration opportunities.`,
    queryTemplate: `Research recent activities and developments at {companyName} over the past 3 months. Analyze:

1. Product launches, feature releases, and roadmap updates
2. Funding announcements and investment activities
3. Partnership deals and strategic alliances
4. Key hires and team expansions
5. Market expansion efforts and new customer segments
6. Press releases and media coverage
7. Competitive moves and market positioning changes

Identify patterns that reveal their current business priorities and areas where they might need external support.`,
    focusAreas: ['product launches', 'funding', 'partnerships', 'hiring', 'market expansion', 'press coverage'],
    expectedOutputs: ['recent developments', 'business priorities', 'partnership opportunities', 'growth indicators'],
    searchDomains: ['crunchbase.com', 'techcrunch.com', 'businesswire.com', 'linkedin.com'],
    recencyFilter: 'week',
    priority: 'medium'
  },

  // Team Dynamics Templates
  {
    id: 'key-decision-makers',
    name: 'Key Decision Makers Analysis',
    description: 'Identify key personnel, decision makers, and their professional interests',
    category: 'team',
    systemPrompt: `You are an executive research analyst specializing in identifying key decision makers and understanding their professional interests. Your goal is to find the right people to engage with and understand their priorities.

Focus on:
1. C-level executives and their backgrounds
2. Department heads and team leaders
3. Recent hires in key positions
4. Board members and advisors
5. Professional interests and expertise areas
6. Speaking engagements and thought leadership
7. Previous company experience and networks

Provide insights that enable personalized, relevant outreach to key stakeholders.`,
    queryTemplate: `Research the key decision makers and leadership team at {companyName}. Analyze:

1. C-level executives: CEO, CTO, CPO, etc. and their backgrounds
2. Department heads in engineering, product, sales, and marketing
3. Recent executive hires and their previous experience
4. Board members and advisors
5. Their professional interests, expertise areas, and thought leadership
6. Speaking engagements, conference appearances, and publications
7. Previous company experience and professional networks

Focus on understanding their priorities, challenges, and areas of expertise to enable relevant, personalized engagement.`,
    focusAreas: ['executives', 'decision makers', 'professional backgrounds', 'thought leadership', 'expertise areas'],
    expectedOutputs: ['key personnel', 'decision maker profiles', 'professional interests', 'engagement strategies'],
    searchDomains: ['linkedin.com', 'crunchbase.com', 'twitter.com', 'medium.com'],
    recencyFilter: 'month',
    priority: 'high'
  },

  {
    id: 'hiring-patterns',
    name: 'Hiring Patterns Analysis',
    description: 'Analyze hiring trends, skill gaps, and team expansion priorities',
    category: 'team',
    systemPrompt: `You are a talent analytics specialist analyzing hiring patterns to identify skill gaps and team expansion priorities. Your goal is to understand what capabilities a company is building and where they might need external support.

Focus on:
1. Active job postings and role requirements
2. Recent hires and their skill sets
3. Skill gaps indicated by hiring patterns
4. Team expansion priorities by department
5. Salary ranges and compensation strategies
6. Remote work policies and talent acquisition strategies
7. Partnerships with recruiting firms or talent platforms

Provide insights that reveal capability gaps and potential collaboration opportunities.`,
    queryTemplate: `Analyze the hiring patterns and talent acquisition strategy at {companyName}. Research:

1. Current job postings and role requirements
2. Recent hires and their professional backgrounds
3. Skill gaps indicated by repeated hiring in specific areas
4. Team expansion priorities across different departments
5. Compensation ranges and talent acquisition strategies
6. Remote work policies and geographic hiring patterns
7. Use of recruiting firms, talent platforms, or hiring partnerships

Identify areas where they're struggling to find talent or where external expertise could supplement their team.`,
    focusAreas: ['job postings', 'hiring trends', 'skill gaps', 'team expansion', 'talent acquisition'],
    expectedOutputs: ['hiring priorities', 'skill gaps', 'team expansion plans', 'talent challenges'],
    searchDomains: ['linkedin.com', 'glassdoor.com', 'indeed.com', 'angellist.com'],
    recencyFilter: 'week',
    priority: 'medium'
  },

  // Competitive Analysis Templates
  {
    id: 'competitive-landscape',
    name: 'Competitive Landscape Analysis',
    description: 'Analyze competitive positioning, market share, and differentiation strategies',
    category: 'competitive',
    systemPrompt: `You are a competitive intelligence analyst specializing in market positioning and competitive strategy. Your goal is to understand how a company positions itself relative to competitors and identify opportunities for differentiation.

Focus on:
1. Direct and indirect competitors
2. Market positioning and differentiation strategies
3. Competitive advantages and weaknesses
4. Recent competitive moves and responses
5. Market share and customer overlap
6. Pricing strategies and value propositions
7. Product feature comparisons and gaps

Provide insights that reveal competitive vulnerabilities and positioning opportunities.`,
    queryTemplate: `Analyze the competitive landscape and market positioning of {companyName}. Research:

1. Direct competitors and their market positioning
2. Indirect competitors and alternative solutions
3. Competitive advantages and differentiation strategies
4. Recent competitive moves and market responses
5. Market share estimates and customer overlap
6. Pricing strategies and value proposition comparisons
7. Product feature gaps and competitive vulnerabilities

Identify areas where they might need strategic support, competitive intelligence, or positioning assistance.`,
    focusAreas: ['competitors', 'market positioning', 'differentiation', 'competitive advantages', 'market share'],
    expectedOutputs: ['competitive analysis', 'market positioning', 'differentiation opportunities', 'competitive threats'],
    searchDomains: ['crunchbase.com', 'g2.com', 'capterra.com', 'techcrunch.com'],
    recencyFilter: 'month',
    priority: 'medium'
  },

  // Market Analysis Templates
  {
    id: 'market-opportunities',
    name: 'Market Opportunities Analysis',
    description: 'Identify market trends, expansion opportunities, and customer segments',
    category: 'market',
    systemPrompt: `You are a market research analyst identifying growth opportunities and market trends. Your goal is to find market expansion opportunities, emerging customer segments, and industry trends that could impact the company.

Focus on:
1. Emerging market trends and opportunities
2. New customer segments and use cases
3. Geographic expansion possibilities
4. Industry regulatory changes and compliance requirements
5. Technology trends affecting the market
6. Partnership and channel opportunities
7. Market sizing and growth projections

Provide insights that reveal market opportunities and potential growth strategies.`,
    queryTemplate: `Research market opportunities and industry trends relevant to {companyName}. Analyze:

1. Emerging market trends and growth opportunities in their industry
2. New customer segments and expanding use cases
3. Geographic markets for potential expansion
4. Industry regulatory changes and compliance requirements
5. Technology trends affecting their market
6. Partnership and distribution channel opportunities
7. Market sizing estimates and growth projections

Identify specific market opportunities where they might need strategic guidance, market research, or expansion support.`,
    focusAreas: ['market trends', 'growth opportunities', 'customer segments', 'geographic expansion', 'industry regulations'],
    expectedOutputs: ['market opportunities', 'industry trends', 'growth strategies', 'expansion possibilities'],
    searchDomains: ['gartner.com', 'forrester.com', 'techcrunch.com', 'businessinsider.com'],
    recencyFilter: 'month',
    priority: 'medium'
  },

  // Funding Analysis Templates
  {
    id: 'funding-analysis',
    name: 'Funding and Investment Analysis',
    description: 'Analyze funding history, investor relationships, and capital needs',
    category: 'funding',
    systemPrompt: `You are an investment analyst specializing in startup funding and investor relations. Your goal is to understand a company's funding history, investor relationships, and potential capital needs.

Focus on:
1. Funding history and investment rounds
2. Investor profiles and investment thesis
3. Board composition and investor influence
4. Financial milestones and growth metrics
5. Potential funding needs and timing
6. Investor network and partnership opportunities
7. Valuation trends and market comparisons

Provide insights that reveal funding patterns, investor priorities, and potential capital needs.`,
    queryTemplate: `Research the funding history and investment landscape for {companyName}. Analyze:

1. Previous funding rounds, amounts, and investor participation
2. Investor profiles, investment thesis, and portfolio companies
3. Board composition and investor representation
4. Reported financial milestones and growth metrics
5. Potential upcoming funding needs and timing signals
6. Investor network connections and partnership opportunities
7. Valuation trends and comparisons to similar companies

Identify patterns that indicate funding priorities, investor influence, and potential capital needs.`,
    focusAreas: ['funding rounds', 'investors', 'valuation', 'financial metrics', 'board composition'],
    expectedOutputs: ['funding analysis', 'investor profiles', 'capital needs', 'financial milestones'],
    searchDomains: ['crunchbase.com', 'pitchbook.com', 'techcrunch.com', 'venturebeat.com'],
    recencyFilter: 'month',
    priority: 'low'
  }
];

// Query template processing functions
export class ResearchQueryTemplateProcessor {
  
  static processTemplate(template: QueryTemplate, variables: QueryVariables): {
    systemPrompt: string;
    query: string;
    searchDomains?: string[];
    recencyFilter?: string;
  } {
    let processedQuery = template.queryTemplate;
    let processedSystemPrompt = template.systemPrompt;
    
    // Replace variables in query template
    Object.entries(variables).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        const placeholder = `{${key}}`;
        const replacement = Array.isArray(value) ? value.join(', ') : String(value);
        processedQuery = processedQuery.replace(new RegExp(placeholder, 'g'), replacement);
      }
    });
    
    // Add focus areas if provided
    if (variables.focusAreas && variables.focusAreas.length > 0) {
      processedQuery += `\n\nPay special attention to these focus areas: ${variables.focusAreas.join(', ')}`;
    }
    
    // Add competitor context if provided
    if (variables.competitors && variables.competitors.length > 0) {
      processedQuery += `\n\nConsider these competitors in your analysis: ${variables.competitors.join(', ')}`;
    }
    
    // Add technology context if provided
    if (variables.technologies && variables.technologies.length > 0) {
      processedQuery += `\n\nRelevant technologies to consider: ${variables.technologies.join(', ')}`;
    }
    
    return {
      systemPrompt: processedSystemPrompt,
      query: processedQuery,
      searchDomains: template.searchDomains,
      recencyFilter: template.recencyFilter
    };
  }
  
  static getTemplatesByCategory(category: QueryTemplate['category']): QueryTemplate[] {
    return RESEARCH_QUERY_TEMPLATES.filter(template => template.category === category);
  }
  
  static getTemplateById(id: string): QueryTemplate | undefined {
    return RESEARCH_QUERY_TEMPLATES.find(template => template.id === id);
  }
  
  static getHighPriorityTemplates(): QueryTemplate[] {
    return RESEARCH_QUERY_TEMPLATES.filter(template => template.priority === 'high');
  }
  
  static validateVariables(variables: QueryVariables): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!variables.companyName || variables.companyName.trim().length === 0) {
      errors.push('Company name is required');
    }
    
    if (variables.foundedYear && (variables.foundedYear < 1800 || variables.foundedYear > new Date().getFullYear())) {
      errors.push('Founded year must be between 1800 and current year');
    }
    
    if (variables.githubRepos && variables.githubRepos.some(repo => !repo.includes('github.com'))) {
      errors.push('GitHub repositories must be valid GitHub URLs');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Research session configuration
export interface ResearchSessionConfig {
  companyName: string;
  templateIds: string[];
  variables: QueryVariables;
  priority: 'high' | 'medium' | 'low';
  maxConcurrentQueries: number;
  timeoutMs: number;
}

export const DEFAULT_RESEARCH_SESSION_CONFIG: Partial<ResearchSessionConfig> = {
  templateIds: ['technical-challenges', 'business-challenges', 'key-decision-makers', 'recent-activities'],
  priority: 'medium',
  maxConcurrentQueries: 3,
  timeoutMs: 30000
};

export default ResearchQueryTemplateProcessor;