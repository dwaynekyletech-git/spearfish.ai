/**
 * Common Validation Schemas
 * 
 * Reusable Zod schemas for common data types across the application
 */

import { z } from 'zod';

/**
 * UUID validation schema
 */
export const UuidSchema = z.string().uuid('Must be a valid UUID');

/**
 * Email validation schema
 */
export const EmailSchema = z.string().email('Must be a valid email address');

/**
 * URL validation schema
 */
export const UrlSchema = z.string().url('Must be a valid URL');

/**
 * Non-empty string schema
 */
export const NonEmptyStringSchema = z.string().min(1, 'Cannot be empty');

/**
 * Pagination parameters schema
 */
export const PaginationSchema = z.object({
  page: z.string().transform(val => parseInt(val)).pipe(
    z.number().int().min(1, 'Page must be at least 1')
  ).optional().default('1'),
  limit: z.string().transform(val => parseInt(val)).pipe(
    z.number().int().min(1).max(100, 'Limit must be between 1 and 100')
  ).optional().default('20'),
  sort: z.enum(['asc', 'desc']).optional().default('desc'),
  sortBy: z.string().optional(),
});

/**
 * Company ID parameter schema
 */
export const CompanyIdParamsSchema = z.object({
  id: UuidSchema,
});

/**
 * Search query schema
 */
export const SearchQuerySchema = z.object({
  q: z.string().min(1, 'Search query cannot be empty').optional(),
  filter: z.string().optional(),
  category: z.string().optional(),
});

/**
 * Date range schema
 */
export const DateRangeSchema = z.object({
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
}).refine(
  (data) => {
    if (data.start_date && data.end_date) {
      return new Date(data.start_date) <= new Date(data.end_date);
    }
    return true;
  },
  {
    message: 'Start date must be before end date',
    path: ['end_date'],
  }
);

/**
 * Company stage enum
 */
export const CompanyStageSchema = z.enum([
  'pre-seed',
  'seed',
  'series-a',
  'series-b',
  'series-c',
  'series-d',
  'growth',
  'ipo',
  'acquired',
  'public',
  'unknown'
]);

/**
 * Company size enum
 */
export const CompanySizeSchema = z.enum([
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1001-5000',
  '5001-10000',
  '10000+',
  'unknown'
]);

/**
 * Research priority levels
 */
export const ResearchPrioritySchema = z.enum(['low', 'medium', 'high']);

/**
 * Research types
 */
export const ResearchTypeSchema = z.enum([
  'technical-challenges',
  'business-intelligence',
  'team-dynamics',
  'recent-activities',
  'comprehensive'
]);

/**
 * Email template types
 */
export const EmailTemplateTypeSchema = z.enum([
  'cold_outreach',
  'follow_up',
  'introduction',
  'proposal',
  'thank_you',
  'networking'
]);

/**
 * Project artifact types
 */
export const ProjectArtifactTypeSchema = z.enum([
  'proof_of_concept',
  'feature_proposal',
  'integration_plan',
  'optimization_strategy',
  'analysis_report',
  'custom_solution'
]);

/**
 * User role schema
 */
export const UserRoleSchema = z.enum(['user', 'admin', 'premium']);

/**
 * Score range validation (0-10)
 */
export const ScoreSchema = z.number().min(0).max(10);

/**
 * Currency amount schema (USD)
 */
export const CurrencySchema = z.number().min(0).max(1000000, 'Amount too large');

/**
 * API cost estimation schema
 */
export const CostEstimationSchema = z.object({
  estimated_cost: CurrencySchema,
  max_cost_limit: CurrencySchema.optional(),
  currency: z.enum(['USD']).default('USD'),
});

/**
 * Request metadata schema
 */
export const RequestMetadataSchema = z.object({
  user_agent: z.string().optional(),
  ip_address: z.string().ip().optional(),
  request_id: z.string().optional(),
  timestamp: z.string().datetime().optional(),
});

/**
 * File upload schema
 */
export const FileUploadSchema = z.object({
  filename: z.string().min(1),
  content_type: z.string().min(1),
  size: z.number().int().min(1).max(10 * 1024 * 1024), // 10MB max
});

/**
 * Configuration schema for API endpoints
 */
export const ConfigSchema = z.object({
  timeout_ms: z.number().int().min(1000).max(300000).optional().default(30000),
  retry_count: z.number().int().min(0).max(5).optional().default(3),
  enable_logging: z.boolean().optional().default(true),
});

/**
 * Error response schema
 */
export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  details: z.any().optional(),
  timestamp: z.string().datetime().optional(),
  request_id: z.string().optional(),
});

/**
 * Success response schema
 */
export const SuccessResponseSchema = z.object({
  success: z.literal(true),
  data: z.any().optional(),
  message: z.string().optional(),
  timestamp: z.string().datetime().optional(),
  request_id: z.string().optional(),
});

/**
 * Generic API response schema
 */
export const ApiResponseSchema = z.union([SuccessResponseSchema, ErrorResponseSchema]);

/**
 * Environment-specific validation
 */
export const EnvironmentSchema = z.enum(['development', 'staging', 'production']);

/**
 * Health check response schema
 */
export const HealthCheckSchema = z.object({
  status: z.enum(['ok', 'error', 'degraded']),
  checks: z.record(z.boolean()),
  timestamp: z.string().datetime().optional(),
  version: z.string().optional(),
});