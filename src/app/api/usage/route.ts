/**
 * API Usage Monitoring Endpoints
 * 
 * Provides real-time monitoring of API usage, costs, and optimization metrics.
 * These endpoints support the cost optimization dashboard and alerts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { getCostGuard } from '@/lib/api-cost-guard';
import { getCacheService } from '@/lib/cache-service';
import { logApiRequest, logApiResponse, logApiError } from '@/lib/logger';
import { createClient } from '@supabase/supabase-js';

// Validation schemas
const UsageQuerySchema = z.object({
  period: z.enum(['today', '7days', '30days']).default('today'),
  userId: z.string().optional(),
  provider: z.enum(['openai', 'perplexity', 'all']).default('all'),
  model: z.string().optional(),
});

const CostSummaryQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  groupBy: z.enum(['user', 'provider', 'model', 'day']).default('day'),
});

// Initialize services
const costGuard = getCostGuard();
const cacheService = getCacheService();

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
 * GET /api/usage - Get API usage statistics and cost information
 */
export async function GET(request: NextRequest) {
  const requestId = `usage_${Date.now()}`;
  const startTime = Date.now();

  try {
    const { userId } = await auth();
    const { searchParams } = new URL(request.url);
    
    logApiRequest('GET', '/api/usage', userId || undefined);

    // Parse and validate query parameters
    const queryParams = {
      period: searchParams.get('period') || 'today',
      userId: searchParams.get('userId') || undefined,
      provider: searchParams.get('provider') || 'all',
      model: searchParams.get('model') || undefined,
    };

    const validatedParams = UsageQuerySchema.parse(queryParams);

    // Check if user is authorized to view this data
    const targetUserId = validatedParams.userId || userId;
    if (validatedParams.userId && validatedParams.userId !== userId) {
      // Check if current user is admin
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('clerk_user_id', userId)
        .single();

      if (!userProfile || !['admin', 'owner'].includes(userProfile.role)) {
        logApiError('Unauthorized access to usage data', 403);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    // Get current cost summary
    const dailyCostSummary = await costGuard.getDailyCostSummary(targetUserId || undefined);
    
    // Get cost guard status
    const costGuardStatus = await costGuard.getStatus();
    
    // Get cache metrics
    const cacheMetrics = cacheService.getMetrics();
    
    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;
    
    switch (validatedParams.period) {
      case 'today':
        startDate = new Date(now.toDateString());
        break;
      case '7days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    // Build database query
    let query = supabase
      .from('api_usage_logs')
      .select(`
        id,
        provider,
        model,
        cost_usd,
        tokens_total,
        cache_hit,
        success,
        duration_ms,
        created_at,
        task_type
      `)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    // Apply filters
    if (targetUserId) {
      query = query.eq('user_id', targetUserId);
    }

    if (validatedParams.provider !== 'all') {
      query = query.eq('provider', validatedParams.provider);
    }

    if (validatedParams.model) {
      query = query.eq('model', validatedParams.model);
    }

    // Execute query
    const { data: usageLogs, error: queryError } = await query.limit(1000);

    if (queryError) {
      throw new Error(`Database query failed: ${queryError.message}`);
    }

    // Process usage statistics
    const stats = processUsageStats(usageLogs || []);

    // Get historical trends (last 7 days for chart)
    const { data: historicalData } = await supabase.rpc('get_cost_trends', {
      target_user_id: targetUserId,
      days_back: 7
    });

    const responseData = {
      summary: {
        period: validatedParams.period,
        userId: targetUserId,
        ...dailyCostSummary,
        costGuardStatus,
      },
      statistics: stats,
      cacheMetrics: Array.from(cacheMetrics as Map<string, any>).reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {} as Record<string, any>),
      trends: historicalData || [],
      recentRequests: usageLogs?.slice(0, 50) || [],
      generated_at: new Date().toISOString(),
    };

    const duration = Date.now() - startTime;
    logApiResponse(200, duration);

    return NextResponse.json(responseData);

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logApiError(errorMessage, 500);
    logApiResponse(500, duration);

    return NextResponse.json(
      { 
        error: 'Failed to fetch usage data', 
        message: errorMessage,
        requestId 
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/usage/summary - Get detailed cost summary with custom parameters
 */
export async function POST(request: NextRequest) {
  const requestId = `usage_summary_${Date.now()}`;
  const startTime = Date.now();

  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    logApiRequest('POST', '/api/usage/summary', userId);

    const body = await request.json();
    const validatedParams = CostSummaryQuerySchema.parse(body);

    // Check admin access for cross-user queries
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('clerk_user_id', userId)
      .single();

    const isAdmin = userProfile && ['admin', 'owner'].includes(userProfile.role);

    // Build summary query based on groupBy parameter
    let summaryData;

    switch (validatedParams.groupBy) {
      case 'user':
        if (!isAdmin) {
          return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }
        summaryData = await getUserCostSummary(validatedParams);
        break;
        
      case 'provider':
        summaryData = await getProviderCostSummary(validatedParams, isAdmin ? undefined : userId);
        break;
        
      case 'model':
        summaryData = await getModelCostSummary(validatedParams, isAdmin ? undefined : userId);
        break;
        
      case 'day':
      default:
        summaryData = await getDailyCostSummary(validatedParams, isAdmin ? undefined : userId);
        break;
    }

    const duration = Date.now() - startTime;
    logApiResponse(200, duration);

    return NextResponse.json({
      summary: summaryData,
      groupBy: validatedParams.groupBy,
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logApiError(errorMessage, 500);
    logApiResponse(500, duration);

    return NextResponse.json(
      { 
        error: 'Failed to generate cost summary', 
        message: errorMessage,
        requestId 
      },
      { status: 500 }
    );
  }
}

// Helper functions for processing usage data

function processUsageStats(usageLogs: any[]) {
  const stats = {
    totalRequests: usageLogs.length,
    totalCost: 0,
    totalTokens: 0,
    cacheHitCount: 0,
    errorCount: 0,
    avgDuration: 0,
    providerBreakdown: {} as Record<string, { requests: number; cost: number; tokens: number }>,
    modelBreakdown: {} as Record<string, { requests: number; cost: number; tokens: number }>,
    taskTypeBreakdown: {} as Record<string, { requests: number; cost: number }>,
  };

  let totalDuration = 0;

  usageLogs.forEach(log => {
    // Overall stats
    stats.totalCost += log.cost_usd || 0;
    stats.totalTokens += log.tokens_total || 0;
    if (log.cache_hit) stats.cacheHitCount++;
    if (!log.success) stats.errorCount++;
    if (log.duration_ms) totalDuration += log.duration_ms;

    // Provider breakdown
    if (!stats.providerBreakdown[log.provider]) {
      stats.providerBreakdown[log.provider] = { requests: 0, cost: 0, tokens: 0 };
    }
    stats.providerBreakdown[log.provider].requests++;
    stats.providerBreakdown[log.provider].cost += log.cost_usd || 0;
    stats.providerBreakdown[log.provider].tokens += log.tokens_total || 0;

    // Model breakdown
    if (!stats.modelBreakdown[log.model]) {
      stats.modelBreakdown[log.model] = { requests: 0, cost: 0, tokens: 0 };
    }
    stats.modelBreakdown[log.model].requests++;
    stats.modelBreakdown[log.model].cost += log.cost_usd || 0;
    stats.modelBreakdown[log.model].tokens += log.tokens_total || 0;

    // Task type breakdown
    if (log.task_type) {
      if (!stats.taskTypeBreakdown[log.task_type]) {
        stats.taskTypeBreakdown[log.task_type] = { requests: 0, cost: 0 };
      }
      stats.taskTypeBreakdown[log.task_type].requests++;
      stats.taskTypeBreakdown[log.task_type].cost += log.cost_usd || 0;
    }
  });

  // Calculate averages
  stats.avgDuration = stats.totalRequests > 0 ? totalDuration / stats.totalRequests : 0;

  // Calculate rates
  const cacheHitRate = stats.totalRequests > 0 ? (stats.cacheHitCount / stats.totalRequests) * 100 : 0;
  const errorRate = stats.totalRequests > 0 ? (stats.errorCount / stats.totalRequests) * 100 : 0;
  const avgCostPerRequest = stats.totalRequests > 0 ? stats.totalCost / stats.totalRequests : 0;

  return {
    ...stats,
    cacheHitRate: Math.round(cacheHitRate * 100) / 100,
    errorRate: Math.round(errorRate * 100) / 100,
    avgCostPerRequest: Math.round(avgCostPerRequest * 1000000) / 1000000, // Round to 6 decimal places
  };
}

async function getUserCostSummary(params: any) {
  const { data, error } = await supabase
    .from('api_usage_logs')
    .select(`
      user_id,
      cost_usd,
      tokens_total,
      created_at
    `)
    .gte('created_at', params.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .lte('created_at', params.endDate || new Date().toISOString());

  if (error) throw error;

  // Group by user
  const userSummary = data?.reduce((acc, log) => {
    if (!acc[log.user_id]) {
      acc[log.user_id] = { requests: 0, cost: 0, tokens: 0 };
    }
    acc[log.user_id].requests++;
    acc[log.user_id].cost += log.cost_usd || 0;
    acc[log.user_id].tokens += log.tokens_total || 0;
    return acc;
  }, {} as Record<string, any>);

  return userSummary;
}

async function getProviderCostSummary(params: any, userId?: string) {
  let query = supabase
    .from('api_usage_logs')
    .select('provider, cost_usd, tokens_total')
    .gte('created_at', params.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .lte('created_at', params.endDate || new Date().toISOString());

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return data?.reduce((acc, log) => {
    if (!acc[log.provider]) {
      acc[log.provider] = { requests: 0, cost: 0, tokens: 0 };
    }
    acc[log.provider].requests++;
    acc[log.provider].cost += log.cost_usd || 0;
    acc[log.provider].tokens += log.tokens_total || 0;
    return acc;
  }, {} as Record<string, any>);
}

async function getModelCostSummary(params: any, userId?: string) {
  let query = supabase
    .from('api_usage_logs')
    .select('model, provider, cost_usd, tokens_total')
    .gte('created_at', params.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .lte('created_at', params.endDate || new Date().toISOString());

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return data?.reduce((acc, log) => {
    const key = `${log.provider}:${log.model}`;
    if (!acc[key]) {
      acc[key] = { requests: 0, cost: 0, tokens: 0, provider: log.provider, model: log.model };
    }
    acc[key].requests++;
    acc[key].cost += log.cost_usd || 0;
    acc[key].tokens += log.tokens_total || 0;
    return acc;
  }, {} as Record<string, any>);
}

async function getDailyCostSummary(params: any, userId?: string) {
  // Use the database function for daily summaries
  const { data, error } = await supabase.rpc('get_cost_trends', {
    target_user_id: userId,
    days_back: 30
  });

  if (error) throw error;
  return data;
}