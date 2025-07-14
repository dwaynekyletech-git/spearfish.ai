/**
 * Company Discovery Dashboard
 * 
 * Main interface for discovering and filtering AI companies with spearfish scores
 * Dark theme design inspired by modern AI job platforms
 */

import { Suspense } from 'react';
import { requireAuth } from '@/lib/auth';
import { DashboardClient } from '@/components/dashboard/DashboardClient';
import { NavigationHeader } from '@/components/dashboard/NavigationHeader';

export default async function DashboardPage() {
  // This will redirect to sign-in if user is not authenticated
  await requireAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Navigation Header */}
      <NavigationHeader />

      {/* Dashboard Client - handles search state */}
      <DashboardClient />
    </div>
  );
}