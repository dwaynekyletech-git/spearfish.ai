import { requireAuth } from '@/lib/auth';
import { UserButton } from '@clerk/nextjs';

export default async function DashboardPage() {
  // This will redirect to sign-in if user is not authenticated
  const session = await requireAuth();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <UserButton />
      </div>
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Welcome to Spearfish AI</h2>
        <p className="text-gray-600 mb-4">
          You are successfully authenticated! User ID: {session.userId}
        </p>
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-blue-900">Protected Route Test</h3>
            <p className="text-blue-700 text-sm">
              This page is protected by server-side authentication middleware.
            </p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <h3 className="font-medium text-green-900">Next Steps</h3>
            <p className="text-green-700 text-sm">
              You can now access protected features of Spearfish AI.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}