'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
  fallback?: React.ReactNode;
}

/**
 * Flexible authentication guard component
 * Can be used for both protected and public routes
 */
export function AuthGuard({ 
  children, 
  requireAuth = true, 
  redirectTo = '/sign-in',
  fallback 
}: AuthGuardProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded) {
      if (requireAuth && !isSignedIn) {
        router.push(redirectTo);
      } else if (!requireAuth && isSignedIn) {
        // Redirect authenticated users away from auth pages
        router.push('/dashboard');
      }
    }
  }, [isLoaded, isSignedIn, requireAuth, redirectTo, router]);

  // Show loading state while checking authentication
  if (!isLoaded) {
    return fallback || (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // For protected routes, only show content if user is signed in
  if (requireAuth && !isSignedIn) {
    return fallback || null;
  }

  // For public routes, only show content if user is not signed in
  if (!requireAuth && isSignedIn) {
    return fallback || null;
  }

  return <>{children}</>;
}

/**
 * Shorthand for protecting routes
 */
export const RequireAuth = ({ children, ...props }: Omit<AuthGuardProps, 'requireAuth'>) => (
  <AuthGuard requireAuth={true} {...props}>
    {children}
  </AuthGuard>
);

/**
 * Shorthand for public-only routes (like sign-in, sign-up)
 */
export const RequireGuest = ({ children, ...props }: Omit<AuthGuardProps, 'requireAuth'>) => (
  <AuthGuard requireAuth={false} {...props}>
    {children}
  </AuthGuard>
);