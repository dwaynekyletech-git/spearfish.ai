/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    // Determine if we're in development mode
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    const baseSecurityHeaders = [
      // Prevent the browser from attempting to guess the type of content
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      // Prevent the page from being rendered in a frame (prevents clickjacking)
      {
        key: 'X-Frame-Options',
        value: 'DENY',
      },
      // Enable XSS protection in browsers
      {
        key: 'X-XSS-Protection',
        value: '1; mode=block',
      },
      // Prevent referrer leakage
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
      // Permissions Policy - restrict powerful browser features
      {
        key: 'Permissions-Policy',
        value: [
          'camera=()',
          'microphone=()',
          'geolocation=()',
          'payment=()',
          'usb=()',
          'magnetometer=()',
          'gyroscope=()',
          'speaker=()',
          'fullscreen=(self)',
        ].join(', '),
      },
    ];

    // Environment-specific security headers
    const environmentSpecificHeaders = [];

    // Only add HSTS in production
    if (!isDevelopment) {
      environmentSpecificHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains; preload',
      });
    }

    // Content Security Policy - environment aware
    const cspDirectives = [
      "default-src 'self'",
      // Enhanced script-src to include all Clerk domains
      isDevelopment 
        ? "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.clerk.dev https://*.clerk.com https://*.clerk.accounts.dev https://vercel.live"
        : "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.clerk.dev https://*.clerk.com https://*.clerk.accounts.dev https://vercel.live",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https: blob:",
      // Enhanced connect-src to include all Clerk domains and localhost for development
      isDevelopment
        ? "connect-src 'self' https://*.supabase.co https://*.clerk.dev https://*.clerk.com https://*.clerk.accounts.dev https://api.openai.com https://api.perplexity.ai https://api.github.com wss://*.clerk.dev wss://*.clerk.accounts.dev ws://localhost:* http://localhost:*"
        : "connect-src 'self' https://*.supabase.co https://*.clerk.dev https://*.clerk.com https://*.clerk.accounts.dev https://api.openai.com https://api.perplexity.ai https://api.github.com wss://*.clerk.dev wss://*.clerk.accounts.dev",
      // Enhanced frame-src to include all Clerk domains
      "frame-src 'self' https://*.clerk.dev https://*.clerk.com https://*.clerk.accounts.dev",
      "media-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ];

    // Only add upgrade-insecure-requests in production
    if (!isDevelopment) {
      cspDirectives.push("upgrade-insecure-requests");
    }

    environmentSpecificHeaders.push({
      key: 'Content-Security-Policy',
      value: cspDirectives.join('; '),
    });

    const securityHeaders = [...baseSecurityHeaders, ...environmentSpecificHeaders];

    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        // Additional security for API routes
        source: '/api/(.*)',
        headers: [
          ...securityHeaders,
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;