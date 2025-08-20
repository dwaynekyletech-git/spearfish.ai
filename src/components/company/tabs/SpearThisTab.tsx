/**
 * Spear This! Tab Component
 * 
 * Deep research functionality for identifying actionable intelligence
 * and opportunities to create value-first outreach artifacts
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { ProjectIdeasDisplay } from '../ProjectIdeasDisplay';
import { EmailGenerationInterface } from '../EmailGenerationInterface';

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

// Workflow step definitions
type WorkflowStep = 'research' | 'artifacts' | 'selection' | 'email' | 'complete';

interface WorkflowState {
  currentStep: WorkflowStep;
  completedSteps: Set<WorkflowStep>;
  canNavigate: {
    research: boolean;
    artifacts: boolean;
    selection: boolean;
    email: boolean;
    complete: boolean;
  };
}

export function SpearThisTab({ company }: SpearThisTabProps) {
  const [selectedResearchType, setSelectedResearchType] = useState('comprehensive');
  const [currentSession, setCurrentSession] = useState<ResearchSession | null>(null);
  const [researchHistory, setResearchHistory] = useState<ResearchSession[]>([]);
  const [researchFindings, setResearchFindings] = useState<ResearchFinding[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [researchLog, setResearchLog] = useState<{query: string; timestamp: Date; status: 'processing' | 'completed' | 'failed'; sources?: QuerySourceInfo}[]>([]);
  const [isResearchTypeExpanded, setIsResearchTypeExpanded] = useState(true);
  const [isReportExpanded, setIsReportExpanded] = useState(true);
  const [isGeneratingArtifacts, setIsGeneratingArtifacts] = useState(false);
  const [generatedArtifacts, setGeneratedArtifacts] = useState<any[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<any | null>(null);
  const [artifactError, setArtifactError] = useState<string | null>(null);
  // Project completion tracking
  const [completedArtifacts, setCompletedArtifacts] = useState<Set<string>>(new Set());
  const [showCompletionMode, setShowCompletionMode] = useState(false);
  const [confirmationModal, setConfirmationModal] = useState<{
    show: boolean;
    artifactId: string;
    artifactTitle: string;
    action: 'complete' | 'incomplete';
  } | null>(null);
  // Email generation
  const [generatedEmails, setGeneratedEmails] = useState<any[]>([]);
  const [showEmailGeneration, setShowEmailGeneration] = useState(false);
  
  // Workflow management state
  const [workflowState, setWorkflowState] = useState<WorkflowState>({
    currentStep: 'research',
    completedSteps: new Set(),
    canNavigate: {
      research: true,
      artifacts: false,
      selection: false,
      email: false,
      complete: false
    }
  });

  // Workflow management functions
  const updateWorkflowState = useCallback((updates: Partial<WorkflowState>) => {
    setWorkflowState(prev => ({
      ...prev,
      ...updates,
      completedSteps: updates.completedSteps || prev.completedSteps,
      canNavigate: updates.canNavigate ? { ...prev.canNavigate, ...updates.canNavigate } : prev.canNavigate
    }));
  }, []);

  const navigateToStep = useCallback((step: WorkflowStep) => {
    if (workflowState.canNavigate[step]) {
      updateWorkflowState({ currentStep: step });
      
      // Auto-expand/collapse sections based on step
      switch (step) {
        case 'research':
          setIsResearchTypeExpanded(true);
          setIsReportExpanded(false);
          break;
        case 'artifacts':
          setIsResearchTypeExpanded(false);
          setIsReportExpanded(true);
          break;
        case 'selection':
          setShowCompletionMode(true);
          setShowEmailGeneration(false);
          break;
        case 'email':
          setShowEmailGeneration(true);
          break;
      }
    }
  }, [workflowState.canNavigate, updateWorkflowState]);

  const markStepComplete = useCallback((step: WorkflowStep) => {
    const newCompletedSteps = new Set(workflowState.completedSteps);
    newCompletedSteps.add(step);
    
    // Update navigation permissions based on completed steps
    const newCanNavigate = { ...workflowState.canNavigate };
    
    switch (step) {
      case 'research':
        newCanNavigate.artifacts = true;
        break;
      case 'artifacts':
        newCanNavigate.selection = true;
        break;
      case 'selection':
        newCanNavigate.email = true;
        break;
      case 'email':
        newCanNavigate.complete = true;
        break;
    }
    
    updateWorkflowState({
      completedSteps: newCompletedSteps,
      canNavigate: newCanNavigate
    });
  }, [workflowState.completedSteps, workflowState.canNavigate, updateWorkflowState]);

  const resetWorkflow = useCallback(() => {
    setWorkflowState({
      currentStep: 'research',
      completedSteps: new Set(),
      canNavigate: {
        research: true,
        artifacts: false,
        selection: false,
        email: false,
        complete: false
      }
    });
    
    // Reset all related states
    setCurrentSession(null);
    setResearchFindings([]);
    setGeneratedArtifacts([]);
    setCompletedArtifacts(new Set());
    setSelectedArtifact(null);
    setGeneratedEmails([]);
    setShowEmailGeneration(false);
    setShowCompletionMode(false);
    setIsResearchTypeExpanded(true);
    setIsReportExpanded(false);
  }, []);

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

  // Save workflow state to localStorage
  useEffect(() => {
    const workflowData = {
      workflowState,
      completedArtifacts: Array.from(completedArtifacts),
      selectedArtifact: selectedArtifact?.id || null,
      generatedArtifacts: generatedArtifacts.map(a => a.id),
      timestamp: Date.now()
    };
    localStorage.setItem(`spearfish-workflow-${company.id}`, JSON.stringify(workflowData));
  }, [workflowState, completedArtifacts, selectedArtifact, generatedArtifacts, company.id]);

  // Load workflow state from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem(`spearfish-workflow-${company.id}`);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        // Only restore if data is less than 24 hours old
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          if (parsed.workflowState) {
            setWorkflowState({
              ...parsed.workflowState,
              completedSteps: new Set(parsed.workflowState.completedSteps)
            });
          }
          if (parsed.completedArtifacts) {
            setCompletedArtifacts(new Set(parsed.completedArtifacts));
          }
        }
      } catch (error) {
        console.error('Failed to restore workflow state:', error);
      }
    }
  }, [company.id]);

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
              
              // Load research results with retry logic
              const loadResultsWithRetry = async (retryCount = 0): Promise<boolean> => {
                try {
                  const response = await fetch(`/api/companies/${company.id}/research/${sessionId}/results`);
                  if (response.ok) {
                    const data = await response.json();
                    const findings = data.findings || [];
                    
                    if (findings.length === 0 && retryCount < 3) {
                      console.log(`Research results empty, retrying... (attempt ${retryCount + 1})`);
                      await new Promise(resolve => setTimeout(resolve, 2000));
                      return await loadResultsWithRetry(retryCount + 1);
                    }
                    
                    setResearchFindings(findings);
                    
                    if (findings.length === 0) {
                      console.error('Research completed but no findings were loaded after retries');
                      return false;
                    } else {
                      console.log('Research results successfully loaded:', findings.length, 'findings');
                      return true;
                    }
                  }
                  return false;
                } catch (error) {
                  console.error('Error in loadResultsWithRetry:', error);
                  return false;
                }
              };
              
              const resultsLoaded = await loadResultsWithRetry();
              if (resultsLoaded) {
                // Mark research step as complete and enable artifacts step
                markStepComplete('research');
                navigateToStep('artifacts');
              }
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
      console.log('DEBUG: Loading research results for session:', sessionId);
      const response = await fetch(`/api/companies/${company.id}/research/${sessionId}/results`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('DEBUG: Research results loaded:', {
          success: data.success,
          findingsCount: data.findings?.length || 0,
          categoriesCount: data.summary?.categories?.length || 0,
          totalFindings: data.summary?.total_findings || 0
        });
        
        const findings = data.findings || [];
        if (findings.length === 0) {
          console.warn('No research findings returned from API for completed session');
        }
        
        setResearchFindings(findings);
      } else {
        const errorData = await response.json().catch(() => null);
        console.error('Failed to load research results:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
      }
    } catch (error) {
      console.error('Failed to load results:', error);
    }
  };

  const viewPreviousResults = async (session: ResearchSession) => {
    await loadResearchResults(session.id);
    setCurrentSession(session);
  };

  const generateArtifacts = async () => {
    if (!currentSession || currentSession.status !== 'completed') {
      setArtifactError('No completed research session available. Please complete research first.');
      return;
    }

    setIsGeneratingArtifacts(true);
    setArtifactError(null); // Clear previous errors
    
    try {
      console.log('Starting artifact generation for session:', currentSession.id);
      
      const response = await fetch(`/api/companies/${company.id}/artifacts/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          research_session_id: currentSession.id,
          config: {
            maxProjects: 5,
            focusAreas: ['technical', 'business'],
            effortPreference: 'mixed',
            timeframe: 'medium_term',
            riskTolerance: 'medium'
          }
        }),
      });
      
      console.log('API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Generated artifacts:', data.artifacts?.length || 0);
        
        if (data.artifacts && data.artifacts.length > 0) {
          setGeneratedArtifacts(data.artifacts);
          setArtifactError(null);
          // Mark artifacts step as complete and enable selection step
          markStepComplete('artifacts');
          navigateToStep('selection');
        } else {
          setArtifactError('No project ideas were generated. This might be due to insufficient research data or configuration issues.');
        }
      } else {
        const errorData = await response.json().catch(() => null);
        console.error('Artifact generation failed:', response.status, errorData);
        
        if (response.status === 401) {
          setArtifactError('Authentication error. Please sign in again.');
        } else if (response.status === 404) {
          setArtifactError('Research session not found or incomplete.');
        } else if (response.status === 500) {
          setArtifactError('Server error during artifact generation. This might be due to missing OpenAI API configuration.');
        } else {
          setArtifactError(`Failed to generate artifacts: ${errorData?.error || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Failed to generate artifacts:', error);
      setArtifactError('Network error or unexpected failure. Please check your connection and try again.');
    } finally {
      setIsGeneratingArtifacts(false);
    }
  };

  const handleMarkCompleted = (artifactId: string) => {
    const artifact = generatedArtifacts.find(a => a.id === artifactId);
    if (artifact) {
      setConfirmationModal({
        show: true,
        artifactId,
        artifactTitle: artifact.title,
        action: 'complete'
      });
    }
  };

  const handleMarkIncomplete = (artifactId: string) => {
    const artifact = generatedArtifacts.find(a => a.id === artifactId);
    if (artifact) {
      setConfirmationModal({
        show: true,
        artifactId,
        artifactTitle: artifact.title,
        action: 'incomplete'
      });
    }
  };

  const confirmAction = () => {
    if (!confirmationModal) return;
    
    const wasEmpty = completedArtifacts.size === 0;
    
    if (confirmationModal.action === 'complete') {
      setCompletedArtifacts(prev => new Set([...Array.from(prev), confirmationModal.artifactId]));
    } else {
      setCompletedArtifacts(prev => {
        const newSet = new Set(prev);
        newSet.delete(confirmationModal.artifactId);
        return newSet;
      });
    }
    
    setConfirmationModal(null);
    
    // If this was the first completion, mark selection step as complete and enable email step
    if (wasEmpty && confirmationModal.action === 'complete') {
      markStepComplete('selection');
      navigateToStep('email');
    }
  };

  const cancelAction = () => {
    setConfirmationModal(null);
  };

  const toggleCompletionMode = () => {
    setShowCompletionMode(!showCompletionMode);
  };

  const handleEmailGenerated = (template: any) => {
    setGeneratedEmails(prev => [template, ...prev]);
    // Mark email step as complete
    markStepComplete('email');
  };

  const toggleEmailGeneration = () => {
    setShowEmailGeneration(!showEmailGeneration);
  };

  // Workflow step definitions for display
  const workflowSteps = [
    {
      id: 'research' as WorkflowStep,
      title: 'Deep Research',
      description: 'Analyze company intelligence',
      icon: '🔍'
    },
    {
      id: 'artifacts' as WorkflowStep,
      title: 'Generate Ideas',
      description: 'Create project artifacts',
      icon: '💡'
    },
    {
      id: 'selection' as WorkflowStep,
      title: 'Select Projects',
      description: 'Mark completed work',
      icon: '✅'
    },
    {
      id: 'email' as WorkflowStep,
      title: 'Create Outreach',
      description: 'Generate email templates',
      icon: '📧'
    },
    {
      id: 'complete' as WorkflowStep,
      title: 'Complete',
      description: 'Ready for outreach',
      icon: '🚀'
    }
  ];

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

      {/* Workflow Progress Indicator */}
      <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="text-purple-400">📋</span>
            Workflow Progress
          </h3>
          <button
            onClick={resetWorkflow}
            className="text-slate-400 hover:text-slate-300 text-sm transition-colors flex items-center gap-1"
          >
            <span>↺</span>
            Start Over
          </button>
        </div>
        
        <div className="flex items-center justify-between">
          {workflowSteps.map((step, index) => {
            const isCompleted = workflowState.completedSteps.has(step.id);
            const isCurrent = workflowState.currentStep === step.id;
            const canNavigate = workflowState.canNavigate[step.id];
            
            return (
              <div key={step.id} className="flex items-center flex-1">
                {/* Step Button */}
                <button
                  onClick={() => navigateToStep(step.id)}
                  disabled={!canNavigate}
                  className={`relative flex flex-col items-center p-3 rounded-lg transition-all min-w-0 flex-1 ${
                    isCurrent
                      ? 'bg-purple-600/20 border border-purple-500/50 text-purple-300 scale-105'
                      : isCompleted
                      ? 'bg-green-600/20 border border-green-500/50 text-green-300 hover:bg-green-600/30'
                      : canNavigate
                      ? 'bg-slate-700/30 border border-slate-600 text-slate-400 hover:bg-slate-700/50 hover:text-slate-300'
                      : 'bg-slate-800/30 border border-slate-700 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  {/* Step Icon */}
                  <div className={`text-2xl mb-2 ${
                    isCurrent ? 'animate-pulse' : ''
                  }`}>
                    {isCompleted ? '✓' : step.icon}
                  </div>
                  
                  {/* Step Info */}
                  <div className="text-center">
                    <div className={`text-sm font-medium ${
                      isCurrent ? 'text-purple-200' : isCompleted ? 'text-green-200' : 'inherit'
                    }`}>
                      {step.title}
                    </div>
                    <div className={`text-xs mt-1 ${
                      isCurrent ? 'text-purple-400' : isCompleted ? 'text-green-400' : 'text-slate-500'
                    }`}>
                      {step.description}
                    </div>
                  </div>
                  
                  {/* Current Step Indicator */}
                  {isCurrent && (
                    <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                    </div>
                  )}
                </button>
                
                {/* Connector Line */}
                {index < workflowSteps.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-2 transition-colors ${
                    workflowState.completedSteps.has(step.id)
                      ? 'bg-green-500/50'
                      : 'bg-slate-600/50'
                  }`}></div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Progress Summary */}
        <div className="mt-6 pt-4 border-t border-slate-600">
          <div className="flex items-center justify-between text-sm">
            <div className="text-slate-400">
              Step {Math.max(1, workflowState.completedSteps.size + 1)} of {workflowSteps.length}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-green-400">
                ✓ {workflowState.completedSteps.size} completed
              </span>
              <div className="flex items-center gap-1">
                <div className="w-16 h-1 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-green-500 transition-all duration-500"
                    style={{ 
                      width: `${(workflowState.completedSteps.size / workflowSteps.length) * 100}%` 
                    }}
                  ></div>
                </div>
                <span className="text-xs text-slate-400 ml-1">
                  {Math.round((workflowState.completedSteps.size / workflowSteps.length) * 100)}%
                </span>
              </div>
            </div>
          </div>
          
          {/* Navigation Controls */}
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => {
                const currentIndex = workflowSteps.findIndex(s => s.id === workflowState.currentStep);
                if (currentIndex > 0) {
                  const previousStep = workflowSteps[currentIndex - 1];
                  if (workflowState.canNavigate[previousStep.id]) {
                    navigateToStep(previousStep.id);
                  }
                }
              }}
              disabled={
                workflowSteps.findIndex(s => s.id === workflowState.currentStep) === 0 ||
                !workflowSteps[workflowSteps.findIndex(s => s.id === workflowState.currentStep) - 1] ||
                !workflowState.canNavigate[workflowSteps[workflowSteps.findIndex(s => s.id === workflowState.currentStep) - 1]?.id]
              }
              className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-700/50 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 rounded-lg transition-colors"
            >
              <span>←</span>
              Previous Step
            </button>
            
            <div className="text-center">
              <div className="text-xs text-slate-400 uppercase tracking-wider font-medium">
                Current Step
              </div>
              <div className="text-sm text-white font-medium">
                {workflowSteps.find(s => s.id === workflowState.currentStep)?.title}
              </div>
            </div>
            
            <button
              onClick={() => {
                const currentIndex = workflowSteps.findIndex(s => s.id === workflowState.currentStep);
                if (currentIndex < workflowSteps.length - 1) {
                  const nextStep = workflowSteps[currentIndex + 1];
                  if (workflowState.canNavigate[nextStep.id]) {
                    navigateToStep(nextStep.id);
                  }
                }
              }}
              disabled={
                workflowSteps.findIndex(s => s.id === workflowState.currentStep) === workflowSteps.length - 1 ||
                !workflowSteps[workflowSteps.findIndex(s => s.id === workflowState.currentStep) + 1] ||
                !workflowState.canNavigate[workflowSteps[workflowSteps.findIndex(s => s.id === workflowState.currentStep) + 1]?.id]
              }
              className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-700/50 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 rounded-lg transition-colors"
            >
              Next Step
              <span>→</span>
            </button>
          </div>
        </div>
      </div>

      {/* Research Type Selection - Show when in research step or research completed */}
      {(workflowState.currentStep === 'research' || workflowState.completedSteps.has('research')) && (
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
      )}

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

      {/* Research Results - Show when artifacts step is available or current */}
      {researchFindings.length > 0 && (workflowState.canNavigate.artifacts || workflowState.currentStep === 'artifacts') && (
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

            {/* Generate Artifacts Button */}
            {currentSession?.status === 'completed' && researchFindings.length > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-600">
                <div className="bg-gradient-to-r from-emerald-600/10 to-blue-600/10 rounded-lg p-6 border border-emerald-500/20">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">🚀</span>
                    <div>
                      <h4 className="text-white font-semibold">Ready to Create Project Artifacts?</h4>
                      <p className="text-slate-400 text-sm">
                        Transform research insights into actionable project ideas and solution proposals
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={generateArtifacts}
                    disabled={isGeneratingArtifacts}
                    className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all flex items-center gap-2"
                  >
                    {isGeneratingArtifacts ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Generating Artifacts...
                      </>
                    ) : (
                      <>
                        <span>✨</span>
                        Generate Project Artifacts
                      </>
                    )}
                  </button>
                  
                  {generatedArtifacts.length > 0 && (
                    <div className="mt-4 text-sm text-emerald-400">
                      ✓ Generated {generatedArtifacts.length} project artifacts
                    </div>
                  )}
                  
                  {artifactError && (
                    <div className="mt-4 p-3 bg-red-600/10 border border-red-500/20 rounded-lg">
                      <div className="flex items-start gap-2">
                        <span className="text-red-400 text-sm">⚠️</span>
                        <div className="text-sm">
                          <p className="text-red-300 font-medium">Artifact Generation Failed</p>
                          <p className="text-red-400 mt-1">{artifactError}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
              </div>
            )}
          </div>
        </div>
      )}

      {/* Project Ideas Display - Show when selection step is available or current */}
      {generatedArtifacts.length > 0 && (workflowState.canNavigate.selection || workflowState.currentStep === 'selection') && (
        <div className="space-y-6">
          {/* Project Ideas Display */}
          <ProjectIdeasDisplay
            artifacts={generatedArtifacts}
            selectedArtifact={selectedArtifact}
            onSelectArtifact={setSelectedArtifact}
            isLoading={isGeneratingArtifacts}
            completedArtifacts={completedArtifacts}
            onMarkCompleted={handleMarkCompleted}
            onMarkIncomplete={handleMarkIncomplete}
            showCompletionControls={showCompletionMode}
          />

          {/* Project Selection Controls */}
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-lg">📋</span>
                <div>
                  <h3 className="text-lg font-semibold text-white">Project Selection</h3>
                  <p className="text-slate-400 text-sm">
                    Mark projects you&apos;ve completed to track your progress
                  </p>
                </div>
              </div>
              <button
                onClick={toggleCompletionMode}
                className={`px-4 py-2 rounded-lg transition-all text-sm font-medium ${
                  showCompletionMode
                    ? 'bg-green-600/20 text-green-300 border border-green-500/30'
                    : 'bg-slate-700/50 text-slate-300 border border-slate-600 hover:border-slate-500'
                }`}
              >
                {showCompletionMode ? 'Exit Selection Mode' : 'Enable Selection Mode'}
              </button>
            </div>
            
            {showCompletionMode && (
              <div className="space-y-3">
                {completedArtifacts.size > 0 && (
                  <div className="p-3 bg-green-950/20 border border-green-500/20 rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-green-400 font-medium">
                        ✓ {completedArtifacts.size} of {generatedArtifacts.length} projects completed
                      </span>
                      {completedArtifacts.size === generatedArtifacts.length && (
                        <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded">
                          All Done! 🎉
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Validation Message */}
                {showCompletionMode && completedArtifacts.size === 0 && (
                  <div className="p-3 bg-amber-950/20 border border-amber-500/20 rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-amber-400">⚠️</span>
                      <span className="text-amber-300">
                        Please mark at least one project as completed to proceed with your outreach.
                      </span>
                    </div>
                  </div>
                )}
                
                {/* Next Steps Guidance */}
                {completedArtifacts.size > 0 && (
                  <div className="p-3 bg-blue-950/20 border border-blue-500/20 rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-blue-400">💡</span>
                      <span className="text-blue-300">
                        Great! You&apos;ve completed {completedArtifacts.size} project{completedArtifacts.size > 1 ? 's' : ''}. 
                        These can be used to demonstrate your value when reaching out to this company.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Email Generation Toggle */}
          {completedArtifacts.size > 0 && (
            <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-lg">📧</span>
                <div>
                  <h3 className="text-lg font-semibold text-white">Email Template Generation</h3>
                  <p className="text-slate-400 text-sm">
                    Generate personalized outreach emails based on your completed projects
                  </p>
                </div>
              </div>
              
              <button
                onClick={toggleEmailGeneration}
                className={`w-full px-6 py-3 rounded-lg transition-all text-sm font-medium flex items-center justify-center gap-2 ${
                  showEmailGeneration
                    ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white'
                }`}
              >
                {showEmailGeneration ? (
                  <>
                    <span>📧</span>
                    Hide Email Generation
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    Generate Email Templates
                    <span className="text-xs bg-white/20 px-2 py-1 rounded">
                      Next Step
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Email Generation Interface - Show when email step is available or current */}
      {(workflowState.canNavigate.email || workflowState.currentStep === 'email') && showEmailGeneration && selectedArtifact && completedArtifacts.has(selectedArtifact.id) && (
        <EmailGenerationInterface
          selectedProject={selectedArtifact}
          companyData={{
            id: company.id,
            name: company.name,
            industry: company.industry,
            website: company.website,
            description: company.long_description || company.one_liner
          }}
          onEmailGenerated={handleEmailGenerated}
        />
      )}

      {/* Show message when email generation is enabled but no completed project is selected */}
      {(workflowState.canNavigate.email || workflowState.currentStep === 'email') && showEmailGeneration && (!selectedArtifact || !completedArtifacts.has(selectedArtifact.id)) && (
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6 text-center">
          <div className="text-4xl mb-4">📧</div>
          <h3 className="text-xl font-semibold text-white mb-2">Select a Completed Project</h3>
          <p className="text-slate-400">
            Click on one of your completed projects above to generate a personalized email template for outreach.
          </p>
        </div>
      )}

      {/* Workflow Completion Celebration */}
      {workflowState.completedSteps.has('email') && generatedEmails.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-600/10 to-purple-600/10 border border-emerald-500/20 rounded-xl p-8 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h3 className="text-2xl font-bold text-white mb-3">Workflow Complete!</h3>
          <p className="text-slate-300 mb-6 max-w-2xl mx-auto leading-relaxed">
            Congratulations! You&apos;ve successfully completed the entire Spear This workflow. You now have deep research insights, 
            actionable project artifacts, and personalized email templates ready for high-impact outreach to {company.name}.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="text-3xl mb-2">🔍</div>
              <div className="text-white font-semibold">Research Complete</div>
              <div className="text-slate-400 text-sm">{researchFindings.length} findings discovered</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="text-3xl mb-2">💡</div>
              <div className="text-white font-semibold">Projects Generated</div>
              <div className="text-slate-400 text-sm">{completedArtifacts.size} of {generatedArtifacts.length} completed</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="text-3xl mb-2">📧</div>
              <div className="text-white font-semibold">Emails Created</div>
              <div className="text-slate-400 text-sm">{generatedEmails.length} template{generatedEmails.length !== 1 ? 's' : ''} ready</div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigateToStep('email')}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <span>📧</span>
              Review Email Templates
            </button>
            <button
              onClick={resetWorkflow}
              className="px-6 py-3 bg-slate-700/50 hover:bg-slate-700 text-slate-300 font-medium rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <span>↺</span>
              Start New Workflow
            </button>
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

      {/* Confirmation Modal */}
      {confirmationModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-lg ${
                confirmationModal.action === 'complete' 
                  ? 'bg-green-600/20 border border-green-500/30' 
                  : 'bg-slate-600/20 border border-slate-500/30'
              }`}>
                {confirmationModal.action === 'complete' ? (
                  <CheckCircleIcon className="h-5 w-5 text-green-400" />
                ) : (
                  <span className="text-slate-400 text-lg">↺</span>
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {confirmationModal.action === 'complete' ? 'Mark Project as Completed?' : 'Mark Project as Incomplete?'}
                </h3>
                <p className="text-slate-400 text-sm">
                  {confirmationModal.action === 'complete' 
                    ? 'This will mark the project as done and track your progress.'
                    : 'This will remove the completion status from this project.'
                  }
                </p>
              </div>
            </div>

            <div className="bg-slate-700/30 rounded-lg p-3 mb-6">
              <p className="text-white font-medium text-sm">
                {confirmationModal.artifactTitle}
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelAction}
                className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction}
                className={`px-4 py-2 rounded-lg transition-colors font-medium ${
                  confirmationModal.action === 'complete'
                    ? 'bg-green-600/20 hover:bg-green-600/30 text-green-300 border border-green-500/30'
                    : 'bg-slate-600/50 hover:bg-slate-600 text-slate-300'
                }`}
              >
                {confirmationModal.action === 'complete' ? 'Mark Complete' : 'Mark Incomplete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}