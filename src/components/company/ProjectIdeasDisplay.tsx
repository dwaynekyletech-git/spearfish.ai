/**
 * Project Ideas Display Component
 * 
 * Grid layout for displaying multiple project artifacts with selection functionality
 */

'use client';

import { useState } from 'react';
import { ProjectArtifactCard } from './ProjectArtifactCard';
import { 
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  SparklesIcon
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

interface ProjectIdeasDisplayProps {
  artifacts: ProjectArtifact[];
  selectedArtifact?: ProjectArtifact | null;
  onSelectArtifact?: (artifact: ProjectArtifact) => void;
  isLoading?: boolean;
  className?: string;
  // New props for completion tracking
  completedArtifacts?: Set<string>;
  onMarkCompleted?: (artifactId: string) => void;
  onMarkIncomplete?: (artifactId: string) => void;
  showCompletionControls?: boolean;
}

type SortOption = 'priority' | 'impact' | 'effort' | 'confidence' | 'type';
type FilterOption = 'all' | 'technical_proposal' | 'integration_guide' | 'optimization_plan' | 'security_audit' | 'market_analysis' | 'automation_script' | 'dashboard_design' | 'api_documentation';
type CompletionFilter = 'all' | 'completed' | 'incomplete';

export function ProjectIdeasDisplay({ 
  artifacts, 
  selectedArtifact, 
  onSelectArtifact, 
  isLoading = false,
  className = "",
  completedArtifacts = new Set(),
  onMarkCompleted,
  onMarkIncomplete,
  showCompletionControls = false
}: ProjectIdeasDisplayProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('priority');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>('all');

  // Filter artifacts based on search term and filter
  const filteredArtifacts = artifacts.filter(artifact => {
    const matchesSearch = !searchTerm || 
      artifact.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      artifact.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      artifact.required_skills.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesFilter = filterBy === 'all' || artifact.type === filterBy;
    
    const matchesCompletion = completionFilter === 'all' || 
      (completionFilter === 'completed' && completedArtifacts.has(artifact.id)) ||
      (completionFilter === 'incomplete' && !completedArtifacts.has(artifact.id));
    
    return matchesSearch && matchesFilter && matchesCompletion;
  });

  // Sort artifacts
  const sortedArtifacts = [...filteredArtifacts].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'priority':
        comparison = a.priority_score - b.priority_score;
        break;
      case 'confidence':
        comparison = a.confidence_score - b.confidence_score;
        break;
      case 'impact':
        const impactOrder = { low: 1, medium: 2, high: 3 };
        comparison = impactOrder[a.estimated_impact] - impactOrder[b.estimated_impact];
        break;
      case 'effort':
        const effortOrder = { low: 1, medium: 2, high: 3 };
        comparison = effortOrder[a.estimated_effort] - effortOrder[b.estimated_effort];
        break;
      case 'type':
        comparison = a.type.localeCompare(b.type);
        break;
      default:
        comparison = 0;
    }
    
    return sortDirection === 'desc' ? -comparison : comparison;
  });

  const handleSort = (option: SortOption) => {
    if (sortBy === option) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(option);
      setSortDirection('desc');
    }
  };

  const getTypeLabel = (type: string) => {
    const labels = {
      technical_proposal: 'Technical Proposal',
      integration_guide: 'Integration Guide',
      optimization_plan: 'Optimization Plan',
      security_audit: 'Security Audit',
      market_analysis: 'Market Analysis',
      automation_script: 'Automation Script',
      dashboard_design: 'Dashboard Design',
      api_documentation: 'API Documentation'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getSortIcon = (option: SortOption) => {
    if (sortBy !== option) return null;
    return sortDirection === 'desc' ? 
      <ArrowDownIcon className="h-4 w-4" /> : 
      <ArrowUpIcon className="h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <div className={`bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-8 ${className}`}>
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
            <span className="text-slate-300">Generating project ideas...</span>
          </div>
        </div>
      </div>
    );
  }

  if (artifacts.length === 0) {
    return (
      <div className={`bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-8 text-center ${className}`}>
        <div className="text-4xl mb-4">💡</div>
        <h3 className="text-xl font-semibold text-white mb-2">No Project Ideas Yet</h3>
        <p className="text-slate-400">
          Generate project artifacts from your research findings to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <SparklesIcon className="h-6 w-6 text-purple-400" />
        <h3 className="text-xl font-semibold text-white">Project Ideas</h3>
        <span className="px-2 py-1 bg-purple-600/20 text-purple-300 text-sm rounded">
          {artifacts.length} {artifacts.length === 1 ? 'idea' : 'ideas'}
        </span>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search project ideas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
          />
        </div>

        {/* Filter */}
        <div className="relative">
          <select
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value as FilterOption)}
            className="appearance-none bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2 pr-10 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
          >
            <option value="all">All Types</option>
            <option value="technical_proposal">Technical Proposals</option>
            <option value="integration_guide">Integration Guides</option>
            <option value="optimization_plan">Optimization Plans</option>
            <option value="security_audit">Security Audits</option>
            <option value="market_analysis">Market Analysis</option>
            <option value="automation_script">Automation Scripts</option>
            <option value="dashboard_design">Dashboard Designs</option>
            <option value="api_documentation">API Documentation</option>
          </select>
          <FunnelIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        </div>

        {/* Completion Filter - only show when completion controls are enabled */}
        {showCompletionControls && (
          <div className="relative">
            <select
              value={completionFilter}
              onChange={(e) => setCompletionFilter(e.target.value as CompletionFilter)}
              className="appearance-none bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2 pr-10 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
            >
              <option value="all">All Projects</option>
              <option value="completed">Completed</option>
              <option value="incomplete">Not Completed</option>
            </select>
            <FunnelIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>
        )}

        {/* Sort Options */}
        <div className="flex gap-2">
          {(['priority', 'impact', 'effort', 'confidence'] as SortOption[]).map((option) => (
            <button
              key={option}
              onClick={() => handleSort(option)}
              className={`px-3 py-2 text-sm rounded-lg transition-all flex items-center gap-1 ${
                sortBy === option
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                  : 'bg-slate-700/50 text-slate-300 border border-slate-600 hover:border-slate-500'
              }`}
            >
              {option.charAt(0).toUpperCase() + option.slice(1)}
              {getSortIcon(option)}
            </button>
          ))}
        </div>
      </div>

      {/* Results Summary */}
      {filteredArtifacts.length !== artifacts.length && (
        <div className="mb-4 text-sm text-slate-400">
          Showing {filteredArtifacts.length} of {artifacts.length} project ideas
          {searchTerm && ` matching "${searchTerm}"`}
          {filterBy !== 'all' && ` filtered by ${getTypeLabel(filterBy)}`}
          {showCompletionControls && completionFilter !== 'all' && ` (${completionFilter} only)`}
        </div>
      )}

      {/* Completion Status Summary - only show when completion controls are enabled */}
      {showCompletionControls && (
        <div className="mb-4 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500/20 border border-green-500 rounded-full flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
            </div>
            <span className="text-slate-300">
              {Array.from(completedArtifacts).filter(id => artifacts.some(a => a.id === id)).length} completed
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-slate-600 border border-slate-500 rounded-full"></div>
            <span className="text-slate-300">
              {artifacts.length - Array.from(completedArtifacts).filter(id => artifacts.some(a => a.id === id)).length} remaining
            </span>
          </div>
        </div>
      )}

      {/* Project Grid */}
      {sortedArtifacts.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {sortedArtifacts.map((artifact) => (
            <ProjectArtifactCard
              key={artifact.id}
              artifact={artifact}
              isSelected={selectedArtifact?.id === artifact.id}
              onSelect={onSelectArtifact}
              isCompleted={completedArtifacts.has(artifact.id)}
              onMarkCompleted={onMarkCompleted}
              onMarkIncomplete={onMarkIncomplete}
              showCompletionControls={showCompletionControls}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="text-2xl mb-2">🔍</div>
          <p className="text-slate-400">No project ideas match your current filters.</p>
          <button
            onClick={() => {
              setSearchTerm('');
              setFilterBy('all');
              setCompletionFilter('all');
            }}
            className="mt-2 text-purple-400 hover:text-purple-300 text-sm"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}