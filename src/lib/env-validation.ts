/**
 * Environment Variable Validation
 * 
 * This module validates all required environment variables at startup
 * using Zod schemas to ensure proper configuration and prevent runtime errors.
 */

import { z } from 'zod';

// Schema for required environment variables
const EnvSchema = z.object({
  // Database Configuration (Required)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('Must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Supabase service role key is required'),

  // Authentication (Required)
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1, 'Clerk publishable key is required'),
  CLERK_SECRET_KEY: z.string().min(1, 'Clerk secret key is required'),

  // AI APIs (Required)
  OPENAI_API_KEY: z.string().regex(/^sk-/, 'OpenAI API key must start with sk-'),
  PERPLEXITY_API_KEY: z.string().regex(/^pplx-/, 'Perplexity API key must start with pplx-'),

  // GitHub API (Optional)
  GITHUB_TOKEN: z.string().regex(/^ghp_/, 'GitHub token must start with ghp-').optional(),

  // Cost Controls (Required)
  MAX_DAILY_API_COST_USD: z.string().transform(val => parseFloat(val)).pipe(
    z.number().positive('Must be a positive number')
  ).optional().default('100'),
  MAX_USER_DAILY_COST_USD: z.string().transform(val => parseFloat(val)).pipe(
    z.number().positive('Must be a positive number')
  ).optional().default('10'),

  // Clerk Configuration (Required)
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().default('/sign-in'),
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().default('/sign-up'),

  // Application Configuration (Optional)
  NEXT_PUBLIC_ENVIRONMENT: z.enum(['development', 'staging', 'production']).default('development'),
  NEXT_PUBLIC_BASE_URL: z.string().url().optional(),

  // Caching (Optional)
  UPSTASH_REDIS_URL: z.string().url().optional(),
  UPSTASH_REDIS_TOKEN: z.string().optional(),

  // Logging (Optional)
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Rate Limiting (Optional)
  RATE_LIMIT_REQUESTS_PER_MINUTE: z.string().transform(val => parseInt(val)).pipe(
    z.number().positive()
  ).optional().default('60'),

  // Cron Job Security (Required for production)
  CRON_SECRET: z.string().min(8, 'Cron secret must be at least 8 characters'),
});

// Type for validated environment variables
export type ValidatedEnv = z.infer<typeof EnvSchema>;

let validatedEnv: ValidatedEnv | null = null;

/**
 * Validates environment variables on first call and caches the result
 * @returns Validated environment variables
 * @throws Error if validation fails
 */
export function getValidatedEnv(): ValidatedEnv {
  if (validatedEnv) {
    return validatedEnv;
  }

  try {
    validatedEnv = EnvSchema.parse(process.env);
    return validatedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      throw new Error(`Environment validation failed:\n${errorMessages.join('\n')}`);
    }
    throw error;
  }
}

/**
 * Validates environment variables and logs the result
 * Should be called at application startup
 */
export function validateEnvironment(): void {
  try {
    getValidatedEnv();
    console.log('✅ Environment validation successful');
  } catch (error) {
    console.error('❌ Environment validation failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Get a specific environment variable with type safety
 * @param key - Environment variable key
 * @returns The environment variable value
 */
export function getEnv<K extends keyof ValidatedEnv>(key: K): ValidatedEnv[K] {
  return getValidatedEnv()[key];
}

/**
 * Check if we're in production environment
 */
export function isProduction(): boolean {
  return getEnv('NEXT_PUBLIC_ENVIRONMENT') === 'production';
}

/**
 * Check if we're in development environment
 */
export function isDevelopment(): boolean {
  return getEnv('NEXT_PUBLIC_ENVIRONMENT') === 'development';
}