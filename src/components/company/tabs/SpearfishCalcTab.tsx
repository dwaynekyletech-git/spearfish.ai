/**
 * Spearfish Calculation Tab Component
 * 
 * Displays detailed spearfish score breakdown and calculation methodology
 */

'use client';

import { SpearfishScoreBreakdown } from '../SpearfishScoreBreakdown';

interface SpearfishCalcTabProps {
  company: any;
}

export function SpearfishCalcTab({ company }: SpearfishCalcTabProps) {
  return (
    <div className="space-y-8">
      {/* Spearfish Score Breakdown */}
      <SpearfishScoreBreakdown company={company} />
    </div>
  );
}