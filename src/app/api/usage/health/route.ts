/**
 * Cost Optimization System Health Check
 * 
 * Provides comprehensive health status for the cost optimization system including:
 * - Redis cache service status
 * - Cost guard status and limits
 * - Model selector functionality
 * - Database connectivity for usage tracking
 */

import { NextResponse } from 'next/server';
import { getCostGuard } from '@/lib/api-cost-guard';
import { getCacheService } from '@/lib/cache-service';
import { getModelSelector } from '@/lib/model-selector';
import { createClient } from '@supabase/supabase-js';

// Initialize services
const costGuard = getCostGuard();
const cacheService = getCacheService();
const modelSelector = getModelSelector();

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * GET /api/usage/health - Comprehensive health check for cost optimization system
 */
export async function GET() {
  const startTime = Date.now();
  const healthChecks: Record<string, any> = {};

  try {
    // 1. Cache Service Health Check
    try {
      const cacheHealth = await cacheService.healthCheck();
      healthChecks.cache = {
        status: cacheHealth.status,
        message: cacheHealth.message,
        metrics: cacheHealth.metrics || null,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      healthChecks.cache = {
        status: 'unhealthy',
        message: `Cache health check failed: ${error instanceof Error ? error.message : error}`,
        timestamp: new Date().toISOString()
      };
    }

    // 2. Cost Guard Health Check
    try {
      const costGuardStatus = await costGuard.getStatus();
      healthChecks.costGuard = {
        status: costGuardStatus.status,
        message: costGuardStatus.message,
        globalDailyCost: costGuardStatus.globalDailyCost,
        globalLimit: costGuardStatus.globalLimit,
        utilization: Math.round(costGuardStatus.utilization * 100),
        redisConnected: costGuardStatus.redisConnected,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      healthChecks.costGuard = {
        status: 'unhealthy',
        message: `Cost guard health check failed: ${error instanceof Error ? error.message : error}`,
        timestamp: new Date().toISOString()
      };
    }

    // 3. Model Selector Health Check
    try {
      // Test model selection functionality
      const testSelection = modelSelector.selectModel({
        taskType: 'classification',
        qualityLevel: 'standard'
      });
      
      healthChecks.modelSelector = {
        status: 'healthy',
        message: 'Model selection working correctly',
        testResult: {
          provider: testSelection.provider,
          model: testSelection.model,
          costScore: testSelection.costScore,
          qualityScore: testSelection.qualityScore
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      healthChecks.modelSelector = {
        status: 'unhealthy',
        message: `Model selector failed: ${error instanceof Error ? error.message : error}`,
        timestamp: new Date().toISOString()
      };
    }

    // 4. Database Connectivity Check
    try {
      // Test database connection with a simple query
      const { data, error } = await supabase
        .from('api_usage_logs')
        .select('id')
        .limit(1);

      if (error) {
        throw error;
      }

      healthChecks.database = {
        status: 'healthy',
        message: 'Database connection active',
        queryTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      healthChecks.database = {
        status: 'unhealthy',
        message: `Database connection failed: ${error instanceof Error ? error.message : error}`,
        timestamp: new Date().toISOString()
      };
    }

    // 5. Environment Variables Check
    const envChecks = {
      redis: !!(process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN),
      openai: !!process.env.OPENAI_API_KEY,
      perplexity: !!process.env.PERPLEXITY_API_KEY,
      supabase: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      costLimits: !!(process.env.MAX_DAILY_API_COST_USD && process.env.MAX_USER_DAILY_COST_USD),
    };

    healthChecks.environment = {
      status: Object.values(envChecks).every(Boolean) ? 'healthy' : 'degraded',
      message: Object.values(envChecks).every(Boolean) 
        ? 'All required environment variables present' 
        : 'Some environment variables missing',
      checks: envChecks,
      timestamp: new Date().toISOString()
    };

    // 6. Overall System Status
    const componentStatuses = Object.values(healthChecks).map(check => check.status);
    const hasUnhealthy = componentStatuses.includes('unhealthy');
    const hasDegraded = componentStatuses.includes('degraded');
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    let overallMessage: string;

    if (hasUnhealthy) {
      overallStatus = 'unhealthy';
      overallMessage = 'One or more critical components are unhealthy';
    } else if (hasDegraded) {
      overallStatus = 'degraded';
      overallMessage = 'System operating with reduced functionality';
    } else {
      overallStatus = 'healthy';
      overallMessage = 'All cost optimization systems operational';
    }

    // 7. Performance Metrics
    const performanceMetrics = {
      healthCheckDuration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      systemUptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };

    // 8. Cost Optimization Status Summary
    let costOptimizationSummary;
    try {
      const globalCost = await costGuard.getDailyCost();
      const cacheMetrics = cacheService.getMetrics();
      
      // Calculate total cache metrics across all prefixes
      const totalCacheMetrics = Array.from(cacheMetrics as Map<string, any>).reduce(
        (total, [, metrics]) => ({
          hits: total.hits + metrics.hits,
          misses: total.misses + metrics.misses,
          totalRequests: total.totalRequests + metrics.totalRequests
        }),
        { hits: 0, misses: 0, totalRequests: 0 }
      );

      const overallHitRate = totalCacheMetrics.totalRequests > 0 
        ? (totalCacheMetrics.hits / totalCacheMetrics.totalRequests) * 100 
        : 0;

      costOptimizationSummary = {
        dailyCost: globalCost,
        dailyLimit: process.env.MAX_DAILY_API_COST_USD ? parseFloat(process.env.MAX_DAILY_API_COST_USD) : 100,
        utilization: globalCost / (parseFloat(process.env.MAX_DAILY_API_COST_USD || '100')),
        cacheHitRate: Math.round(overallHitRate * 100) / 100,
        cacheSavings: totalCacheMetrics.hits * 0.002, // Estimated $0.002 per cached request
        status: overallStatus
      };
    } catch (error) {
      costOptimizationSummary = {
        error: `Failed to calculate optimization summary: ${error instanceof Error ? error.message : error}`
      };
    }

    const response = {
      status: overallStatus,
      message: overallMessage,
      timestamp: new Date().toISOString(),
      components: healthChecks,
      performance: performanceMetrics,
      costOptimization: costOptimizationSummary,
      version: '1.0.0'
    };

    // Set appropriate HTTP status code
    const httpStatus = overallStatus === 'healthy' ? 200 : 
                     overallStatus === 'degraded' ? 200 : 503;

    return NextResponse.json(response, { status: httpStatus });

  } catch (error) {
    const errorResponse = {
      status: 'unhealthy',
      message: 'Health check system failure',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      components: healthChecks,
      version: '1.0.0'
    };

    return NextResponse.json(errorResponse, { status: 503 });
  }
}

/**
 * POST /api/usage/health - Trigger health check actions (admin only)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'refresh_cache_metrics':
        // Clear and reset cache metrics
        cacheService.clearMetrics();
        return NextResponse.json({ 
          message: 'Cache metrics refreshed',
          timestamp: new Date().toISOString() 
        });

      case 'reset_daily_costs':
        // Reset daily costs (emergency action)
        const resetResult = await costGuard.resetDailyCosts();
        return NextResponse.json({ 
          message: resetResult ? 'Daily costs reset successfully' : 'Failed to reset daily costs',
          success: resetResult,
          timestamp: new Date().toISOString() 
        });

      case 'test_model_selection':
        // Test all model selection scenarios
        const testResults = ['classification', 'research_deep', 'email_generation'].map(taskType => {
          const selection = modelSelector.selectModel({
            taskType: taskType as any,
            qualityLevel: 'standard'
          });
          return {
            taskType,
            selectedModel: selection.model,
            provider: selection.provider,
            reasoning: selection.reasoning
          };
        });

        return NextResponse.json({
          message: 'Model selection tests completed',
          results: testResults,
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json(
          { error: 'Unknown action', availableActions: ['refresh_cache_metrics', 'reset_daily_costs', 'test_model_selection'] },
          { status: 400 }
        );
    }

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Health check action failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}