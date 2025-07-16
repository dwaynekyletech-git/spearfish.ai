/**
 * Breadcrumb Navigation Component
 * 
 * Provides consistent breadcrumb navigation throughout the application
 */

import Link from 'next/link';
import { ChevronRightIcon, HomeIcon } from '@heroicons/react/24/outline';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  return (
    <nav className={`flex ${className}`} aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-center">
            {index === 0 && (
              <HomeIcon className="h-4 w-4 text-slate-400 mr-2" />
            )}
            
            {item.href && !item.current ? (
              <Link
                href={item.href}
                className="text-slate-400 hover:text-slate-200 transition-colors text-sm font-medium"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={`text-sm font-medium ${
                  item.current 
                    ? 'text-white' 
                    : 'text-slate-400'
                }`}
              >
                {item.label}
              </span>
            )}
            
            {index < items.length - 1 && (
              <ChevronRightIcon className="h-4 w-4 text-slate-500 mx-2" />
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * Hook to generate breadcrumb items for company pages
 */
export function useCompanyBreadcrumbs(company?: any, currentTab?: string) {
  const items: BreadcrumbItem[] = [
    {
      label: 'Dashboard',
      href: '/'
    }
  ];

  if (company) {
    items.push({
      label: company.name,
      href: `/company/${company.id}`,
      current: !currentTab
    });

    if (currentTab) {
      const tabLabels: { [key: string]: string } = {
        'overview': 'Overview',
        'technical': 'Technical',
        'team': 'Team',
        'spearfish-calc': 'Spearfish Calc',
        'opportunities': 'Opportunities'
      };

      items.push({
        label: tabLabels[currentTab] || currentTab,
        current: true
      });
    }
  }

  return items;
}