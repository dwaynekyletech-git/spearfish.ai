/**
 * CSRF Protection Utility
 * 
 * Provides Cross-Site Request Forgery (CSRF) protection for API routes.
 * Validates that requests come from the expected origin and include proper headers.
 */

import { NextRequest } from 'next/server';
import { getEnv } from '../env-validation';
import { logWarn } from '../logger';

/**
 * CSRF validation result
 */
interface CsrfValidationResult {
  isValid: boolean;
  error?: string;
  details?: {
    origin?: string;
    referer?: string;
    userAgent?: string;
    ip?: string;
  };
}

/**
 * Configuration for CSRF protection
 */
interface CsrfConfig {
  allowedOrigins?: string[];
  requireReferer?: boolean;
  allowSameOrigin?: boolean;
  trustedProxies?: string[];
}

/**
 * Get the base URL for the application
 */
function getBaseUrl(): string {
  const envBaseUrl = getEnv('NEXT_PUBLIC_BASE_URL');
  if (envBaseUrl) {
    return envBaseUrl;
  }

  // Fallback based on environment
  const environment = getEnv('NEXT_PUBLIC_ENVIRONMENT');
  switch (environment) {
    case 'production':
      return 'https://spearfish-ai.vercel.app'; // Update with actual production URL
    case 'staging':
      return 'https://spearfish-ai-staging.vercel.app'; // Update with actual staging URL
    default:
      return 'http://localhost:3000';
  }
}

/**
 * Get allowed origins for CSRF validation
 */
function getAllowedOrigins(config?: CsrfConfig): string[] {
  const baseUrl = getBaseUrl();
  const defaultOrigins = [baseUrl];

  // Add development origins in non-production
  const environment = getEnv('NEXT_PUBLIC_ENVIRONMENT');
  if (environment === 'development') {
    defaultOrigins.push(
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001'
    );
  }

  return config?.allowedOrigins ? [...defaultOrigins, ...config.allowedOrigins] : defaultOrigins;
}

/**
 * Extract the real IP address from the request, considering proxies
 */
function getRealIpAddress(request: NextRequest, trustedProxies: string[] = []): string {
  // Check for forwarded headers (from trusted proxies)
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip'); // Cloudflare

  // Use CF-Connecting-IP if available (Cloudflare)
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // Use X-Real-IP if available
  if (realIp) {
    return realIp;
  }

  // Use first IP from X-Forwarded-For if available
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map(ip => ip.trim());
    return ips[0];
  }

  // Fallback to connection IP (may be proxy IP)
  return request.ip || 'unknown';
}

/**
 * Validate CSRF token/origin for the given request
 * @param request - The incoming request
 * @param config - Optional CSRF configuration
 * @returns Validation result
 */
export function validateCsrfProtection(
  request: NextRequest,
  config: CsrfConfig = {}
): CsrfValidationResult {
  const {
    requireReferer = true,
    allowSameOrigin = true,
    trustedProxies = [],
  } = config;

  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const userAgent = request.headers.get('user-agent') || '';
  const ip = getRealIpAddress(request, trustedProxies);

  const details = {
    origin: origin || undefined,
    referer: referer || undefined,
    userAgent,
    ip,
  };

  // Get allowed origins
  const allowedOrigins = getAllowedOrigins(config);

  // Check if origin is present and allowed
  if (!origin) {
    logWarn('CSRF validation failed: Missing origin header', { 
      endpoint: request.url,
      ip,
      userAgent,
    });
    
    return {
      isValid: false,
      error: 'Missing origin header',
      details,
    };
  }

  // Validate origin against allowed origins
  const isOriginAllowed = allowedOrigins.some(allowedOrigin => {
    try {
      const originUrl = new URL(origin);
      const allowedUrl = new URL(allowedOrigin);
      
      // Allow same origin
      if (allowSameOrigin && originUrl.origin === allowedUrl.origin) {
        return true;
      }

      // Check if origin matches allowed origin exactly
      return originUrl.origin === allowedUrl.origin;
    } catch (error) {
      return false;
    }
  });

  if (!isOriginAllowed) {
    logWarn('CSRF validation failed: Origin not allowed', {
      origin,
      allowedOrigins,
      endpoint: request.url,
      ip,
      userAgent,
    });

    return {
      isValid: false,
      error: `Origin '${origin}' is not allowed`,
      details,
    };
  }

  // Validate referer if required
  if (requireReferer && !referer) {
    logWarn('CSRF validation failed: Missing referer header', {
      origin,
      endpoint: request.url,
      ip,
      userAgent,
    });

    return {
      isValid: false,
      error: 'Missing referer header',
      details,
    };
  }

  if (requireReferer && referer) {
    try {
      const refererUrl = new URL(referer);
      const originUrl = new URL(origin);

      if (refererUrl.origin !== originUrl.origin) {
        logWarn('CSRF validation failed: Referer origin mismatch', {
          origin,
          referer,
          endpoint: request.url,
          ip,
          userAgent,
        });

        return {
          isValid: false,
          error: 'Referer origin does not match request origin',
          details,
        };
      }
    } catch (error) {
      logWarn('CSRF validation failed: Invalid referer URL', {
        origin,
        referer,
        endpoint: request.url,
        ip,
        userAgent,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        isValid: false,
        error: 'Invalid referer URL format',
        details,
      };
    }
  }

  // Validation passed
  return {
    isValid: true,
    details,
  };
}

/**
 * Middleware function to verify CSRF protection
 * Throws an error if validation fails
 * @param request - The incoming request
 * @param config - Optional CSRF configuration
 */
export function verifyCsrf(request: NextRequest, config?: CsrfConfig): void {
  const result = validateCsrfProtection(request, config);
  
  if (!result.isValid) {
    const error = new Error(`CSRF validation failed: ${result.error}`);
    error.name = 'CsrfValidationError';
    throw error;
  }
}

/**
 * Check if a request needs CSRF protection
 * Only mutation methods (POST, PUT, DELETE, PATCH) need CSRF protection
 * @param request - The incoming request
 * @returns Whether the request needs CSRF protection
 */
export function needsCsrfProtection(request: NextRequest): boolean {
  const method = request.method.toUpperCase();
  return ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
}

/**
 * Express-style middleware wrapper for CSRF protection
 * @param config - Optional CSRF configuration
 * @returns Middleware function
 */
export function csrfProtectionMiddleware(config?: CsrfConfig) {
  return function(request: NextRequest): void {
    if (needsCsrfProtection(request)) {
      verifyCsrf(request, config);
    }
  };
}

/**
 * Get CSRF configuration for different environments
 */
export function getCsrfConfig(): CsrfConfig {
  const environment = getEnv('NEXT_PUBLIC_ENVIRONMENT');
  
  switch (environment) {
    case 'production':
      return {
        requireReferer: true,
        allowSameOrigin: true,
        trustedProxies: ['cloudflare', 'vercel'],
      };
    case 'staging':
      return {
        requireReferer: true,
        allowSameOrigin: true,
        trustedProxies: ['vercel'],
      };
    default: // development
      return {
        requireReferer: false, // More lenient in development
        allowSameOrigin: true,
        allowedOrigins: [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://127.0.0.1:3000',
          'http://127.0.0.1:3001',
        ],
      };
  }
}

const CsrfProtection = {
  validate: validateCsrfProtection,
  verify: verifyCsrf,
  middleware: csrfProtectionMiddleware,
  needsProtection: needsCsrfProtection,
  getConfig: getCsrfConfig,
};

export default CsrfProtection;