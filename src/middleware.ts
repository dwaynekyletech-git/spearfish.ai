import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Define protected routes that require authentication
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/profile(.*)',
  '/companies(.*)',
  '/settings(.*)',
  '/admin(.*)',
  '/api/companies(.*)',
  '/api/company-data(.*)',
  '/api/user(.*)',
  '/api/admin(.*)',
]);

// Define public routes that should not be protected
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  // Handle API routes differently from page routes
  if (req.nextUrl.pathname.startsWith('/api/')) {
    // For API routes, we'll let the individual route handlers handle authentication
    // This avoids the middleware interfering with API responses
    return;
  }
  
  // Protect page routes that require authentication, but not public routes
  if (isProtectedRoute(req) && !isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};