/**
 * Spear This! Tab Component
 * 
 * Deep research functionality for identifying actionable intelligence
 * and opportunities to create value-first outreach artifacts
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

interface SpearThisTabProps {
  company: any;
}

interface QuerySourceInfo {
  templateName: string;
  sourceCount: number;
  sources: {
    url: string;
    domain: string;
    title?: string;
    type: 'github' | 'blog' | 'news' | 'job' | 'documentation' | 'other';
    recency: 'recent' | 'moderate' | 'older';
  }[];
  completedAt: string;
}

interface ResearchSession {
  id: string;
  status: 'idle' | 'processing' | 'completed' | 'error' | 'in_progress';
  progress: number;
  total_queries: number;
  completed_queries: number;
  started_at: string;
  completed_at?: string;
  research_type: string;
  current_query?: string;
  active_queries?: string[];
  query_sources?: QuerySourceInfo[];
}

interface ResearchFinding {
  id: string;
  category: string;
  title: string;
  description: string;
  confidence_score: number;
  citations: string[];
  created_at: string;
}

const researchTypes = [
  {
    id: 'technical-challenges',
    name: 'Technical Challenges',
    description: 'GitHub issues, performance bottlenecks, scaling problems',
    icon: '🔧'
  },
  {
    id: 'business-intelligence',
    name: 'Business Intelligence', 
    description: 'Market positioning, growth challenges, competitive analysis',
    icon: '📊'
  },
  {
    id: 'team-dynamics',
    name: 'Team & Culture',
    description: 'Key decision makers, hiring patterns, team interests',
    icon: '👥'
  },
  {
    id: 'recent-activities',
    name: 'Recent Activities',
    description: 'Product launches, blog posts, news mentions',
    icon: '📰'
  },
  {
    id: 'comprehensive',
    name: 'Comprehensive Research',
    description: 'All research types combined for complete intelligence',
    icon: '🎯'
  }
];

export function SpearThisTab({ company }: SpearThisTabProps) {
  const [selectedResearchType, setSelectedResearchType] = useState('comprehensive');
  const [currentSession, setCurrentSession] = useState<ResearchSession | null>(null);
  const [researchHistory, setResearchHistory] = useState<ResearchSession[]>([]);
  const [researchFindings, setResearchFindings] = useState<ResearchFinding[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [researchLog, setResearchLog] = useState<{query: string; timestamp: Date; status: 'processing' | 'completed' | 'failed'; sources?: QuerySourceInfo}[]>([]);
  const [isResearchTypeExpanded, setIsResearchTypeExpanded] = useState(true);
  const [isReportExpanded, setIsReportExpanded] = useState(true);

  const loadResearchHistory = useCallback(async () => {
    try {
      const response = await fetch(`/api/companies/${company.id}/research/history`);
      if (response.ok) {
        const data = await response.json();
        setResearchHistory(data.sessions || []);
      }
    } catch (error) {
      console.error('Failed to load research history:', error);
    }
  }, [company.id]);

  // Load research history on component mount
  useEffect(() => {
    loadResearchHistory();
  }, [loadResearchHistory]);

  const startResearch = async () => {
    setIsLoading(true);
    setResearchLog([]); // Clear previous research log
    setResearchFindings([]); // Clear previous findings
    
    // Auto-collapse the research type section when starting research
    setIsResearchTypeExpanded(false);
    
    try {
      const response = await fetch(`/api/companies/${company.id}/research/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          research_type: selectedResearchType,
          company_data: {
            name: company.name,
            website: company.website,
            description: company.long_description || company.one_liner,
            industry: company.industry
          }
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setCurrentSession(data.session);
        pollResearchProgress(data.session.id);
      } else {
        const errorData = await response.json().catch(() => null);
        console.error('Research start failed:', response.status, errorData);
        throw new Error(`Failed to start research: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to start research:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const pollResearchProgress = async (sessionId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/companies/${company.id}/research/${sessionId}/progress`);
        if (response.ok) {
          const data = await response.json();
          const previousSession = currentSession;
          setCurrentSession(data.session);
          
          // Update research log based on active queries
          if (data.session.active_queries && data.session.active_queries.length > 0) {
            setResearchLog(prev => {
              const newLog = [...prev];
              
              // Add new queries that aren't in the log yet
              data.session.active_queries.forEach((query: string) => {
                const queryExists = newLog.some(log => log.query === query);
                if (!queryExists) {
                  newLog.push({
                    query: query,
                    timestamp: new Date(),
                    status: 'processing'
                  });
                }
              });
              
              // Mark queries as completed if they're no longer in active queries
              const activeQueries = data.session.active_queries;
              return newLog.map(log => {
                if (log.status === 'processing' && !activeQueries.includes(log.query)) {
                  // Find matching source info for this completed query
                  // Extract the template name from the query string like "🔍 Analyzing Key Decision Makers Analysis: Processing..."
                  const queryTemplateName = log.query.replace('🔍 Analyzing ', '').split(':')[0];
                  const matchingSource = data.session.query_sources?.find((source: QuerySourceInfo) => 
                    source.templateName === queryTemplateName || 
                    log.query.includes(source.templateName) ||
                    source.templateName.includes(queryTemplateName)
                  );
                  
                  
                  return { 
                    ...log, 
                    status: 'completed' as const,
                    sources: matchingSource
                  };
                }
                return log;
              });
            });
          }
          
          // Add source information to completed queries from query_sources
          if (data.session.query_sources && data.session.query_sources.length > 0) {
            setResearchLog(prev => {
              return prev.map(log => {
                if (log.status === 'completed' && !log.sources) {
                  // Extract the template name from the query string like "🔍 Analyzing Key Decision Makers Analysis: Processing..."
                  const queryTemplateName = log.query.replace('🔍 Analyzing ', '').split(':')[0];
                  const matchingSource = data.session.query_sources.find((source: QuerySourceInfo) => 
                    source.templateName === queryTemplateName || 
                    log.query.includes(source.templateName) ||
                    source.templateName.includes(queryTemplateName)
                  );
                  if (matchingSource) {
                    return { ...log, sources: matchingSource };
                  }
                }
                return log;
              });
            });
          }
          
          if (data.session.status === 'completed' || data.session.status === 'error') {
            clearInterval(pollInterval);
            if (data.session.status === 'completed') {
              // Mark all remaining queries as completed
              setResearchLog(prev => prev.map(log => 
                log.status === 'processing' ? {...log, status: 'completed'} : log
              ));
              loadResearchResults(sessionId);
            }
            loadResearchHistory(); // Refresh history
          }
        }
      } catch (error) {
        console.error('Failed to poll progress:', error);
        clearInterval(pollInterval);
      }
    }, 3000); // Poll every 3 seconds for reasonable real-time updates

    // Clear interval after 5 minutes to prevent endless polling
    setTimeout(() => clearInterval(pollInterval), 300000);
  };

  const loadResearchResults = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/companies/${company.id}/research/${sessionId}/results`);
      if (response.ok) {
        const data = await response.json();
        setResearchFindings(data.findings || []);
      }
    } catch (error) {
      console.error('Failed to load results:', error);
    }
  };

  const viewPreviousResults = async (session: ResearchSession) => {
    await loadResearchResults(session.id);
    setCurrentSession(session);
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🎯</span>
          <div>
            <h2 className="text-2xl font-bold text-white">Spear This!</h2>
            <p className="text-slate-400">Deep research to identify actionable intelligence and artifact opportunities</p>
          </div>
        </div>
      </div>

      {/* Research Type Selection */}
      <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-xl font-semibold text-white">Select Research Type</h3>
          <button
            onClick={() => setIsResearchTypeExpanded(!isResearchTypeExpanded)}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-300 transition-colors"
          >
            <svg 
              className={`w-5 h-5 transition-transform duration-200 ${isResearchTypeExpanded ? 'rotate-90' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        
        <div className={`transition-all duration-300 ease-in-out ${
          isResearchTypeExpanded ? 'max-h-full opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
        }`}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {researchTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedResearchType(type.id)}
                className={`p-4 rounded-lg border transition-all ${
                  selectedResearchType === type.id
                    ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                    : 'bg-slate-700/30 border-slate-600 text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xl">{type.icon}</span>
                  <span className="font-medium">{type.name}</span>
                </div>
                <p className="text-sm text-slate-400">{type.description}</p>
              </button>
            ))}
          </div>
          
          <div className="mt-6">
            <button
              onClick={startResearch}
              disabled={isLoading || currentSession?.status === 'processing'}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all"
            >
              {isLoading || currentSession?.status === 'processing' ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Research in Progress...
                </div>
              ) : (
                'Start Deep Research'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Research Progress */}
      {currentSession && (currentSession.status === 'processing' || currentSession.status === 'in_progress') && (
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            Deep Research in Progress
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-slate-300">Progress</span>
              <span className="text-slate-300">{currentSession.completed_queries || 0} / {currentSession.total_queries || 0}</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all duration-500 relative overflow-hidden"
                style={{ width: `${currentSession.progress || 0}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
              </div>
            </div>
            
            {/* Current Query Display */}
            {currentSession.current_query && (
              <div className="bg-slate-700/40 rounded-lg p-4 border-l-4 border-purple-500">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-purple-400 text-sm font-medium">Currently Researching:</span>
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">
                  {currentSession.current_query}
                </p>
              </div>
            )}
            
            {/* Research Status */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-400">Status:</span>
                <span className="text-green-400 ml-2 font-medium">
                  {currentSession.status === 'processing' ? 'Processing Queries' : 'Initializing...'}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Started:</span>
                <span className="text-slate-300 ml-2">
                  {new Date(currentSession.started_at).toLocaleString()}
                </span>
              </div>
            </div>
            
            {/* Estimated Time */}
            {currentSession.total_queries > 0 && currentSession.completed_queries > 0 && (
              <div className="text-xs text-slate-400 text-center">
                Estimated time remaining: {Math.ceil(((currentSession.total_queries - currentSession.completed_queries) / currentSession.completed_queries) * 30)} seconds
              </div>
            )}
          </div>
          
          {/* Research Log */}
          {researchLog.length > 0 && (
            <div className="mt-6 bg-slate-900/50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                <span className="text-purple-400">🔍</span>
                Research Activity Log
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {researchLog.map((log, index) => (
                  <div key={index} className="flex items-start gap-3 text-sm">
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                      log.status === 'processing' ? 'bg-yellow-400 animate-pulse' :
                      log.status === 'completed' ? 'bg-green-400' :
                      'bg-red-400'
                    }`}></div>
                    <div className="flex-1">
                      <div className="text-slate-300 leading-relaxed">
                        {log.query}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {log.timestamp.toLocaleTimeString()} • {
                          log.status === 'processing' ? 'Processing...' :
                          log.status === 'completed' ? 'Completed' :
                          'Failed'
                        }
                      </div>
                      
                      {/* Show source information for completed queries */}
                      {log.status === 'completed' && log.sources && log.sources.sourceCount > 0 && (
                        <div className="mt-2 p-2 bg-slate-800/50 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-slate-400">Sources found:</span>
                            <span className="text-xs text-green-400 font-medium">{log.sources.sourceCount}</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {log.sources.sources.slice(0, 3).map((source, idx) => (
                              <div key={idx} className="flex items-center gap-1 text-xs">
                                <span className={`text-xs ${
                                  source.type === 'github' ? 'text-purple-400' :
                                  source.type === 'blog' ? 'text-blue-400' :
                                  source.type === 'news' ? 'text-orange-400' :
                                  source.type === 'job' ? 'text-green-400' :
                                  'text-slate-400'
                                }`}>
                                  {source.type === 'github' ? '🔧' :
                                   source.type === 'blog' ? '📚' :
                                   source.type === 'news' ? '📰' :
                                   source.type === 'job' ? '💼' :
                                   '🔗'}
                                </span>
                                <span className="text-slate-400">{source.domain}</span>
                                <span className={`w-1 h-1 rounded-full ${
                                  source.recency === 'recent' ? 'bg-green-400' :
                                  source.recency === 'moderate' ? 'bg-yellow-400' :
                                  'bg-red-400'
                                }`}></span>
                              </div>
                            ))}
                            {log.sources.sources.length > 3 && (
                              <span className="text-xs text-slate-500">+{log.sources.sources.length - 3} more</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Research Results */}
      {researchFindings.length > 0 && (
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-semibold text-white">Deep Research Report</h3>
              <button
                onClick={() => setIsReportExpanded(!isReportExpanded)}
                className="flex items-center gap-2 text-slate-400 hover:text-slate-300 transition-colors"
              >
                <svg 
                  className={`w-5 h-5 transition-transform duration-200 ${isReportExpanded ? 'rotate-90' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className="text-sm text-slate-400">
              {researchFindings.length} findings • {new Date().toLocaleDateString()}
            </div>
          </div>

          <div className={`transition-all duration-300 ease-in-out ${
            isReportExpanded ? 'max-h-full opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
          }`}>
            {/* Executive Summary */}
            <div className="bg-gradient-to-r from-purple-600/10 to-pink-600/10 rounded-lg p-4 mb-6 border border-purple-500/20">
              <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
                Executive Summary
              </h4>
              <p className="text-slate-300 text-sm leading-relaxed">
                Comprehensive analysis identified {researchFindings.length} key findings across technical challenges, 
                business opportunities, and operational insights. Research reveals actionable areas for external 
                consulting engagement and strategic technology improvements.
              </p>
            </div>

          {/* Group findings by category for better organization */}
          {(() => {
            const groupedFindings = researchFindings.reduce((groups, finding) => {
              const category = finding.category;
              if (!groups[category]) {
                groups[category] = [];
              }
              groups[category].push(finding);
              return groups;
            }, {} as Record<string, typeof researchFindings>);

            return Object.entries(groupedFindings).map(([category, findings]) => (
              <div key={category} className="mb-8">
                <h4 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full"></span>
                  {category}
                  <span className="text-slate-400 text-sm font-normal">
                    ({findings.length} {findings.length === 1 ? 'finding' : 'findings'})
                  </span>
                </h4>
                
                <div className="space-y-4">
                  {findings.map((finding) => (
                    <div key={finding.id} className="bg-slate-700/30 rounded-lg p-5 border-l-4 border-purple-500/50">
                      <div className="flex items-start justify-between mb-3">
                        <h5 className="text-white font-medium leading-relaxed flex-1 pr-4">
                          {finding.title}
                        </h5>
                        <span className="text-slate-400 text-sm whitespace-nowrap">
                          {Math.round(finding.confidence_score * 100)}% confidence
                        </span>
                      </div>
                      
                      <div className="text-slate-300 text-sm leading-relaxed mb-4 whitespace-pre-wrap">
                        {finding.description}
                      </div>
                      
                      {finding.citations.length > 0 && (
                        <div className="border-t border-slate-600 pt-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-slate-400 text-xs font-medium">Referenced Sources:</span>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-green-400"></span>
                                <span>Recent</span>
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-yellow-400"></span>
                                <span>Moderate</span>
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-red-400"></span>
                                <span>Older</span>
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="text-blue-400">⭐</span>
                                <span>High Quality</span>
                              </span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {(() => {
                              // Group citations by domain and type
                              const groupedCitations = finding.citations.reduce((groups, citation) => {
                                try {
                                  const url = new URL(citation);
                                  const domain = url.hostname.replace('www.', '');
                                  let type = 'other';
                                  
                                  if (domain.includes('github.com')) type = 'github';
                                  else if (domain.includes('medium.com') || domain.includes('dev.to') || domain.includes('blog')) type = 'blog';
                                  else if (domain.includes('linkedin.com') || domain.includes('jobs') || domain.includes('careers')) type = 'job';
                                  else if (domain.includes('docs.') || domain.includes('documentation')) type = 'documentation';
                                  else if (domain.includes('news') || domain.includes('techcrunch') || domain.includes('verge')) type = 'news';
                                  
                                  if (!groups[type]) groups[type] = [];
                                  groups[type].push({ url: citation, domain });
                                  return groups;
                                } catch {
                                  if (!groups['other']) groups['other'] = [];
                                  groups['other'].push({ url: citation, domain: citation });
                                  return groups;
                                }
                              }, {} as Record<string, {url: string, domain: string}[]>);

                              return Object.entries(groupedCitations).map(([type, sources]) => (
                                <div key={type} className="mb-2">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-xs ${
                                      type === 'github' ? 'text-purple-400' :
                                      type === 'blog' ? 'text-blue-400' :
                                      type === 'news' ? 'text-orange-400' :
                                      type === 'job' ? 'text-green-400' :
                                      type === 'documentation' ? 'text-cyan-400' :
                                      'text-slate-400'
                                    }`}>
                                      {type === 'github' ? '🔧 GitHub' :
                                       type === 'blog' ? '📚 Blog Posts' :
                                       type === 'news' ? '📰 News' :
                                       type === 'job' ? '💼 Job Postings' :
                                       type === 'documentation' ? '📖 Documentation' :
                                       '🔗 Other Sources'}
                                    </span>
                                    <span className="text-slate-500 text-xs">({sources.length})</span>
                                  </div>
                                  <div className="space-y-1 ml-4">
                                    {sources.slice(0, 2).map((source, idx) => {
                                      // Determine recency based on URL patterns
                                      const recency = source.url.includes('2024') || source.url.includes('2025') || 
                                                     source.url.includes('latest') || source.url.includes('recent') ? 'recent' :
                                                     source.url.includes('2022') || source.url.includes('2021') || source.url.includes('2020') ? 'older' :
                                                     'moderate';
                                      
                                      // Determine source quality based on domain authority
                                      const isHighQuality = source.domain.includes('github.com') || 
                                                          source.domain.includes('medium.com') ||
                                                          source.domain.includes('stackoverflow.com') ||
                                                          source.domain.includes('techcrunch.com') ||
                                                          source.domain.includes('docs.');
                                      
                                      return (
                                        <div key={idx} className="flex items-start gap-2">
                                          <span className={`w-1 h-1 rounded-full mt-2 flex-shrink-0 ${
                                            type === 'github' ? 'bg-purple-400' :
                                            type === 'blog' ? 'bg-blue-400' :
                                            type === 'news' ? 'bg-orange-400' :
                                            type === 'job' ? 'bg-green-400' :
                                            type === 'documentation' ? 'bg-cyan-400' :
                                            'bg-slate-400'
                                          }`}></span>
                                          <div className="flex items-center gap-2 flex-1">
                                            <a 
                                              href={source.url} 
                                              target="_blank" 
                                              rel="noopener noreferrer"
                                              className="text-slate-400 hover:text-slate-300 text-xs break-all hover:underline transition-colors"
                                            >
                                              {source.domain}
                                            </a>
                                            <div className="flex items-center gap-1">
                                              {/* Recency indicator */}
                                              <span className={`w-1 h-1 rounded-full ${
                                                recency === 'recent' ? 'bg-green-400' :
                                                recency === 'moderate' ? 'bg-yellow-400' :
                                                'bg-red-400'
                                              }`}></span>
                                              {/* Quality indicator */}
                                              {isHighQuality && (
                                                <span className="text-xs text-blue-400">⭐</span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                    {sources.length > 2 && (
                                      <div className="text-xs text-slate-500 ml-3">
                                        +{sources.length - 2} more {type} sources
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ));
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()}

            {/* Research Completion Notice */}
            <div className="mt-8 pt-6 border-t border-slate-600">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">
                  Research completed at {new Date().toLocaleString()}
                </span>
                <span className="text-purple-400">
                  ✓ Analysis complete
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Research History */}
      {researchHistory.length > 0 && (
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Research History</h3>
          <div className="space-y-3">
            {researchHistory.slice(0, 5).map((session) => (
              <div key={session.id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${
                    session.status === 'completed' ? 'bg-green-400' :
                    session.status === 'processing' ? 'bg-yellow-400' :
                    session.status === 'error' ? 'bg-red-400' :
                    'bg-slate-400'
                  }`}></span>
                  <div>
                    <div className="text-slate-300 font-medium capitalize">
                      {session.research_type.replace('-', ' ')}
                    </div>
                    <div className="text-slate-400 text-sm">
                      {new Date(session.started_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                {session.status === 'completed' && (
                  <button
                    onClick={() => viewPreviousResults(session)}
                    className="px-3 py-1 bg-purple-600/20 text-purple-300 text-sm rounded hover:bg-purple-600/30 transition-colors"
                  >
                    View Results
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {researchHistory.length === 0 && researchFindings.length === 0 && !currentSession && (
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-8 text-center">
          <div className="text-4xl mb-4">🎯</div>
          <h3 className="text-xl font-semibold text-white mb-2">Ready to Spear This Company?</h3>
          <p className="text-slate-400 mb-6">
            Start deep research to uncover technical challenges, business opportunities, and actionable intelligence
            that will help you create compelling artifacts and value-first outreach.
          </p>
          <div className="text-sm text-slate-500">
            Select a research type above and click &quot;Start Deep Research&quot; to begin.
          </div>
        </div>
      )}
    </div>
  );
}