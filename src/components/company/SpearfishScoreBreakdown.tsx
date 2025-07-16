/**
 * Spearfish Score Breakdown Component
 * 
 * Displays detailed breakdown of spearfish scoring algorithm with explanations
 */

'use client';

import { useState, useEffect } from 'react';
import { ChevronDownIcon, ChevronRightIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

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
            Algorithm Version: <span className="text-white">1.0</span>
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
                      <div className="font-medium text-white">{criterion.title}</div>
                      <div className="text-sm text-slate-400">{criterion.description}</div>
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
                      <div className="mt-3 grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-slate-400">Raw Score:</span>
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

      {/* Score History */}
      {scoreHistory.length > 1 && (
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
          <h4 className="text-lg font-medium text-white mb-4">Score History</h4>
          <div className="space-y-3">
            {scoreHistory.slice(0, 5).map((score, index) => (
              <div key={score.id} className="flex items-center justify-between p-3 bg-slate-900/30 rounded-lg">
                <div>
                  <div className="text-white font-medium">{score.spearfish_score.toFixed(1)}</div>
                  <div className="text-xs text-slate-400">
                    {new Date(score.calculated_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-300">{(score.confidence * 100).toFixed(0)}% confidence</div>
                  {index === 0 && <div className="text-xs text-green-400">Current</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}