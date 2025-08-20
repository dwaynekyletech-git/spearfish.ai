/**
 * Cost Monitoring Dashboard Component
 * 
 * Displays comprehensive cost tracking and usage statistics for YC AI sync operations
 * including Apify spend, budget management, and enrichment progress.
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  CurrencyDollarIcon, 
  ChartBarIcon, 
  BuildingOfficeIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon
} from '@heroicons/react/24/outline';

// =============================================================================
// Types
// =============================================================================

interface CostStats {
  monthlySpend: number;
  remainingBudget: number;
  companiesEnrichedThisMonth: number;
  averageCostPerCompany: number;
  budgetLimit: number;
}

interface SyncStats {
  lastSyncDate: string | null;
  totalAICompanies: number;
  enrichedCompanies: number;
  enrichmentComplete: boolean;
}

interface UsageLog {
  id: string;
  service: string;
  cost_usd: number;
  items_processed: number;
  created_at: string;
  metadata: any;
}

// =============================================================================
// Component
// =============================================================================

export function CostMonitoringDashboard() {
  const [costStats, setCostStats] = useState<CostStats | null>(null);
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);
  const [recentUsage, setRecentUsage] = useState<UsageLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch cost and usage data
  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch cost statistics
      const costResponse = await fetch('/api/yc/cost-stats');
      if (!costResponse.ok) {
        throw new Error('Failed to fetch cost statistics');
      }
      const costData = await costResponse.json();
      setCostStats(costData.data);

      // Fetch sync status
      const syncResponse = await fetch('/api/yc/sync-ai-companies');
      if (!syncResponse.ok) {
        throw new Error('Failed to fetch sync status');
      }
      const syncData = await syncResponse.json();
      setSyncStats(syncData.data.sync_status);

      // Fetch recent usage logs
      const usageResponse = await fetch('/api/yc/usage-logs?limit=10');
      if (usageResponse.ok) {
        const usageData = await usageResponse.json();
        setRecentUsage(usageData.data || []);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Helper functions
  const getBudgetStatus = (spent: number, limit: number) => {
    const percentage = (spent / limit) * 100;
    if (percentage >= 90) return { color: 'text-red-400', status: 'Critical' };
    if (percentage >= 75) return { color: 'text-yellow-400', status: 'Warning' };
    return { color: 'text-green-400', status: 'Good' };
  };

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString();

  if (isLoading) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-slate-700 rounded mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-slate-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
        <div className="flex items-center gap-3 text-red-400">
          <ExclamationTriangleIcon className="h-5 w-5" />
          <span>Error loading cost data: {error}</span>
          <button 
            onClick={fetchData}
            className="ml-auto px-3 py-1 bg-red-900/20 border border-red-500/30 rounded text-sm hover:bg-red-900/30 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">Cost Monitoring</h2>
          <p className="text-slate-400 text-sm">Track YC AI sync costs and usage</p>
        </div>
        <button 
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-2 bg-slate-700/50 hover:bg-slate-600 rounded-lg transition-colors text-sm text-slate-300"
        >
          <ClockIcon className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Cost Statistics Cards */}
      {costStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Monthly Spend */}
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <CurrencyDollarIcon className="h-5 w-5 text-blue-400" />
              <span className="text-xs text-slate-400">This Month</span>
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              {formatCurrency(costStats.monthlySpend)}
            </div>
            <div className="text-xs text-slate-400">
              of {formatCurrency(costStats.budgetLimit)} budget
            </div>
            <div className="mt-2 bg-slate-700 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  getBudgetStatus(costStats.monthlySpend, costStats.budgetLimit).color.includes('red') 
                    ? 'bg-red-500' 
                    : getBudgetStatus(costStats.monthlySpend, costStats.budgetLimit).color.includes('yellow')
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
                style={{ 
                  width: `${Math.min((costStats.monthlySpend / costStats.budgetLimit) * 100, 100)}%` 
                }}
              />
            </div>
          </div>

          {/* Remaining Budget */}
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <ChartBarIcon className="h-5 w-5 text-green-400" />
              <span className="text-xs text-slate-400">Remaining</span>
            </div>
            <div className={`text-2xl font-bold mb-1 ${getBudgetStatus(costStats.monthlySpend, costStats.budgetLimit).color}`}>
              {formatCurrency(costStats.remainingBudget)}
            </div>
            <div className="text-xs text-slate-400">
              Budget status: {getBudgetStatus(costStats.monthlySpend, costStats.budgetLimit).status}
            </div>
          </div>

          {/* Companies Enriched */}
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <BuildingOfficeIcon className="h-5 w-5 text-purple-400" />
              <span className="text-xs text-slate-400">This Month</span>
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              {costStats.companiesEnrichedThisMonth}
            </div>
            <div className="text-xs text-slate-400">
              companies enriched
            </div>
          </div>

          {/* Average Cost */}
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <CurrencyDollarIcon className="h-5 w-5 text-orange-400" />
              <span className="text-xs text-slate-400">Per Company</span>
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              {formatCurrency(costStats.averageCostPerCompany)}
            </div>
            <div className="text-xs text-slate-400">
              average cost
            </div>
          </div>
        </div>
      )}

      {/* Sync Status */}
      {syncStats && (
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Sync Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <BuildingOfficeIcon className="h-4 w-4 text-blue-400" />
                <span className="text-sm text-slate-300">Total AI Companies</span>
              </div>
              <div className="text-xl font-bold text-white">{syncStats.totalAICompanies}</div>
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircleIcon className="h-4 w-4 text-green-400" />
                <span className="text-sm text-slate-300">Enriched Companies</span>
              </div>
              <div className="text-xl font-bold text-white">{syncStats.enrichedCompanies}</div>
              <div className="text-xs text-slate-400">
                {syncStats.totalAICompanies > 0 
                  ? `${Math.round((syncStats.enrichedCompanies / syncStats.totalAICompanies) * 100)}% complete`
                  : '0% complete'
                }
              </div>
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ClockIcon className="h-4 w-4 text-purple-400" />
                <span className="text-sm text-slate-300">Last Sync</span>
              </div>
              <div className="text-xl font-bold text-white">
                {syncStats.lastSyncDate ? formatDate(syncStats.lastSyncDate) : 'Never'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Usage */}
      {recentUsage.length > 0 && (
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Usage</h3>
          <div className="space-y-3">
            {recentUsage.map((usage) => (
              <div key={usage.id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-400 rounded-full" />
                  <div>
                    <div className="text-sm font-medium text-white">
                      {usage.service} enrichment
                    </div>
                    <div className="text-xs text-slate-400">
                      {usage.items_processed} companies • {formatDate(usage.created_at)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-white">
                    {formatCurrency(usage.cost_usd)}
                  </div>
                  <div className="text-xs text-slate-400">
                    {formatCurrency(usage.cost_usd / Math.max(usage.items_processed, 1))}/company
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Budget Alert */}
      {costStats && getBudgetStatus(costStats.monthlySpend, costStats.budgetLimit).status !== 'Good' && (
        <div className={`bg-slate-800/50 backdrop-blur-xl border rounded-xl p-4 ${
          getBudgetStatus(costStats.monthlySpend, costStats.budgetLimit).status === 'Critical'
            ? 'border-red-500/50 bg-red-900/10'
            : 'border-yellow-500/50 bg-yellow-900/10'
        }`}>
          <div className="flex items-center gap-3">
            <ExclamationTriangleIcon className={`h-5 w-5 ${
              getBudgetStatus(costStats.monthlySpend, costStats.budgetLimit).color
            }`} />
            <div>
              <div className={`font-medium ${getBudgetStatus(costStats.monthlySpend, costStats.budgetLimit).color}`}>
                Budget {getBudgetStatus(costStats.monthlySpend, costStats.budgetLimit).status}
              </div>
              <div className="text-sm text-slate-400">
                {getBudgetStatus(costStats.monthlySpend, costStats.budgetLimit).status === 'Critical'
                  ? 'You have used 90% or more of your monthly budget. Consider reducing sync frequency.'
                  : 'You have used 75% or more of your monthly budget. Monitor usage carefully.'
                }
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}