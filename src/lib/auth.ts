import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

/**
 * Server-side utility to protect API routes and pages
 * Redirects to sign-in if user is not authenticated
 */
export async function requireAuth() {
  const session = await auth();
  
  if (!session.userId) {
    redirect('/sign-in');
  }
  
  return session;
}

/**
 * Server-side utility to get current user session
 * Returns null if user is not authenticated
 */
export async function getCurrentUser() {
  const session = await auth();
  return session.userId ? session : null;
}

/**
 * Server-side utility to check if user is authenticated
 */
export async function isAuthenticated() {
  const session = await auth();
  return !!session.userId;
}