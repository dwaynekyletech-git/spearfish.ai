import { SignUp } from '@clerk/nextjs';
import { RequireGuest } from '@/components/auth';

export default function SignUpPage() {
  return (
    <RequireGuest>
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Get started</h1>
            <p className="text-gray-600 mt-2">Create your Spearfish AI account</p>
          </div>
          <SignUp
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