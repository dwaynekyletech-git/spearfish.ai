import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getGlobalResearchService } from '@/lib/company-research-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; sessionId: string } }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { sessionId } = params;
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing Parameters', message: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Get real research findings using singleton
    const researchService = getGlobalResearchService();
    const progress = await researchService.getResearchProgress(sessionId);
    
    if (!progress) {
      return NextResponse.json(
        { error: 'Session Not Found', message: 'Research session not found or expired' },
        { status: 404 }
      );
    }

    // Check if research is completed
    if (progress.status !== 'completed') {
      return NextResponse.json(
        { error: 'Research Not Complete', message: 'Research session is still in progress' },
        { status: 202 }
      );
    }

    // Group findings by category for better organization
    const groupedFindings = progress.findings.reduce((groups, finding) => {
      const category = finding.finding_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push({
        id: finding.id,
        title: finding.title,
        description: finding.content,
        confidence_score: finding.confidence_score,
        citations: finding.citations,
        priority_level: finding.priority_level,
        tags: finding.tags,
        created_at: finding.created_at.toISOString()
      });
      return groups;
    }, {} as Record<string, any[]>);

    // Sort findings within each category by confidence score (highest first)
    Object.keys(groupedFindings).forEach(category => {
      groupedFindings[category].sort((a, b) => b.confidence_score - a.confidence_score);
    });

    // Create a summary structure
    const summary = {
      total_findings: progress.findings.length,
      categories: Object.keys(groupedFindings),
      high_confidence_findings: progress.findings.filter(f => f.confidence_score >= 0.7).length,
      completion_time: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      summary,
      findings_by_category: groupedFindings,
      // Also include flat findings for backward compatibility
      findings: progress.findings.map(finding => ({
        id: finding.id,
        category: finding.finding_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        title: finding.title,
        description: finding.content,
        confidence_score: finding.confidence_score,
        citations: finding.citations,
        created_at: finding.created_at.toISOString()
      }))
    });

  } catch (error) {
    console.error('Results retrieval failed:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal Server Error', 
        message: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}