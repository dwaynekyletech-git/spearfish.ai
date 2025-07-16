/**
 * Overview Tab Component
 * 
 * General company information and key metrics with YC data and growth metrics
 */

interface OverviewTabProps {
  company: any;
}

export function OverviewTab({ company }: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Company Description */}
      <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4">About {company.name}</h3>
        <p className="text-slate-300 leading-relaxed mb-4">
          {company.long_description || company.one_liner}
        </p>
        {company.yc_data && (
          <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-700/50">
            <div className="flex items-center gap-2">
              <span className="text-orange-400 font-medium">YC {company.yc_data.batch}</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-400">Founded {company.founded}</span>
            </div>
            {company.yc_data.stage && company.yc_data.stage !== 'Unknown' && (
              <div className="flex items-center gap-2">
                <span className="text-slate-400">•</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  company.yc_data.stage === 'Active' ? 'bg-green-600/20 text-green-300' :
                  company.yc_data.stage === 'Acquired' ? 'bg-blue-600/20 text-blue-300' :
                  company.yc_data.stage === 'Public' ? 'bg-purple-600/20 text-purple-300' :
                  'bg-slate-600/20 text-slate-300'
                }`}>
                  {company.yc_data.stage}
                </span>
              </div>
            )}
            {company.yc_data.hiring_status && (
              <div className="flex items-center gap-2">
                <span className="text-slate-400">•</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  company.is_hiring ? 'bg-green-600/20 text-green-300' : 'bg-slate-600/20 text-slate-300'
                }`}>
                  {company.yc_data.hiring_status}
                </span>
              </div>
            )}
            {company.yc_data.founders && company.yc_data.founders.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Founders:</span>
                <span className="text-slate-300">{company.yc_data.founders.join(', ')}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Enhanced Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
          <h4 className="text-lg font-medium text-white mb-2">Industry</h4>
          <div className="text-2xl font-bold text-cyan-400 mb-1">
            {company.industry_detailed || company.industry || 'N/A'}
          </div>
          <div className="text-slate-400 text-sm">
            {company.yc_data?.subindustry && company.yc_data.subindustry !== company.industry ? 
              company.yc_data.subindustry : 'Primary focus'}
          </div>
        </div>
        
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
          <h4 className="text-lg font-medium text-white mb-2">Status</h4>
          <div className={`text-2xl font-bold mb-1 ${
            company.company_status === 'Active' ? 'text-green-400' :
            company.company_status === 'Acquired' ? 'text-blue-400' :
            company.company_status === 'Public' ? 'text-purple-400' :
            'text-slate-400'
          }`}>
            {company.company_status || 'Unknown'}
          </div>
          <div className="text-slate-400 text-sm">
            {company.funding_stage !== 'Unknown' ? company.funding_stage : 'current status'}
          </div>
        </div>
        
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
          <h4 className="text-lg font-medium text-white mb-2">Team Size</h4>
          <div className="text-2xl font-bold text-blue-400 mb-1">{company.team_size || 'N/A'}</div>
          <div className="text-slate-400 text-sm">
            {company.is_hiring ? 'Hiring' : 'Not hiring'}
          </div>
        </div>
        
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
          <h4 className="text-lg font-medium text-white mb-2">Headquarters</h4>
          <div className="text-2xl font-bold text-yellow-400 mb-1">
            {company.headquarters !== 'Unknown' ? company.headquarters : 'N/A'}
          </div>
          <div className="text-slate-400 text-sm">
            {company.founded !== 'Unknown' ? `Since ${company.founded}` : 'location'}
          </div>
        </div>
      </div>

      {/* Growth Metrics */}
      {company.growth_metrics && (
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Growth Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Employee Growth Chart */}
            <div>
              <h4 className="text-lg font-medium text-white mb-3">Employee Growth</h4>
              <div className="space-y-2">
                {company.growth_metrics?.employee_growth && Array.isArray(company.growth_metrics.employee_growth) && company.growth_metrics.employee_growth.length > 0 ? (
                  company.growth_metrics.employee_growth.map((data: any, index: number) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-slate-400">{data.date}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-700 rounded-full h-2 overflow-hidden">
                          <div 
                            className="bg-blue-400 h-full transition-all duration-300"
                            style={{ width: `${(data.count / 150) * 100}%` }}
                          />
                        </div>
                        <span className="text-slate-300 text-sm w-12">{data.count}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 text-sm">No employee growth data available</p>
                )}
              </div>
            </div>

            {/* Funding History */}
            <div>
              <h4 className="text-lg font-medium text-white mb-3">Funding History</h4>
              <div className="space-y-3">
                {company.growth_metrics?.funding_rounds && Array.isArray(company.growth_metrics.funding_rounds) && company.growth_metrics.funding_rounds.length > 0 ? (
                  company.growth_metrics.funding_rounds.map((round: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                      <div>
                        <div className="text-slate-300 font-medium">{round.round}</div>
                        <div className="text-slate-400 text-sm">{round.date}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-green-400 font-medium">{round.amount}</div>
                        <div className="text-slate-400 text-sm">
                          {Array.isArray(round.investors) ? `${round.investors.length} investors` : round.investors}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 text-sm">No funding information available</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Milestones */}
      {company.growth_metrics?.product_milestones && Array.isArray(company.growth_metrics.product_milestones) && company.growth_metrics.product_milestones.length > 0 && (
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Product Milestones</h3>
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-purple-400"></div>
            <div className="space-y-6">
              {company.growth_metrics?.product_milestones && Array.isArray(company.growth_metrics.product_milestones) && company.growth_metrics.product_milestones.length > 0 ? (
                company.growth_metrics.product_milestones.map((milestone: any, index: number) => (
                  <div key={index} className="relative flex items-start gap-4">
                    <div className="w-8 h-8 bg-purple-400 rounded-full flex items-center justify-center flex-shrink-0">
                      <div className="w-3 h-3 bg-white rounded-full"></div>
                    </div>
                    <div className="flex-1">
                      <div className="text-slate-300 font-medium">{milestone.milestone}</div>
                      <div className="text-slate-400 text-sm">{milestone.date}</div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-400 text-sm">No product milestones available</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Technologies & Focus Areas */}
      <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Technologies & Focus Areas</h3>
        <div className="flex flex-wrap gap-2">
          {company.technology_tags && Array.isArray(company.technology_tags) && company.technology_tags.length > 0 ? (
            company.technology_tags.map((tag: string, index: number) => (
              <span
                key={index}
                className="px-3 py-1 bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-purple-300 border border-purple-600/30 rounded-full text-sm font-medium"
              >
                {tag}
              </span>
            ))
          ) : company.tags && Array.isArray(company.tags) && company.tags.length > 0 ? (
            company.tags.map((tag: string, index: number) => (
              <span
                key={index}
                className="px-3 py-1 bg-slate-700/50 text-slate-300 rounded-full text-sm"
              >
                {tag}
              </span>
            ))
          ) : (
            <div className="text-center py-4">
              <p className="text-slate-400 text-sm mb-2">No specific technologies listed</p>
              <p className="text-slate-500 text-xs">
                Technology stack and focus areas will be added when available
              </p>
            </div>
          )}
        </div>
        
        {/* Industry Tags */}
        {company.industry && (
          <div className="mt-4 pt-4 border-t border-slate-700/50">
            <h4 className="text-sm font-medium text-slate-400 mb-2">Industry Focus</h4>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-cyan-600/20 text-cyan-300 border border-cyan-600/30 rounded-full text-sm">
                {company.industry}
              </span>
              {company.yc_data?.subindustry && company.yc_data.subindustry !== company.industry && (
                <span className="px-3 py-1 bg-blue-600/20 text-blue-300 border border-blue-600/30 rounded-full text-sm">
                  {company.yc_data.subindustry}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}