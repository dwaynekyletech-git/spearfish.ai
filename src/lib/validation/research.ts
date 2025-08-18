/**
 * Research API Validation Schemas
 * 
 * Zod schemas for research-related API endpoints
 */

import { z } from 'zod';
import { 
  UuidSchema, 
  ResearchTypeSchema, 
  ResearchPrioritySchema, 
  CurrencySchema 
} from './common';

/**
 * Start research request schema
 */
export const StartResearchRequestSchema = z.object({
  research_type: ResearchTypeSchema.default('comprehensive'),
  company_data: z.object({
    name: z.string().min(1, 'Company name is required'),
    website: z.string().url().optional(),
    industry: z.string().optional(),
    location: z.string().optional(),
    stage: z.string().optional(),
    size: z.string().optional(),
  }).optional(),
  config: z.object({
    priority: ResearchPrioritySchema.default('medium'),
    max_cost_usd: CurrencySchema.default(5.0),
    timeout_ms: z.number().int().min(10000).max(300000).default(120000),
    enable_synthesis: z.boolean().default(true),
    save_to_database: z.boolean().default(true),
    template_ids: z.array(z.string()).optional(),
  }).optional(),
});

/**
 * Research session progress request schema
 */
export const ResearchProgressParamsSchema = z.object({
  id: UuidSchema, // company ID
  sessionId: UuidSchema,
});

/**
 * Research session results request schema
 */
export const ResearchResultsParamsSchema = z.object({
  id: UuidSchema, // company ID
  sessionId: UuidSchema,
});

/**
 * Research history query schema
 */
export const ResearchHistoryQuerySchema = z.object({
  limit: z.string().transform(val => parseInt(val)).pipe(
    z.number().int().min(1).max(50)
  ).optional().default('10'),
  offset: z.string().transform(val => parseInt(val)).pipe(
    z.number().int().min(0)
  ).optional().default('0'),
  type: ResearchTypeSchema.optional(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
});

/**
 * Research session response schema
 */
export const ResearchSessionResponseSchema = z.object({
  success: z.literal(true),
  session: z.object({
    id: UuidSchema,
    status: z.enum(['pending', 'processing', 'completed', 'failed']),
    progress: z.number().min(0).max(100),
    total_queries: z.number().int().min(0),
    completed_queries: z.number().int().min(0),
    started_at: z.string().datetime(),
    completed_at: z.string().datetime().optional(),
    research_type: ResearchTypeSchema,
    cost_usd: CurrencySchema.optional(),
    error_message: z.string().optional(),
  }),
  message: z.string().optional(),
});

/**
 * Research findings schema
 */
export const ResearchFindingSchema = z.object({
  id: z.string(),
  category: z.string(),
  priority_level: z.enum(['low', 'medium', 'high']),
  finding_type: z.enum([
    'technical_challenge',
    'business_opportunity',
    'team_insight',
    'market_trend',
    'competitive_analysis',
    'problem_identified',
    'solution_opportunity'
  ]),
  title: z.string(),
  description: z.string(),
  confidence: z.number().min(0).max(1),
  sources: z.array(z.object({
    url: z.string().url(),
    title: z.string(),
    snippet: z.string(),
    relevance: z.number().min(0).max(1),
  })),
  tags: z.array(z.string()),
  created_at: z.string().datetime(),
});

/**
 * Research results response schema
 */
export const ResearchResultsResponseSchema = z.object({
  success: z.literal(true),
  session: z.object({
    id: UuidSchema,
    status: z.enum(['pending', 'processing', 'completed', 'failed']),
    progress: z.number().min(0).max(100),
    started_at: z.string().datetime(),
    completed_at: z.string().datetime().optional(),
    research_type: ResearchTypeSchema,
    cost_usd: CurrencySchema.optional(),
  }),
  findings: z.array(ResearchFindingSchema),
  summary: z.object({
    total_findings: z.number().int().min(0),
    high_priority_count: z.number().int().min(0),
    categories: z.array(z.string()),
    key_insights: z.array(z.string()),
    recommendations: z.array(z.string()),
  }).optional(),
});

/**
 * Research configuration schema for testing
 */
export const ResearchTestConfigSchema = z.object({
  test_mode: z.boolean().default(false),
  mock_delay_ms: z.number().int().min(0).max(10000).optional(),
  simulate_error: z.boolean().default(false),
  max_findings: z.number().int().min(1).max(20).default(5),
});

/**
 * Validation for research template IDs
 */
export const ResearchTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(['technical', 'business', 'team', 'market']),
  priority: ResearchPrioritySchema,
  query_template: z.string().min(1),
  cost_estimate: CurrencySchema,
});