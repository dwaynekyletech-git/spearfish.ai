/**
 * Technical Tab Component
 * 
 * Technical information including GitHub data and HuggingFace activity
 */

import { GitHubRepositories } from '../GitHubRepositories';
import { useCompanyGitHubData } from '@/hooks/useCompanyGitHubData';

interface TechnicalTabProps {
  company: any;
}

export function TechnicalTab({ company }: TechnicalTabProps) {
  const { data: githubData, isLoading: githubLoading, error: githubError } = useCompanyGitHubData(company.id);

  return (
    <div className="space-y-8">
      {/* GitHub Activity Overview - Real Data */}
      <GitHubRepositories 
        githubData={githubData}
        isLoading={githubLoading}
        error={githubError}
      />

      {/* HuggingFace Activity - Placeholder for now */}
      <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            🤗 HuggingFace Activity
          </h3>
          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-lg">
            Coming Soon
          </span>
        </div>
        <p className="text-slate-400 text-sm">
          HuggingFace model information and community engagement metrics will be displayed here.
        </p>
      </div>
    </div>
  );
}