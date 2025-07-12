'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Client-side route protection component
 * Redirects to sign-in if user is not authenticated
 */
export function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in');
    }
  }, [isLoaded, isSignedIn, router]);

  // Show loading state while checking authentication
  if (!isLoaded) {
    return fallback || <div>Loading...</div>;
  }

  // Show content only if user is signed in
  if (isSignedIn) {
    return <>{children}</>;
  }

  // Show fallback or nothing while redirecting
  return fallback || null;
}

/**
 * Higher-order component for protecting pages
 */
export function withAuth<T extends object>(
  Component: React.ComponentType<T>,
  fallback?: React.ReactNode
) {
  return function AuthenticatedComponent(props: T) {
    return (
      <ProtectedRoute fallback={fallback}>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
}