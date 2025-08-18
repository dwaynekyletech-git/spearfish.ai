/**
 * Project Artifact Card Component
 * 
 * Individual project artifact card displaying details with expandable functionality
 */

'use client';

import { useState } from 'react';
import { 
  ChevronDownIcon, 
  ChevronUpIcon,
  ClockIcon,
  LightBulbIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowTrendingUpIcon,
  CpuChipIcon,
  BuildingOfficeIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  CodeBracketIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';

interface ProjectArtifact {
  id: string;
  type: 'technical_proposal' | 'integration_guide' | 'optimization_plan' | 'security_audit' | 'market_analysis' | 'automation_script' | 'dashboard_design' | 'api_documentation';
  title: string;
  description: string;
  problem_statement: string;
  proposed_solution: string;
  implementation_approach: string;
  estimated_effort: 'low' | 'medium' | 'high';
  estimated_impact: 'low' | 'medium' | 'high';
  required_skills: string[];
  deliverables: string[];
  timeline_estimate: string;
  success_metrics: string[];
  risk_factors: string[];
  priority_score: number;
  confidence_score: number;
  metadata?: Record<string, any>;
}

interface ProjectArtifactCardProps {
  artifact: ProjectArtifact;
  isSelected?: boolean;
  onSelect?: (artifact: ProjectArtifact) => void;
  // New props for completion tracking
  isCompleted?: boolean;
  onMarkCompleted?: (artifactId: string) => void;
  onMarkIncomplete?: (artifactId: string) => void;
  showCompletionControls?: boolean;
}

export function ProjectArtifactCard({ 
  artifact, 
  isSelected = false, 
  onSelect,
  isCompleted = false,
  onMarkCompleted,
  onMarkIncomplete,
  showCompletionControls = false
}: ProjectArtifactCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getTypeConfig = (type: ProjectArtifact['type']) => {
    const configs = {
      technical_proposal: {
        icon: CpuChipIcon,
        color: 'purple',
        label: 'Technical Proposal',
        bgColor: 'bg-purple-600/10',
        borderColor: 'border-purple-500/30',
        textColor: 'text-purple-300'
      },
      integration_guide: {
        icon: CodeBracketIcon,
        color: 'blue',
        label: 'Integration Guide',
        bgColor: 'bg-blue-600/10',
        borderColor: 'border-blue-500/30',
        textColor: 'text-blue-300'
      },
      optimization_plan: {
        icon: ArrowTrendingUpIcon,
        color: 'green',
        label: 'Optimization Plan',
        bgColor: 'bg-green-600/10',
        borderColor: 'border-green-500/30',
        textColor: 'text-green-300'
      },
      security_audit: {
        icon: ShieldCheckIcon,
        color: 'red',
        label: 'Security Audit',
        bgColor: 'bg-red-600/10',
        borderColor: 'border-red-500/30',
        textColor: 'text-red-300'
      },
      market_analysis: {
        icon: ChartBarIcon,
        color: 'indigo',
        label: 'Market Analysis',
        bgColor: 'bg-indigo-600/10',
        borderColor: 'border-indigo-500/30',
        textColor: 'text-indigo-300'
      },
      automation_script: {
        icon: CpuChipIcon,
        color: 'cyan',
        label: 'Automation Script',
        bgColor: 'bg-cyan-600/10',
        borderColor: 'border-cyan-500/30',
        textColor: 'text-cyan-300'
      },
      dashboard_design: {
        icon: ChartBarIcon,
        color: 'pink',
        label: 'Dashboard Design',
        bgColor: 'bg-pink-600/10',
        borderColor: 'border-pink-500/30',
        textColor: 'text-pink-300'
      },
      api_documentation: {
        icon: DocumentTextIcon,
        color: 'orange',
        label: 'API Documentation',
        bgColor: 'bg-orange-600/10',
        borderColor: 'border-orange-500/30',
        textColor: 'text-orange-300'
      }
    };

    return configs[type] || configs.technical_proposal;
  };

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'low': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      case 'high': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'low': return 'text-slate-400';
      case 'medium': return 'text-yellow-400';
      case 'high': return 'text-green-400';
      default: return 'text-slate-400';
    }
  };

  const getPriorityColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const typeConfig = getTypeConfig(artifact.type);
  const IconComponent = typeConfig.icon;

  const handleCardClick = () => {
    if (onSelect) {
      onSelect(artifact);
    }
  };

  return (
    <div 
      className={`backdrop-blur-xl border rounded-xl p-6 transition-all duration-200 relative ${
        isCompleted && showCompletionControls
          ? 'bg-green-950/20 border-green-500/30 ring-1 ring-green-500/20'
          : isSelected 
            ? `bg-slate-800/50 ${typeConfig.borderColor} ring-1 ring-${typeConfig.color}-500/30` 
            : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600/70'
      } ${onSelect ? 'cursor-pointer' : ''}`}
      onClick={handleCardClick}
    >
      {/* Completion Badge - show when completed */}
      {isCompleted && showCompletionControls && (
        <div className="absolute top-4 right-4 z-10">
          <div className="bg-green-500/20 border border-green-500 rounded-full p-1">
            <CheckCircleIcon className="h-4 w-4 text-green-400" />
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3 flex-1">
          <div className={`p-2 rounded-lg ${typeConfig.bgColor} ${typeConfig.borderColor} border`}>
            <IconComponent className={`h-5 w-5 ${typeConfig.textColor}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-1 text-xs font-medium rounded ${typeConfig.bgColor} ${typeConfig.textColor}`}>
                {typeConfig.label}
              </span>
              <span className={`text-sm font-semibold ${getPriorityColor(artifact.priority_score)}`}>
                {artifact.priority_score}/100
              </span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2 leading-tight">
              {artifact.title}
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              {artifact.description}
            </p>
          </div>
        </div>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="ml-4 p-1 text-slate-400 hover:text-slate-300 transition-colors"
        >
          {isExpanded ? (
            <ChevronUpIcon className="h-5 w-5" />
          ) : (
            <ChevronDownIcon className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Completion Controls - only show when enabled */}
      {showCompletionControls && (
        <div className="mb-4 p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 ${isCompleted ? 'text-green-400' : 'text-slate-400'}`}>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                  isCompleted 
                    ? 'bg-green-500/20 border-green-500' 
                    : 'border-slate-500 hover:border-slate-400'
                }`}>
                  {isCompleted && <div className="w-2 h-2 bg-green-500 rounded-full"></div>}
                </div>
                <span className="text-sm font-medium">
                  {isCompleted ? 'Project Completed' : 'Mark as Completed'}
                </span>
              </div>
              {isCompleted && (
                <span className="text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded">
                  ✓ Done
                </span>
              )}
            </div>
            
            <div className="flex gap-2">
              {isCompleted ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkIncomplete?.(artifact.id);
                  }}
                  className="text-xs px-3 py-1 bg-slate-600/50 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                >
                  Mark Incomplete
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkCompleted?.(artifact.id);
                  }}
                  className="text-xs px-3 py-1 bg-green-600/20 hover:bg-green-600/30 text-green-300 border border-green-500/30 rounded transition-all"
                >
                  Mark Complete
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="flex items-center justify-between text-sm mb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <ClockIcon className="h-4 w-4 text-slate-400" />
            <span className="text-slate-300">{artifact.timeline_estimate}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-400">Effort:</span>
            <span className={`font-medium ${getEffortColor(artifact.estimated_effort)}`}>
              {artifact.estimated_effort}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-400">Impact:</span>
            <span className={`font-medium ${getImpactColor(artifact.estimated_impact)}`}>
              {artifact.estimated_impact}
            </span>
          </div>
        </div>
        <div className="text-slate-400 text-sm">
          {Math.round(artifact.confidence_score * 100)}% confidence
        </div>
      </div>

      {/* Expandable Details */}
      <div className={`transition-all duration-300 ease-in-out ${
        isExpanded ? 'max-h-full opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
      }`}>
        <div className="border-t border-slate-600 pt-4 space-y-4">
          {/* Problem Statement */}
          <div>
            <h4 className="text-white font-medium mb-2 flex items-center gap-2">
              <ExclamationTriangleIcon className="h-4 w-4 text-orange-400" />
              Problem Statement
            </h4>
            <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
              {artifact.problem_statement}
            </p>
          </div>

          {/* Proposed Solution */}
          <div>
            <h4 className="text-white font-medium mb-2 flex items-center gap-2">
              <LightBulbIcon className="h-4 w-4 text-yellow-400" />
              Proposed Solution
            </h4>
            <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
              {artifact.proposed_solution}
            </p>
          </div>

          {/* Implementation Approach */}
          <div>
            <h4 className="text-white font-medium mb-2 flex items-center gap-2">
              <BuildingOfficeIcon className="h-4 w-4 text-blue-400" />
              Implementation Approach
            </h4>
            <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
              {artifact.implementation_approach}
            </p>
          </div>

          {/* Required Skills */}
          {artifact.required_skills.length > 0 && (
            <div>
              <h4 className="text-white font-medium mb-2">Required Skills</h4>
              <div className="flex flex-wrap gap-2">
                {artifact.required_skills.map((skill, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-slate-700/50 text-slate-300 rounded-full text-xs"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Deliverables */}
          {artifact.deliverables.length > 0 && (
            <div>
              <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                <CheckCircleIcon className="h-4 w-4 text-green-400" />
                Deliverables
              </h4>
              <ul className="space-y-1">
                {artifact.deliverables.map((deliverable, index) => (
                  <li key={index} className="flex items-start gap-2 text-slate-300 text-sm">
                    <span className="w-1 h-1 bg-green-400 rounded-full mt-2 flex-shrink-0"></span>
                    {deliverable}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Success Metrics */}
          {artifact.success_metrics.length > 0 && (
            <div>
              <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                <ChartBarIcon className="h-4 w-4 text-purple-400" />
                Success Metrics
              </h4>
              <ul className="space-y-1">
                {artifact.success_metrics.map((metric, index) => (
                  <li key={index} className="flex items-start gap-2 text-slate-300 text-sm">
                    <span className="w-1 h-1 bg-purple-400 rounded-full mt-2 flex-shrink-0"></span>
                    {metric}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Risk Factors */}
          {artifact.risk_factors.length > 0 && (
            <div>
              <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                <ExclamationTriangleIcon className="h-4 w-4 text-red-400" />
                Risk Factors
              </h4>
              <ul className="space-y-1">
                {artifact.risk_factors.map((risk, index) => (
                  <li key={index} className="flex items-start gap-2 text-slate-300 text-sm">
                    <span className="w-1 h-1 bg-red-400 rounded-full mt-2 flex-shrink-0"></span>
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}