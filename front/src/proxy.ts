import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Protect study pages, leaving landing page and APIs public by default
const isProtectedRoute = createRouteMatcher(['/study(.*)', '/library(.*)']);

export const proxy = clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const proxyConfig = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.[^?]*$).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
