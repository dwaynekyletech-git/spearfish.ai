/**
 * Company Profile Page
 * 
 * Dynamic route for individual company profiles with tabbed navigation
 */

import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { NavigationHeader } from '@/components/dashboard/NavigationHeader';
import { CompanyProfileClient } from '@/components/company/CompanyProfileClient';

interface CompanyPageProps {
  params: {
    id: string;
  };
}

export default async function CompanyPage({ params }: CompanyPageProps) {
  // Ensure user is authenticated
  await requireAuth();

  // In a real app, you'd fetch company data here
  // For now, we'll pass the ID to the client component
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <NavigationHeader />
      <CompanyProfileClient companyId={params.id} />
    </div>
  );
}