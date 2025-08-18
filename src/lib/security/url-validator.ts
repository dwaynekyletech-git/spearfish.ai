/**
 * SSRF (Server-Side Request Forgery) Protection
 * 
 * Validates URLs to prevent SSRF attacks by blocking requests to private IP ranges,
 * localhost, and other potentially dangerous destinations.
 */

import { logWarn, logError } from '../logger';

/**
 * Private IP ranges that should be blocked
 */
const PRIVATE_IP_RANGES = [
  // IPv4 Private ranges
  /^127\./,                    // 127.0.0.0/8 (loopback)
  /^10\./,                     // 10.0.0.0/8 (private)
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // 172.16.0.0/12 (private)
  /^192\.168\./,               // 192.168.0.0/16 (private)
  /^169\.254\./,               // 169.254.0.0/16 (link-local)
  /^0\./,                      // 0.0.0.0/8 (current network)
  /^224\./,                    // 224.0.0.0/4 (multicast)
  /^240\./,                    // 240.0.0.0/4 (reserved)
  
  // IPv6 ranges
  /^::1$/,                     // IPv6 loopback
  /^::/,                       // IPv6 unspecified
  /^fe80:/,                    // IPv6 link-local
  /^fc00:/,                    // IPv6 unique local
  /^fd00:/,                    // IPv6 unique local
];

/**
 * Blocked hostnames
 */
const BLOCKED_HOSTNAMES = [
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'broadcasthost',
  // AWS metadata endpoints
  '169.254.169.254',
  // GCP metadata endpoints
  'metadata.google.internal',
  // Azure metadata endpoints
  '169.254.169.254',
];

/**
 * Allowed protocols for external requests
 */
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

/**
 * Configuration for URL validation
 */
interface UrlValidationConfig {
  allowPrivateIPs?: boolean;
  allowedProtocols?: string[];
  allowedDomains?: string[];
  blockedDomains?: string[];
  maxRedirects?: number;
}

/**
 * Result of URL validation
 */
interface UrlValidationResult {
  isValid: boolean;
  error?: string;
  details?: {
    originalUrl: string;
    hostname: string;
    protocol: string;
    ip?: string;
  };
}

/**
 * Check if an IP address is in a private range
 * @param ip - IP address to check
 * @returns True if the IP is private
 */
function isPrivateIP(ip: string): boolean {
  return PRIVATE_IP_RANGES.some(range => range.test(ip));
}

/**
 * Check if a hostname is blocked
 * @param hostname - Hostname to check
 * @returns True if the hostname is blocked
 */
function isBlockedHostname(hostname: string): boolean {
  return BLOCKED_HOSTNAMES.includes(hostname.toLowerCase());
}

/**
 * Resolve hostname to IP address (simplified - in production use dns.lookup)
 * @param hostname - Hostname to resolve
 * @returns IP address or null if resolution fails
 */
async function resolveHostname(hostname: string): Promise<string | null> {
  try {
    // In a browser environment, we can't do DNS resolution
    // This is a simplified check for common cases
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return '127.0.0.1';
    }
    
    if (hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      return hostname; // Already an IP
    }
    
    // For actual production use, implement proper DNS resolution
    // using Node.js dns module on server side
    return null;
  } catch (error) {
    logError('Failed to resolve hostname', { hostname, error });
    return null;
  }
}

/**
 * Validate a URL for SSRF protection
 * @param url - URL to validate
 * @param config - Validation configuration
 * @returns Validation result
 */
export async function validateUrl(
  url: string,
  config: UrlValidationConfig = {}
): Promise<UrlValidationResult> {
  const {
    allowPrivateIPs = false,
    allowedProtocols = ALLOWED_PROTOCOLS,
    allowedDomains,
    blockedDomains = [],
    maxRedirects = 0,
  } = config;

  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    const protocol = parsedUrl.protocol;

    const details: {
      originalUrl: string;
      hostname: string;
      protocol: string;
      ip?: string;
    } = {
      originalUrl: url,
      hostname,
      protocol,
    };

    // Check protocol
    if (!allowedProtocols.includes(protocol)) {
      logWarn('URL validation failed: Protocol not allowed', { 
        url, 
        protocol, 
        allowedProtocols 
      });
      
      return {
        isValid: false,
        error: `Protocol '${protocol}' is not allowed`,
        details,
      };
    }

    // Check blocked hostnames
    if (isBlockedHostname(hostname)) {
      logWarn('URL validation failed: Hostname is blocked', { 
        url, 
        hostname 
      });
      
      return {
        isValid: false,
        error: `Hostname '${hostname}' is blocked`,
        details,
      };
    }

    // Check blocked domains
    if (blockedDomains.some(domain => hostname.includes(domain))) {
      logWarn('URL validation failed: Domain is blocked', { 
        url, 
        hostname, 
        blockedDomains 
      });
      
      return {
        isValid: false,
        error: `Domain '${hostname}' is blocked`,
        details,
      };
    }

    // Check allowed domains (whitelist)
    if (allowedDomains && allowedDomains.length > 0) {
      const isAllowed = allowedDomains.some(domain => 
        hostname === domain || hostname.endsWith(`.${domain}`)
      );
      
      if (!isAllowed) {
        logWarn('URL validation failed: Domain not in whitelist', { 
          url, 
          hostname, 
          allowedDomains 
        });
        
        return {
          isValid: false,
          error: `Domain '${hostname}' is not in the allowed list`,
          details,
        };
      }
    }

    // Resolve hostname to check for private IPs
    if (!allowPrivateIPs) {
      const resolvedIP = await resolveHostname(hostname);
      
      if (resolvedIP) {
        details.ip = resolvedIP;
        
        if (isPrivateIP(resolvedIP)) {
          logWarn('URL validation failed: Resolves to private IP', { 
            url, 
            hostname, 
            resolvedIP 
          });
          
          return {
            isValid: false,
            error: `URL resolves to private IP address: ${resolvedIP}`,
            details,
          };
        }
      }
    }

    // Additional port checks for common dangerous ports
    const port = parsedUrl.port;
    const dangerousPorts = ['22', '23', '25', '53', '135', '139', '445', '1433', '3389'];
    
    if (port && dangerousPorts.includes(port)) {
      logWarn('URL validation failed: Dangerous port', { 
        url, 
        port 
      });
      
      return {
        isValid: false,
        error: `Port ${port} is not allowed`,
        details,
      };
    }

    // URL is valid
    return {
      isValid: true,
      details,
    };

  } catch (error) {
    logError('URL validation failed: Invalid URL format', { 
      url, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    
    return {
      isValid: false,
      error: 'Invalid URL format',
      details: { originalUrl: url, hostname: '', protocol: '' },
    };
  }
}

/**
 * Wrapper for fetch that includes SSRF protection
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param config - URL validation configuration
 * @returns Fetch promise
 */
export async function safeFetch(
  url: string,
  options: RequestInit = {},
  config?: UrlValidationConfig
): Promise<Response> {
  const validation = await validateUrl(url, config);
  
  if (!validation.isValid) {
    const error = new Error(`SSRF protection: ${validation.error}`);
    error.name = 'SSRFValidationError';
    throw error;
  }

  // Add security headers to prevent credential leakage
  const secureOptions: RequestInit = {
    ...options,
    headers: {
      ...options.headers,
      // Prevent credential leakage
      'Cache-Control': 'no-cache, no-store',
    },
    // Disable credentials for external requests
    credentials: 'omit',
  };

  return fetch(url, secureOptions);
}

/**
 * Get SSRF protection configuration for different services
 */
export function getSSRFConfig(service: 'openai' | 'perplexity' | 'github' | 'general'): UrlValidationConfig {
  switch (service) {
    case 'openai':
      return {
        allowedDomains: ['api.openai.com'],
        allowedProtocols: ['https:'],
        allowPrivateIPs: false,
      };
    
    case 'perplexity':
      return {
        allowedDomains: ['api.perplexity.ai'],
        allowedProtocols: ['https:'],
        allowPrivateIPs: false,
      };
    
    case 'github':
      return {
        allowedDomains: ['api.github.com', 'github.com'],
        allowedProtocols: ['https:'],
        allowPrivateIPs: false,
      };
    
    case 'general':
    default:
      return {
        allowedProtocols: ['https:'],
        allowPrivateIPs: false,
        blockedDomains: ['localhost', '127.0.0.1'],
      };
  }
}

/**
 * Middleware for Express-style frameworks
 * @param config - URL validation configuration
 */
export function ssrfProtectionMiddleware(config?: UrlValidationConfig) {
  return async function(url: string): Promise<void> {
    const validation = await validateUrl(url, config);
    
    if (!validation.isValid) {
      const error = new Error(`SSRF protection: ${validation.error}`);
      error.name = 'SSRFValidationError';
      throw error;
    }
  };
}

const UrlValidator = {
  validate: validateUrl,
  safeFetch,
  getConfig: getSSRFConfig,
  middleware: ssrfProtectionMiddleware,
};

export default UrlValidator;