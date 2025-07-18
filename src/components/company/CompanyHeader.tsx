/**
 * Company Header Component
 * 
 * Header section with company logo, name, and key metrics
 */

import { StarIcon, UsersIcon, MapPinIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import { ArrowTrendingUpIcon } from '@heroicons/react/24/solid';
import Image from 'next/image';
import { SocialShare } from '../ui/SocialShare';

interface CompanyHeaderProps {
  company: {
    id: string;
    name: string;
    small_logo_thumb_url?: string;
    one_liner: string;
    spearfish_score: number;
    team_size: number;
    headquarters: string;
    website: string;
    is_hiring: boolean;
    batch: string;
    founded: string;
    funding_stage: string;
    total_funding: string;
    company_status?: string;
    industry?: string;
    industry_detailed?: string;
    yc_data?: {
      stage?: string;
      industry?: string;
      subindustry?: string;
      hiring_status?: string;
      company_size?: string;
    };
  };
}

export function CompanyHeader({ company }: CompanyHeaderProps) {
  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-400';
    if (score >= 6) return 'text-yellow-400';
    if (score >= 4) return 'text-orange-400';
    return 'text-red-400';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 8) return 'Excellent';
    if (score >= 6) return 'Good';
    if (score >= 4) return 'Average';
    return 'Below Average';
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-8">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left side - Company info */}
        <div className="flex-1">
          <div className="flex items-start gap-6">
            {/* Company Logo */}
            <div className="flex-shrink-0">
              <div className="h-20 w-20 rounded-xl flex items-center justify-center overflow-hidden bg-slate-700">
                {company.small_logo_thumb_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img 
                    src={company.small_logo_thumb_url} 
                    alt={`${company.name} logo`}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      // Fallback to letter avatar if logo fails to load
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <span className={`text-white font-bold text-2xl ${company.small_logo_thumb_url ? 'hidden' : ''}`}>
                  {company.name.charAt(0)}
                </span>
              </div>
            </div>

            {/* Company Details */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-white">{company.name}</h1>
                <span className="px-3 py-1 bg-orange-600/20 text-orange-300 border border-orange-600/30 rounded-full text-sm font-medium">
                  YC {company.batch}
                </span>
                {company.company_status && company.company_status !== 'Unknown' && (
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    company.company_status === 'Active' ? 'bg-green-600/20 text-green-300 border border-green-600/30' :
                    company.company_status === 'Acquired' ? 'bg-blue-600/20 text-blue-300 border border-blue-600/30' :
                    company.company_status === 'Public' ? 'bg-purple-600/20 text-purple-300 border border-purple-600/30' :
                    'bg-slate-600/20 text-slate-300 border border-slate-600/30'
                  }`}>
                    {company.company_status}
                  </span>
                )}
                {company.is_hiring && (
                  <span className="px-3 py-1 bg-green-900/30 text-green-300 border border-green-600/30 rounded-full text-sm flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    Hiring
                  </span>
                )}
              </div>
              
              <p className="text-slate-300 text-lg mb-4">{company.one_liner}</p>
              
              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2 text-slate-400">
                  <UsersIcon className="h-4 w-4" />
                  <span>{company.team_size || 'N/A'} employees</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <MapPinIcon className="h-4 w-4" />
                  <span>{company.headquarters !== 'Unknown' ? company.headquarters : 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <GlobeAltIcon className="h-4 w-4" />
                  <span>Founded {company.founded !== 'Unknown' ? company.founded : 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="text-cyan-400">●</span>
                  <span>{company.industry_detailed || company.industry || 'N/A'}</span>
                </div>
              </div>
              
              {/* Social Share */}
              <div className="mt-4 pt-4 border-t border-slate-700/50">
                <SocialShare company={company} />
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Spearfish Score */}
        <div className="flex-shrink-0">
          <div className="bg-slate-900/50 rounded-xl p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <StarIcon className="h-5 w-5 text-yellow-400" />
              <span className="text-slate-300 font-medium">Spearfish Score</span>
            </div>
            <div className={`text-4xl font-bold ${getScoreColor(company.spearfish_score)} mb-1`}>
              {company.spearfish_score.toFixed(1)}
            </div>
            <div className="text-slate-400 text-sm mb-3">
              {getScoreLabel(company.spearfish_score)}
            </div>
            {company.spearfish_score >= 8 && (
              <div className="flex items-center justify-center gap-1 text-green-400 text-sm">
                <ArrowTrendingUpIcon className="h-4 w-4" />
                <span>High Growth</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}