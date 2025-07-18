/**
 * Company Profile Client Component
 * 
 * Main client component for company profile pages with tabbed navigation
 */

'use client';

import { useState } from 'react';
import { CompanyHeader } from './CompanyHeader';
import { CompanyTabs } from './CompanyTabs';
import { OverviewTab } from './tabs/OverviewTab';
import { TechnicalTab } from './tabs/TechnicalTab';
import { TeamTab } from './tabs/TeamTab';
import { SpearfishCalcTab } from './tabs/SpearfishCalcTab';
import { SpearThisTab } from './tabs/SpearThisTab';
import { OpportunitiesTab } from './tabs/OpportunitiesTab';
import { Breadcrumb, useCompanyBreadcrumbs } from '../ui/Breadcrumb';
import { useCompanyData } from '../../hooks/useCompanyData';

interface CompanyProfileClientProps {
  companyId: string;
}

export type TabType = 'overview' | 'technical' | 'team' | 'spearfish-calc' | 'spear-this' | 'opportunities';

interface ApiResponse {
  success: boolean;
  data: any;
  metadata: {
    timestamp: string;
  };
  error?: string;
}

export function CompanyProfileClient({ companyId }: CompanyProfileClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  
  // Use the new caching hook
  const { data: company, isLoading, error, isStale, refetch } = useCompanyData(companyId);
  
  // Generate breadcrumb items - must be called before early returns
  const breadcrumbItems = useCompanyBreadcrumbs(company, activeTab);

  // Loading state with improved skeleton
  if (isLoading && !company) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          {/* Header skeleton */}
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-8 mb-8">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <div className="h-16 w-16 bg-slate-700 rounded-xl"></div>
                <div className="space-y-3">
                  <div className="h-6 bg-slate-700 rounded w-48"></div>
                  <div className="h-4 bg-slate-700 rounded w-32"></div>
                </div>
              </div>
              <div className="text-right space-y-2">
                <div className="h-8 bg-slate-700 rounded w-16"></div>
                <div className="h-4 bg-slate-700 rounded w-20"></div>
              </div>
            </div>
          </div>
          
          {/* Tabs skeleton */}
          <div className="flex space-x-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 bg-slate-700 rounded w-24"></div>
            ))}
          </div>
          
          {/* Content skeleton */}
          <div className="space-y-6">
            <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
              <div className="h-6 bg-slate-700 rounded w-32 mb-4"></div>
              <div className="space-y-3">
                <div className="h-4 bg-slate-700 rounded w-full"></div>
                <div className="h-4 bg-slate-700 rounded w-3/4"></div>
                <div className="h-4 bg-slate-700 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state with better recovery options
  if (error && !company) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Failed to Load Company</h3>
            <p className="text-slate-400 text-sm mb-6">{error}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={refetch}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.history.back()}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Company not found
  if (!company) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="text-slate-400 mb-4">Company not found</div>
          <div className="text-sm text-slate-500">
            The company you&apos;re looking for doesn&apos;t exist or has been removed.
          </div>
        </div>
      </div>
    );
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab company={company} />;
      case 'technical':
        return <TechnicalTab company={company} />;
      case 'team':
        return <TeamTab company={company} />;
      case 'spearfish-calc':
        return <SpearfishCalcTab company={company} />;
      case 'spear-this':
        return <SpearThisTab company={company} />;
      case 'opportunities':
        return <OpportunitiesTab company={company} />;
      default:
        return <OverviewTab company={company} />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb Navigation */}
      <Breadcrumb items={breadcrumbItems} className="mb-6" />
      
      {/* Stale Data Indicator */}
      {isStale && (
        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-yellow-400 text-sm">Data may be outdated</span>
          </div>
          <button
            onClick={refetch}
            className="px-3 py-1 bg-yellow-500/20 text-yellow-300 text-sm rounded hover:bg-yellow-500/30 transition-colors"
          >
            Refresh
          </button>
        </div>
      )}
      
      {/* Company Header */}
      <CompanyHeader company={company} />
      
      {/* Tab Navigation */}
      <CompanyTabs activeTab={activeTab} onTabChange={setActiveTab} />
      
      {/* Tab Content */}
      <div className="mt-8">
        {renderActiveTab()}
      </div>
    </div>
  );
}