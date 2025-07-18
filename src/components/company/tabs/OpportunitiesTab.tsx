/**
 * Opportunities Tab Component
 * 
 * Job opportunities and "Why Spearfish This Company" section
 */

interface OpportunitiesTabProps {
  company: any;
}

export function OpportunitiesTab({ company }: OpportunitiesTabProps) {
  // Generate spearfish reasons based on actual company data
  const getSpearfishReasons = () => {
    const reasons = [];
    
    // Score-based insights
    if (company.spearfish_score && company.spearfish_score >= 8) {
      reasons.push({
        icon: '🎯',
        title: 'High Spearfish Score',
        description: `Strong score of ${company.spearfish_score}/10 indicates excellent market positioning and growth potential.`,
        confidence: 'high'
      });
    }
    
    // Score breakdown insights (if available)
    if (company.scoreBreakdown) {
      const breakdown = company.scoreBreakdown.breakdown;
      
      if (breakdown.batchFocus >= 8) {
        reasons.push({
          icon: '🚀',
          title: 'Target Batch Company',
          description: `From ${company.batch} batch, which is highly valued by our algorithm.`,
          confidence: 'high'
        });
      }
      
      if (breakdown.companyAge >= 7) {
        reasons.push({
          icon: '⏰',
          title: 'Optimal Company Age',
          description: 'Company age is in the sweet spot for growth and market traction.',
          confidence: 'medium'
        });
      }
      
      if (breakdown.fundingStage >= 7) {
        reasons.push({
          icon: '💰',
          title: 'Strong Funding Position',
          description: 'Company is in an optimal funding stage for growth and expansion.',
          confidence: 'medium'
        });
      }
      
      if (breakdown.githubActivity >= 6) {
        reasons.push({
          icon: '💻',
          title: 'Active Technical Development',
          description: 'Strong GitHub activity indicates robust technical team and product development.',
          confidence: 'medium'
        });
      }
    }
    
    if (company.batch && ['W24', 'S24', 'W23', 'S23'].includes(company.batch)) {
      reasons.push({
        icon: '🚀',
        title: 'Recent YC Graduate',
        description: `${company.batch} batch company with fresh momentum and Y Combinator backing.`
      });
    }
    
    if (company.is_hiring) {
      reasons.push({
        icon: '📈',
        title: 'Actively Hiring',
        description: 'Currently expanding team, indicating growth phase and new opportunities.'
      });
    }
    
    if (company.tags && Array.isArray(company.tags) && company.tags.some((tag: string) => ['AI', 'ML', 'Machine Learning', 'Artificial Intelligence'].includes(tag))) {
      reasons.push({
        icon: '🤖',
        title: 'AI-First Company',
        description: 'Building in the AI space with strong technical fundamentals and market demand.'
      });
    }
    
    if (company.team_size && company.team_size >= 10 && company.team_size <= 50) {
      reasons.push({
        icon: '⚡',
        title: 'Optimal Team Size',
        description: `Team of ${company.team_size} is at the sweet spot for rapid execution and meaningful impact.`
      });
    }
    
    if (company.github_repos && Array.isArray(company.github_repos) && company.github_repos.length > 0) {
      reasons.push({
        icon: '💻',
        title: 'Strong Engineering',
        description: `Active GitHub presence with ${company.github_repos.length} repositories showing technical depth.`
      });
    }
    
    // Add industry-specific reasons
    if (company.industry && ['Artificial Intelligence', 'Machine Learning', 'Developer Tools'].includes(company.industry)) {
      reasons.push({
        icon: '🔧',
        title: 'High-Growth Industry',
        description: `Operating in ${company.industry}, a rapidly expanding market with significant opportunities.`
      });
    }
    
    return reasons;
  };

  const spearfishReasons = getSpearfishReasons();

  return (
    <div className="space-y-6">
      {/* Why Spearfish This Company */}
      <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Why Spearfish This Company</h3>
        
        {spearfishReasons.length > 0 ? (
          <div className="space-y-4">
            {spearfishReasons.map((reason, index) => (
              <div key={index} className="flex items-start gap-3 p-4 bg-slate-900/50 rounded-lg">
                <span className="text-2xl">{reason.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-slate-200 font-medium">{reason.title}</h4>
                    {reason.confidence && (
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        reason.confidence === 'high' 
                          ? 'bg-green-500/20 text-green-300' 
                          : reason.confidence === 'medium'
                          ? 'bg-yellow-500/20 text-yellow-300'
                          : 'bg-slate-500/20 text-slate-300'
                      }`}>
                        {reason.confidence} confidence
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-sm">{reason.description}</p>
                </div>
              </div>
            ))}
            
            {/* Overall Assessment */}
            <div className="mt-6 p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <h4 className="text-purple-300 font-medium mb-2">Overall Assessment</h4>
              <p className="text-slate-300 text-sm">
                {company.spearfish_score >= 8 
                  ? "This company shows exceptional promise with strong fundamentals and growth indicators."
                  : company.spearfish_score >= 6 
                  ? "This company demonstrates solid potential with several positive indicators."
                  : "This company has interesting aspects worth monitoring for future opportunities."
                }
              </p>
            </div>
          </div>
        ) : (
          <div className="text-slate-400">
            <p>No specific signals identified yet.</p>
            <p className="text-sm mt-2">Analysis will improve as more company data becomes available.</p>
          </div>
        )}
      </div>

      {/* Current Opportunities */}
      <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Current Opportunities</h3>
        
        {company.is_hiring ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              <div className="flex-1">
                <h4 className="text-green-300 font-medium">Currently Hiring</h4>
                <p className="text-slate-400 text-sm">This company is actively expanding their team.</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {company.website_url && (
                <a
                  href={`${company.website_url}/careers`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 bg-slate-900/50 rounded-lg hover:bg-slate-700/50 transition-colors"
                >
                  <span>🌐</span>
                  <div>
                    <div className="text-slate-200 text-sm font-medium">Company Careers</div>
                    <div className="text-slate-400 text-xs">Visit careers page</div>
                  </div>
                </a>
              )}
              
              <a
                href={`https://www.ycombinator.com/companies/${company.name.toLowerCase().replace(/\s+/g, '-')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 bg-slate-900/50 rounded-lg hover:bg-slate-700/50 transition-colors"
              >
                <span>🚀</span>
                <div>
                  <div className="text-slate-200 text-sm font-medium">YC Company Page</div>
                  <div className="text-slate-400 text-xs">View on Y Combinator</div>
                </div>
              </a>
            </div>
            
            <div className="text-slate-400 text-sm p-3 bg-slate-900/30 rounded-lg">
              <p><strong>Pro tip:</strong> Research the company thoroughly before reaching out. Check their recent updates, team members on LinkedIn, and recent GitHub activity.</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6.5" />
              </svg>
            </div>
            <h4 className="text-lg font-medium text-white mb-2">Not Currently Hiring</h4>
            <p className="text-slate-400 max-w-md mx-auto mb-4">
              This company isn&apos;t actively hiring right now, but that could change quickly in the startup world.
            </p>
            <div className="text-slate-400 text-sm">
              <p><strong>Stay connected:</strong> Follow their progress and be ready when opportunities arise.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}