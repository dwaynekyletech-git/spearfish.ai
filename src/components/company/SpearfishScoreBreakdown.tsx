/**
 * Spearfish Score Breakdown Component
 * 
 * Displays detailed breakdown of spearfish scoring algorithm with explanations
 */

'use client';

import { useState, useEffect } from 'react';
import { ChevronDownIcon, ChevronRightIcon, InformationCircleIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';

interface ScoreBreakdown {
  targetBatch: number;
  companyAge: number;
  fundingStage: number;
  githubActivity: number;
  b2bFocus: number;
  huggingfaceActivity: number;
  conferencePresence: number;
  nameQuality: number;
  hiringStatus: number;
}

interface ScoreWeights {
  targetBatch: number;
  companyAge: number;
  fundingStage: number;
  githubActivity: number;
  b2bFocus: number;
  huggingfaceActivity: number;
  conferencePresence: number;
  nameQuality: number;
  hiringStatus: number;
}

interface ScoreHistory {
  id: string;
  spearfish_score: number;
  normalized_score: number;
  score_breakdown: ScoreBreakdown;
  confidence: number;
  calculated_at: string;
}

interface SpearfishScoreBreakdownProps {
  company: any;
}

interface CriterionInfo {
  title: string;
  description: string;
  weight: number;
  category: 'heavy' | 'high' | 'medium' | 'low';
  explanation: string;
}

const CRITERIA_INFO: Record<keyof ScoreBreakdown, CriterionInfo> = {
  targetBatch: {
    title: 'Target Batch',
    description: 'YC batch timing alignment with investment criteria',
    weight: 40,
    category: 'heavy',
    explanation: 'Companies from W22, S22, and W23 batches score highest as they align with optimal timing for Series A investments.'
  },
  companyAge: {
    title: 'Company Age',
    description: 'Optimal maturity for Series A funding (18-24 months)',
    weight: 15,
    category: 'high',
    explanation: 'Companies aged 18-24 months are in the sweet spot for Series A funding, having proven initial traction but still with high growth potential.'
  },
  fundingStage: {
    title: 'Funding Stage',
    description: 'Current funding stage and readiness for Series A',
    weight: 15,
    category: 'high',
    explanation: 'Companies showing readiness for or actively raising Series A funding receive higher scores based on their funding trajectory.'
  },
  githubActivity: {
    title: 'GitHub Activity',
    description: 'Developer engagement and star growth rate',
    weight: 7,
    category: 'medium',
    explanation: 'High GitHub star growth (>1K/month) indicates strong developer adoption and technical product-market fit.'
  },
  b2bFocus: {
    title: 'B2B Focus',
    description: 'Business-to-business market positioning',
    weight: 7,
    category: 'medium',
    explanation: 'B2B companies often have more predictable revenue models and clearer paths to enterprise sales scalability.'
  },
  huggingfaceActivity: {
    title: 'HuggingFace Activity',
    description: 'AI/ML model downloads and community engagement',
    weight: 6,
    category: 'medium',
    explanation: 'High HuggingFace model downloads (>100K) indicate strong AI/ML product adoption and technical credibility.'
  },
  conferencePresence: {
    title: 'Conference Presence',
    description: 'Industry conference participation and thought leadership',
    weight: 3,
    category: 'low',
    explanation: 'Active participation in industry conferences indicates market engagement and thought leadership potential.'
  },
  nameQuality: {
    title: 'Name Quality',
    description: 'Brand name memorability and professional appeal',
    weight: 4,
    category: 'low',
    explanation: 'Non-generic, memorable company names often correlate with stronger brand positioning and market differentiation.'
  },
  hiringStatus: {
    title: 'Hiring Status',
    description: 'Active talent acquisition indicating growth',
    weight: 3,
    category: 'low',
    explanation: 'Companies actively hiring demonstrate confidence in their growth trajectory and investment in scaling their team.'
  }
};

const CATEGORY_COLORS = {
  heavy: 'text-red-400 bg-red-400/10 border-red-400/20',
  high: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  medium: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  low: 'text-blue-400 bg-blue-400/10 border-blue-400/20'
};

const CATEGORY_LABELS = {
  heavy: 'Heavy Weight (40%)',
  high: 'High Weight (30%)',
  medium: 'Medium Weight (20%)',
  low: 'Low Weight (10%)'
};

export function SpearfishScoreBreakdown({ company }: SpearfishScoreBreakdownProps) {
  const [scoreHistory, setScoreHistory] = useState<ScoreHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  const [expandedCriteria, setExpandedCriteria] = useState<Set<string>>(new Set());
  const [showMethodology, setShowMethodology] = useState(false);

  // Fetch score history
  useEffect(() => {
    const fetchScoreHistory = async () => {
      if (!company?.id) return;
      
      try {
        const response = await fetch(`/api/companies/${company.id}/score-history`);
        if (response.ok) {
          const data = await response.json();
          setScoreHistory(data.data?.history || []);
        }
      } catch (error) {
        console.error('Error fetching score history:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchScoreHistory();
  }, [company?.id]);

  // Calculate spearfish score
  const calculateScore = async (forceRecalculate = false) => {
    if (!company?.id) return;
    
    setIsCalculating(true);
    try {
      const response = await fetch(`/api/companies/${company.id}/calculate-score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ forceRecalculate }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Refresh score history
          const historyResponse = await fetch(`/api/companies/${company.id}/score-history`);
          if (historyResponse.ok) {
            const historyData = await historyResponse.json();
            setScoreHistory(historyData.data?.history || []);
          }
          
          // Update company score in parent (if possible)
          if (data.data?.score) {
            company.spearfish_score = data.data.score;
          }
        }
      }
    } catch (error) {
      console.error('Error calculating score:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  const toggleCriterion = (criterion: string) => {
    const newExpanded = new Set(expandedCriteria);
    if (newExpanded.has(criterion)) {
      newExpanded.delete(criterion);
    } else {
      newExpanded.add(criterion);
    }
    setExpandedCriteria(newExpanded);
  };

  // Get latest score data or use company data
  const latestScore = scoreHistory[0];
  const currentScore = company?.spearfish_score || 0;
  const scoreBreakdown = latestScore?.score_breakdown || {};
  const confidence = latestScore?.confidence || 0;

  // Calculate weighted contribution for each criterion
  const calculateContribution = (score: number, weight: number): number => {
    return (score * weight) / 100;
  };

  // Get raw data values for transparency
  const getRawDataValues = (criterionKey: string) => {
    switch (criterionKey) {
      case 'targetBatch':
        return {
          label: 'Batch',
          value: company?.batch || 'Unknown',
          expected: 'W22, S22, or W23 for max score'
        };
      
      case 'companyAge':
        if (company?.launched_at) {
          const launchDate = new Date(company.launched_at * 1000);
          const monthsOld = Math.round((Date.now() - launchDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
          return {
            label: 'Company Age',
            value: `${monthsOld} months`,
            expected: '18-24 months for max score'
          };
        }
        return {
          label: 'Company Age',
          value: 'Unknown launch date',
          expected: '18-24 months for max score'
        };
      
      case 'githubActivity':
        const repos = company?.github_repos || [];
        const totalStars = repos.reduce((sum: number, repo: any) => sum + (repo.stars_count || 0), 0);
        const totalForks = repos.reduce((sum: number, repo: any) => sum + (repo.forks_count || 0), 0);
        return {
          label: 'GitHub Activity',
          value: `${totalStars} stars, ${totalForks} forks (${repos.length} repos)`,
          expected: '10,000+ stars for max score'
        };
      
      case 'huggingfaceActivity':
        const models = company?.huggingface_models || [];
        const totalDownloads = models.reduce((sum: number, model: any) => sum + (model.downloads || 0), 0);
        const totalLikes = models.reduce((sum: number, model: any) => sum + (model.likes || 0), 0);
        return {
          label: 'HuggingFace Activity',
          value: `${totalDownloads.toLocaleString()} downloads, ${totalLikes} likes (${models.length} models)`,
          expected: '1M+ downloads for max score'
        };
      
      case 'b2bFocus':
        const b2bKeywords = ['b2b', 'business', 'enterprise', 'saas', 'api', 'platform', 'developer'];
        const text = `${company?.one_liner || ''} ${company?.long_description || ''}`.toLowerCase();
        const foundKeywords = b2bKeywords.filter(keyword => text.includes(keyword));
        return {
          label: 'B2B Focus',
          value: foundKeywords.length > 0 ? `Found: ${foundKeywords.join(', ')}` : 'No B2B keywords found',
          expected: 'B2B keywords in description'
        };
      
      case 'hiringStatus':
        return {
          label: 'Hiring Status',
          value: company?.is_hiring ? 'Currently hiring' : 'Not actively hiring',
          expected: 'Active hiring for max score'
        };
      
      case 'fundingStage':
        if (company?.launched_at) {
          const monthsOld = Math.round((Date.now() - new Date(company.launched_at * 1000).getTime()) / (1000 * 60 * 60 * 24 * 30.44));
          let stage = 'Too early';
          if (monthsOld >= 18 && monthsOld <= 30) stage = 'Series A ready';
          else if (monthsOld >= 12 && monthsOld <= 36) stage = 'Approaching Series A';
          else if (monthsOld >= 6 && monthsOld <= 42) stage = 'Possible Series A';
          else if (monthsOld > 42) stage = 'Past typical Series A';
          
          return {
            label: 'Funding Stage',
            value: `${stage} (${monthsOld} months old)`,
            expected: '18-30 months for Series A readiness'
          };
        }
        return {
          label: 'Funding Stage',
          value: 'Unknown (no launch date)',
          expected: '18-30 months for Series A readiness'
        };
      
      case 'nameQuality':
        const boringPatterns = [
          /^(AI|ML|Data|Tech|Cyber|Cloud|Digital|Smart|Auto|Micro|Nano|Meta|Super|Ultra|Hyper)/i,
          /Corp$|Inc$|LLC$|Ltd$/i,
          /\d{4}$/,
          /^[A-Z]{2,4}$/,
        ];
        const isBoring = boringPatterns.some(pattern => pattern.test(company?.name || ''));
        return {
          label: 'Name Quality',
          value: isBoring ? 'Generic/boring name pattern' : 'Unique, memorable name',
          expected: 'Avoid generic tech prefixes/suffixes'
        };
      
      case 'conferencePresence':
        const text2 = `${company?.one_liner || ''} ${company?.long_description || ''}`.toLowerCase();
        const conferenceKeywords = ['conference', 'summit', 'event', 'speaking', 'presenting', 'keynote'];
        const foundConferenceKeywords = conferenceKeywords.filter(keyword => text2.includes(keyword));
        return {
          label: 'Conference Presence',
          value: foundConferenceKeywords.length > 0 ? `Found: ${foundConferenceKeywords.join(', ')}` : 'No conference keywords found',
          expected: 'Conference/speaking mentions'
        };
      
      default:
        return {
          label: 'Unknown',
          value: 'N/A',
          expected: 'N/A'
        };
    }
  };

  // Get scoring methodology tooltip for each criterion
  const getScoringTooltip = (criterionKey: string) => {
    switch (criterionKey) {
      case 'targetBatch':
        return "Companies from W22, S22, W23 batches score 10/10. All other batches score 0/10. These batches align with optimal Series A investment timing.";
      
      case 'companyAge':
        return "Perfect score (10/10) for 18-24 months old. Score decreases by 0.5 per month if younger than 18 months, or by 0.3 per month if older than 24 months.";
      
      case 'githubActivity':
        return "Multi-factor scoring: Stars (40%), Repo Quality (30%), Forks (20%), Flagship Strength (10%). 10,000+ stars = max score. Indicates strong developer adoption.";
      
      case 'huggingfaceActivity':
        return "Multi-factor scoring: Downloads (45%), Likes (25%), Portfolio (20%), Flagship (10%). 1M+ downloads = max score. Shows AI/ML product traction.";
      
      case 'b2bFocus':
        return "Scans company description for B2B keywords: 'b2b', 'enterprise', 'saas', 'api', 'platform', 'developer'. Each keyword adds ~2 points.";
      
      case 'fundingStage':
        return "Based on company age as proxy for Series A readiness. 18-30 months = 10/10 (optimal timing). 12-36 months = 7/10. Outside range scores lower.";
      
      case 'hiringStatus':
        return "Simple binary: Currently hiring = 8/10, Not hiring = 4/10. Active hiring indicates growth confidence.";
      
      case 'nameQuality':
        return "Inverse of 'boring' names. Generic tech prefixes (AI-, ML-, Tech-) or suffixes (Corp, Inc) score 3/10. Unique names score 8/10.";
      
      case 'conferencePresence':
        return "Scans description for conference keywords: 'conference', 'summit', 'speaking', 'presenting'. Found keywords = 8/10, none = 2/10.";
      
      default:
        return "Scoring methodology information not available.";
    }
  };

  // Group criteria by category
  const criteriaByCategory = Object.entries(CRITERIA_INFO).reduce((acc, [key, info]) => {
    if (!acc[info.category]) acc[info.category] = [];
    acc[info.category].push({
      key: key as keyof ScoreBreakdown,
      ...info,
      score: scoreBreakdown[key as keyof ScoreBreakdown] || 0
    });
    return acc;
  }, {} as Record<string, any[]>);

  // Simple tooltip component
  const Tooltip = ({ children, content }: { children: React.ReactNode; content: string }) => {
    const [isVisible, setIsVisible] = useState(false);

    return (
      <div 
        className="relative inline-block"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
        {isVisible && (
          <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 text-xs text-white bg-slate-900 border border-slate-600 rounded-lg shadow-lg max-w-xs">
            {content}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
          </div>
        )}
      </div>
    );
  };

  const ScoreBar = ({ score, maxScore = 10 }: { score: number; maxScore?: number }) => {
    const percentage = (score / maxScore) * 100;
    const getColorClass = () => {
      if (percentage >= 80) return 'bg-green-400';
      if (percentage >= 60) return 'bg-yellow-400';
      if (percentage >= 40) return 'bg-orange-400';
      return 'bg-red-400';
    };

    return (
      <div className="flex items-center space-x-3">
        <div className="flex-1 bg-slate-700 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${getColorClass()}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        <span className="text-sm font-medium text-white min-w-[3rem] text-right">
          {score.toFixed(1)}/10
        </span>
      </div>
    );
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-700 rounded w-48"></div>
          <div className="h-4 bg-slate-700 rounded w-full"></div>
          <div className="h-4 bg-slate-700 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  // Show no score state with calculation option
  if (!currentScore && !isCalculating) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Spearfish Score</h3>
        <div className="text-center py-8">
          <div className="text-slate-400 mb-4">No spearfish score calculated yet</div>
          <p className="text-sm text-slate-500 mb-6">
            Click below to calculate the spearfish score for this company using our weighted algorithm.
          </p>
          <button
            onClick={() => calculateScore(false)}
            disabled={isCalculating}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
          >
            Calculate Spearfish Score
          </button>
        </div>
      </div>
    );
  }

  // Show calculating state
  if (isCalculating) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Spearfish Score</h3>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mx-auto mb-4"></div>
          <div className="text-slate-400">Calculating spearfish score...</div>
          <div className="text-sm text-slate-500 mt-2">This may take a few seconds</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">Spearfish Score</h3>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => calculateScore(true)}
              disabled={isCalculating}
              className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:cursor-not-allowed text-slate-300 hover:text-white rounded transition-colors"
            >
              {isCalculating ? 'Calculating...' : 'Recalculate'}
            </button>
            <div className="text-right">
              <div className="text-3xl font-bold text-white">{currentScore.toFixed(1)}</div>
              <div className="text-sm text-slate-400">out of 10.0</div>
            </div>
          </div>
        </div>

        {/* Overall score bar */}
        <ScoreBar score={currentScore} />

        {/* Confidence and metadata */}
        <div className="mt-4 flex items-center justify-between text-sm">
          <div className="text-slate-400">
            Confidence: <span className="text-white">{(confidence * 100).toFixed(0)}%</span>
          </div>
          <div className="text-slate-400">
            Algorithm Version: <span className="text-white">{latestScore?.algorithm_version || '2.0'}</span>
          </div>
        </div>

        {/* Methodology toggle */}
        <button
          onClick={() => setShowMethodology(!showMethodology)}
          className="mt-4 flex items-center space-x-2 text-purple-400 hover:text-purple-300 transition-colors"
        >
          <InformationCircleIcon className="h-4 w-4" />
          <span className="text-sm">How is this score calculated?</span>
        </button>

        {showMethodology && (
          <div className="mt-4 p-4 bg-slate-900/50 rounded-lg border border-slate-600/30">
            <div className="text-sm text-slate-300 space-y-2">
              <p>
                The Spearfish Score evaluates companies using a weighted algorithm based on spearfishing methodology - 
                targeting high-value opportunities with precision rather than casting wide nets.
              </p>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <div className="font-medium text-white mb-1">Weight Distribution:</div>
                  <div className="space-y-1 text-xs">
                    <div>• Heavy (40%): Target batch alignment</div>
                    <div>• High (30%): Age & funding readiness</div>
                    <div>• Medium (20%): Technical traction</div>
                    <div>• Low (10%): Market signals</div>
                  </div>
                </div>
                <div>
                  <div className="font-medium text-white mb-1">Score Ranges:</div>
                  <div className="space-y-1 text-xs">
                    <div>• 8.0-10.0: Prime targets</div>
                    <div>• 6.0-7.9: Strong candidates</div>
                    <div>• 4.0-5.9: Worth monitoring</div>
                    <div>• 0.0-3.9: Low priority</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Detailed Breakdown by Category */}
      {Object.entries(criteriaByCategory).map(([category, criteria]) => (
        <div key={category} className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-medium text-white">{CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}</h4>
            <span className={`px-2 py-1 rounded text-xs font-medium border ${CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS]}`}>
              {category.toUpperCase()}
            </span>
          </div>

          <div className="space-y-4">
            {criteria.map((criterion) => (
              <div key={criterion.key} className="border border-slate-700/30 rounded-lg p-4">
                <button
                  onClick={() => toggleCriterion(criterion.key)}
                  className="w-full flex items-center justify-between text-left hover:bg-slate-700/20 transition-colors rounded p-2 -m-2"
                >
                  <div className="flex items-center space-x-3">
                    {expandedCriteria.has(criterion.key) ? (
                      <ChevronDownIcon className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronRightIcon className="h-4 w-4 text-slate-400" />
                    )}
                    <div>
                      <div className="flex items-center space-x-2">
                        <div className="font-medium text-white">{criterion.title}</div>
                        <Tooltip content={getScoringTooltip(criterion.key)}>
                          <QuestionMarkCircleIcon className="h-4 w-4 text-slate-400 hover:text-slate-300 cursor-help" />
                        </Tooltip>
                      </div>
                      <div className="text-sm text-slate-400">{criterion.description}</div>
                      <div className="text-xs text-slate-500 mt-1 font-mono">
                        {getRawDataValues(criterion.key).value}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-white">{criterion.score.toFixed(1)}</div>
                    <div className="text-xs text-slate-400">{criterion.weight}% weight</div>
                  </div>
                </button>

                <div className="mt-3">
                  <ScoreBar score={criterion.score} />
                </div>

                {expandedCriteria.has(criterion.key) && (
                  <div className="mt-4 p-3 bg-slate-900/30 rounded-lg">
                    <div className="text-sm text-slate-300">
                      <div className="font-medium mb-2">Explanation:</div>
                      <p>{criterion.explanation}</p>
                      
                      {/* Raw Data Values */}
                      <div className="mt-3 p-3 bg-slate-800/40 rounded-lg border border-slate-600/30">
                        <div className="font-medium text-slate-200 mb-2">📊 Actual Data Used:</div>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-400">{getRawDataValues(criterion.key).label}:</span>
                            <span className="text-white font-mono">{getRawDataValues(criterion.key).value}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">For Max Score:</span>
                            <span className="text-green-400">{getRawDataValues(criterion.key).expected}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-3 grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-slate-400">Calculated Score:</span>
                          <span className="text-white ml-2">{criterion.score.toFixed(2)} / 10</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Weighted Contribution:</span>
                          <span className="text-white ml-2">{calculateContribution(criterion.score, criterion.weight).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

    </div>
  );
}