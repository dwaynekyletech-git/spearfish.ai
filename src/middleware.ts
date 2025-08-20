import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Define protected routes that require authentication
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/profile(.*)',
  '/companies(.*)',
  '/settings(.*)',
  '/admin(.*)',
  '/api/companies(.*)',
  '/api/company-data(.*)',
  '/api/user(.*)',
  '/api/admin(.*)',
]);

// Define public routes that should not be protected
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
]);

// Define AI API routes that need cost monitoring (custom function)
function isAIApiRoute(req: Request): boolean {
  const pathname = new URL(req.url).pathname;
  
  // Check for AI-related API routes
  const aiRoutePatterns = [
    /^\/api\/companies\/[^\/]+\/research/,
    /^\/api\/companies\/[^\/]+\/emails/,
    /^\/api\/companies\/[^\/]+\/artifacts/,
    /^\/api\/companies\/[^\/]+\/agent/,
    /^\/api\/scoring/,
  ];
  
  return aiRoutePatterns.some(pattern => pattern.test(pathname));
}

// Initialize rate limiters (only if Redis is available)
let ratelimit: Ratelimit | null = null;
let companyDataRateLimit: Ratelimit | null = null;
let redis: Redis | null = null;

if (process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_URL,
    token: process.env.UPSTASH_REDIS_TOKEN,
  });

  // Default rate limiter for most endpoints
  ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      parseInt(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE || '60'), 
      '1 m'
    ),
    analytics: true,
  });

  // More generous rate limiter for company-data endpoint (cached responses)
  companyDataRateLimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      parseInt(process.env.COMPANY_DATA_RATE_LIMIT || '200'), // 200 requests per minute
      '1 m'
    ),
    analytics: true,
    prefix: 'company-data-rl',
  });
}

// Circuit breaker state management
const CIRCUIT_BREAKER_THRESHOLD = 10; // Number of failures before opening circuit
const CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute timeout
const CIRCUIT_BREAKER_SUCCESS_THRESHOLD = 3; // Successes needed to close circuit

interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailure: number;
  successCount: number;
}

let circuitBreakerState: CircuitBreakerState = {
  state: 'closed',
  failureCount: 0,
  lastFailure: 0,
  successCount: 0,
};

export default clerkMiddleware(async (auth, req) => {
  const startTime = Date.now();
  const pathname = req.nextUrl.pathname;
  const userAgent = req.headers.get('user-agent') || '';
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

  // Handle API routes with enhanced monitoring and protection
  if (pathname.startsWith('/api/')) {
    
    // 1. Rate Limiting (if enabled)
    if (!pathname.startsWith('/api/health')) {
      try {
        const identifier = ip;
        let rateLimiter: Ratelimit | null = null;
        
        // Skip rate limiting in development for localhost
        const isDevelopment = process.env.NODE_ENV === 'development';
        const isLocalhost = ip === '::1' || ip === '127.0.0.1' || ip.startsWith('::ffff:127.0.0.1');
        
        if (isDevelopment && isLocalhost) {
          // Skip rate limiting for local development
          // Continue to next middleware steps
        } else {
          // Use specific rate limiter for company-data endpoint
          if (pathname === '/api/company-data') {
            rateLimiter = companyDataRateLimit;
          } else {
            rateLimiter = ratelimit;
          }
          
          if (rateLimiter) {
            const { success, limit, reset, remaining } = await rateLimiter.limit(identifier);
            
            if (!success) {
              console.warn(`Rate limit exceeded for ${identifier} on ${pathname} (limit: ${limit})`);
              return NextResponse.json(
                { 
                  error: 'Rate limit exceeded',
                  limit,
                  reset: new Date(reset),
                  remaining,
                  retryAfter: Math.round((reset - Date.now()) / 1000),
                  endpoint: pathname
                },
                { 
                  status: 429,
                  headers: {
                    'X-RateLimit-Limit': limit.toString(),
                    'X-RateLimit-Remaining': remaining.toString(),
                    'X-RateLimit-Reset': reset.toString(),
                    'Retry-After': Math.round((reset - Date.now()) / 1000).toString(),
                    'X-RateLimit-Endpoint': pathname,
                  }
                }
              );
            }
            
            // Add rate limit headers to successful requests
            const response = NextResponse.next();
            response.headers.set('X-RateLimit-Limit', limit.toString());
            response.headers.set('X-RateLimit-Remaining', remaining.toString());
            response.headers.set('X-RateLimit-Reset', reset.toString());
            response.headers.set('X-RateLimit-Endpoint', pathname);
          }
        }
      } catch (error) {
        console.error('Rate limiting error:', error);
        // Continue without rate limiting if there's an error
      }
    }

    // 2. Circuit Breaker for AI API routes
    if (isAIApiRoute(req)) {
      const circuitState = await checkCircuitBreaker();
      
      if (circuitState === 'open') {
        console.warn(`Circuit breaker OPEN for AI APIs - blocking request to ${pathname}`);
        return NextResponse.json(
          { 
            error: 'Service temporarily unavailable',
            message: 'AI services are temporarily disabled due to high error rates. Please try again later.',
            circuitBreakerState: 'open',
            retryAfter: Math.round((circuitBreakerState.lastFailure + CIRCUIT_BREAKER_TIMEOUT - Date.now()) / 1000)
          },
          { 
            status: 503,
            headers: {
              'Retry-After': Math.round((circuitBreakerState.lastFailure + CIRCUIT_BREAKER_TIMEOUT - Date.now()) / 1000).toString(),
              'X-Circuit-Breaker': 'open'
            }
          }
        );
      }

      // Add circuit breaker headers
      const response = NextResponse.next();
      response.headers.set('X-Circuit-Breaker', circuitState);
      response.headers.set('X-Request-Start-Time', startTime.toString());
      
      return response;
    }

    // 3. Cost monitoring preparation (add headers for API routes to use)
    const response = NextResponse.next();
    response.headers.set('X-Request-Start-Time', startTime.toString());
    response.headers.set('X-User-IP', ip);
    response.headers.set('X-User-Agent', userAgent);
    
    // Get user ID for cost tracking
    try {
      const { userId } = await auth();
      if (userId) {
        response.headers.set('X-User-ID', userId);
      }
    } catch (error) {
      // Continue without user ID if auth fails
    }
    
    return response;
  }
  
  // Protect page routes that require authentication, but not public routes
  if (isProtectedRoute(req) && !isPublicRoute(req)) {
    await auth.protect();
  }
});

// Circuit breaker logic
async function checkCircuitBreaker(): Promise<'closed' | 'open' | 'half-open'> {
  const now = Date.now();
  
  switch (circuitBreakerState.state) {
    case 'open':
      // Check if timeout has passed
      if (now - circuitBreakerState.lastFailure > CIRCUIT_BREAKER_TIMEOUT) {
        circuitBreakerState.state = 'half-open';
        circuitBreakerState.successCount = 0;
        console.log('Circuit breaker moving to HALF-OPEN state');
      }
      break;
      
    case 'half-open':
      // Allow limited requests to test if service is recovered
      break;
      
    case 'closed':
    default:
      // Normal operation
      break;
  }
  
  return circuitBreakerState.state;
}

// Functions to be called by API routes to update circuit breaker state
export function recordCircuitBreakerSuccess() {
  if (circuitBreakerState.state === 'half-open') {
    circuitBreakerState.successCount++;
    if (circuitBreakerState.successCount >= CIRCUIT_BREAKER_SUCCESS_THRESHOLD) {
      circuitBreakerState.state = 'closed';
      circuitBreakerState.failureCount = 0;
      circuitBreakerState.successCount = 0;
      console.log('Circuit breaker CLOSED - service recovered');
    }
  } else if (circuitBreakerState.state === 'closed') {
    // Reset failure count on successful requests
    if (circuitBreakerState.failureCount > 0) {
      circuitBreakerState.failureCount = Math.max(0, circuitBreakerState.failureCount - 1);
    }
  }
}

export function recordCircuitBreakerFailure() {
  circuitBreakerState.failureCount++;
  circuitBreakerState.lastFailure = Date.now();
  
  if (circuitBreakerState.state === 'closed' && 
      circuitBreakerState.failureCount >= CIRCUIT_BREAKER_THRESHOLD) {
    circuitBreakerState.state = 'open';
    console.log(`Circuit breaker OPENED after ${circuitBreakerState.failureCount} failures`);
  } else if (circuitBreakerState.state === 'half-open') {
    circuitBreakerState.state = 'open';
    console.log('Circuit breaker returned to OPEN state after failure in half-open');
  }
}

export function getCircuitBreakerState() {
  return { ...circuitBreakerState };
}

export function resetCircuitBreaker() {
  circuitBreakerState = {
    state: 'closed',
    failureCount: 0,
    lastFailure: 0,
    successCount: 0,
  };
  console.log('Circuit breaker manually reset to CLOSED state');
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};