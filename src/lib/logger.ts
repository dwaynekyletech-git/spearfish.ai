/**
 * Structured Logger
 * 
 * This module provides a structured logging solution using Winston
 * to replace console.log/error calls throughout the application.
 * Includes request ID tracking and proper log levels.
 */

import winston from 'winston';
import { getEnv, isDevelopment } from './env-validation';

// Define log levels
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Create Winston logger instance
const logger = winston.createLogger({
  levels: LOG_LEVELS,
  level: getEnv('LOG_LEVEL'),
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, requestId, userId, ...meta }) => {
      const baseLog: any = {
        timestamp,
        level,
        message,
      };
      
      if (requestId) baseLog.requestId = requestId;
      if (userId) baseLog.userId = userId;
      if (Object.keys(meta).length > 0) baseLog.meta = meta;
      
      return JSON.stringify(baseLog);
    })
  ),
  defaultMeta: {
    service: 'spearfish-ai',
    environment: getEnv('NEXT_PUBLIC_ENVIRONMENT'),
  },
  transports: [
    new winston.transports.Console({
      format: isDevelopment() 
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
            winston.format.printf(({ timestamp, level, message, requestId, userId, ...meta }) => {
              let logLine = `${timestamp} [${level}]: ${message}`;
              if (requestId) logLine += ` [req: ${requestId}]`;
              if (userId) logLine += ` [user: ${userId}]`;
              if (Object.keys(meta).length > 0) {
                logLine += ` ${JSON.stringify(meta)}`;
              }
              return logLine;
            })
          )
        : winston.format.json(),
    }),
  ],
});

// Context for request tracking
interface LogContext {
  requestId?: string;
  userId?: string;
  companyId?: string;
  sessionId?: string;
  endpoint?: string;
}

let currentContext: LogContext = {};

/**
 * Set logging context for the current request
 * @param context - Context information to include in logs
 */
export function setLogContext(context: Partial<LogContext>): void {
  currentContext = { ...currentContext, ...context };
}

/**
 * Clear the logging context
 */
export function clearLogContext(): void {
  currentContext = {};
}

/**
 * Get the current logging context
 */
export function getLogContext(): LogContext {
  return { ...currentContext };
}

/**
 * Create a child logger with additional context
 * @param context - Additional context for this logger instance
 */
export function createChildLogger(context: LogContext) {
  return {
    error: (message: string, meta?: any) => logError(message, { ...context, ...meta }),
    warn: (message: string, meta?: any) => logWarn(message, { ...context, ...meta }),
    info: (message: string, meta?: any) => logInfo(message, { ...context, ...meta }),
    debug: (message: string, meta?: any) => logDebug(message, { ...context, ...meta }),
  };
}

/**
 * Log an error message
 * @param message - Error message
 * @param meta - Additional metadata
 */
export function logError(message: string, meta?: any): void {
  logger.error(message, { ...currentContext, ...meta });
}

/**
 * Log a warning message
 * @param message - Warning message
 * @param meta - Additional metadata
 */
export function logWarn(message: string, meta?: any): void {
  logger.warn(message, { ...currentContext, ...meta });
}

/**
 * Log an info message
 * @param message - Info message
 * @param meta - Additional metadata
 */
export function logInfo(message: string, meta?: any): void {
  logger.info(message, { ...currentContext, ...meta });
}

/**
 * Log a debug message
 * @param message - Debug message
 * @param meta - Additional metadata
 */
export function logDebug(message: string, meta?: any): void {
  logger.debug(message, { ...currentContext, ...meta });
}

/**
 * Log API request start
 * @param method - HTTP method
 * @param endpoint - API endpoint
 * @param userId - User ID if available
 */
export function logApiRequest(method: string, endpoint: string, userId?: string): void {
  setLogContext({ 
    requestId: generateRequestId(),
    userId,
    endpoint,
  });
  
  logInfo(`${method} ${endpoint}`, { 
    type: 'api_request_start',
    method,
    endpoint,
  });
}

/**
 * Log API request completion
 * @param statusCode - HTTP status code
 * @param duration - Request duration in milliseconds
 */
export function logApiResponse(statusCode: number, duration?: number): void {
  const context = getLogContext();
  
  logInfo(`${context.endpoint} completed`, {
    type: 'api_request_end',
    statusCode,
    duration,
    endpoint: context.endpoint,
  });
  
  clearLogContext();
}

/**
 * Log API request error
 * @param error - Error object or message
 * @param statusCode - HTTP status code
 */
export function logApiError(error: Error | string, statusCode?: number): void {
  const context = getLogContext();
  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  logError(`${context.endpoint} failed: ${errorMessage}`, {
    type: 'api_request_error',
    error: errorMessage,
    stack: errorStack,
    statusCode,
    endpoint: context.endpoint,
  });
}

/**
 * Log database operation
 * @param operation - Database operation type
 * @param table - Table name
 * @param duration - Operation duration in milliseconds
 * @param recordCount - Number of records affected
 */
export function logDatabaseOperation(
  operation: string, 
  table: string, 
  duration?: number, 
  recordCount?: number
): void {
  logDebug(`Database ${operation}`, {
    type: 'database_operation',
    operation,
    table,
    duration,
    recordCount,
  });
}

/**
 * Log external API call
 * @param service - External service name
 * @param endpoint - External endpoint
 * @param duration - Call duration in milliseconds
 * @param cost - API call cost in USD
 */
export function logExternalApiCall(
  service: string, 
  endpoint: string, 
  duration?: number, 
  cost?: number
): void {
  logInfo(`External API call: ${service}`, {
    type: 'external_api_call',
    service,
    endpoint,
    duration,
    cost,
  });
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Log function for backwards compatibility (gradual migration)
 * @deprecated Use logInfo, logError, logWarn, or logDebug instead
 */
export function log(level: 'info' | 'error' | 'warn' | 'debug', message: string, meta?: any): void {
  switch (level) {
    case 'error':
      logError(message, meta);
      break;
    case 'warn':
      logWarn(message, meta);
      break;
    case 'info':
      logInfo(message, meta);
      break;
    case 'debug':
      logDebug(message, meta);
      break;
  }
}

// Export the raw Winston logger for advanced use cases
export { logger as rawLogger };

// Export default logger functions
const Logger = {
  error: logError,
  warn: logWarn,
  info: logInfo,
  debug: logDebug,
  setContext: setLogContext,
  clearContext: clearLogContext,
  createChild: createChildLogger,
  apiRequest: logApiRequest,
  apiResponse: logApiResponse,
  apiError: logApiError,
  dbOperation: logDatabaseOperation,
  externalApiCall: logExternalApiCall,
};

export default Logger;