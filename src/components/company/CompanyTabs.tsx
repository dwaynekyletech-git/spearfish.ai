/**
 * Company Tabs Component
 * 
 * Tab navigation for company profile sections
 */

import { TabType } from './CompanyProfileClient';

interface CompanyTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const tabs = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'technical', label: 'Technical', icon: '⚙️' },
  { id: 'team', label: 'Team', icon: '👥' },
  { id: 'spearfish-calc', label: 'Spearfish Calc', icon: '🎯' },
  { id: 'opportunities', label: 'Opportunities', icon: '🚀' },
  { id: 'spear-this', label: 'Spear This!', icon: '🏹' },
] as const;

export function CompanyTabs({ activeTab, onTabChange }: CompanyTabsProps) {
  return (
    <div className="mt-8">
      <div className="border-b border-slate-700/50">
        <nav className="flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id as TabType)}
              className={`
                flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === tab.id
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-300'
                }
              `}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              <span className="text-base">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}