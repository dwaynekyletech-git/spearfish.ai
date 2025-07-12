import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col p-8">
      {/* Navigation */}
      <nav className="flex items-center justify-between mb-16">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold">Spearfish AI</h1>
        </div>
        <div className="flex items-center space-x-4">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
                Sign In
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link 
              href="/dashboard" 
              className="text-blue-600 hover:text-blue-800 transition-colors"
            >
              Dashboard
            </Link>
            <UserButton />
          </SignedIn>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="flex flex-col items-center justify-center flex-1 text-center">
        <h1 className="text-6xl font-bold mb-6">
          Welcome to <span className="text-blue-600">Spearfish AI</span>
        </h1>
        
        <p className="text-xl text-gray-600 mb-8 max-w-2xl">
          Discover and analyze companies with advanced AI scoring and insights. 
          Make data-driven decisions with our powerful company discovery platform.
        </p>

        <div className="flex space-x-4">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg hover:bg-blue-700 transition-colors">
                Get Started
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link 
              href="/dashboard"
              className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg hover:bg-blue-700 transition-colors"
            >
              Go to Dashboard
            </Link>
          </SignedIn>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl">
          <div className="p-6 bg-white rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-3">AI-Powered Discovery</h3>
            <p className="text-gray-600">
              Leverage advanced AI algorithms to discover promising companies and startups.
            </p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-3">Smart Scoring</h3>
            <p className="text-gray-600">
              Get intelligent scoring and insights based on multiple data points and metrics.
            </p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-3">Data-Driven Insights</h3>
            <p className="text-gray-600">
              Make informed decisions with comprehensive company analysis and reports.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}