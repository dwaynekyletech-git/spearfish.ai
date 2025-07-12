import { SignIn } from '@clerk/nextjs';
import { RequireGuest } from '@/components/auth';

export default function SignInPage() {
  return (
    <RequireGuest>
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Welcome back</h1>
            <p className="text-gray-600 mt-2">Sign in to your Spearfish AI account</p>
          </div>
          <SignIn
            appearance={{
              elements: {
                rootBox: 'w-full',
                card: 'shadow-lg',
              },
            }}
          />
        </div>
      </div>
    </RequireGuest>
  );
}