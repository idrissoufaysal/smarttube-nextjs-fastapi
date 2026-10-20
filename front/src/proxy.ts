import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

// Pages protégées — motifs avec préfixe locale inclus
// (/fr/study, /en/study, /fr/library, /en/library, + sous-chemins)
const isProtectedRoute = createRouteMatcher(
  routing.locales.flatMap((locale) => [
    `/${locale}/study(.*)`,
    `/${locale}/library(.*)`,
  ])
);

export const proxy = clerkMiddleware(async (auth, req) => {
  // 1. Routage i18n d'abord : si l'URL ne porte pas encore de préfixe de
  //    locale (/study → /fr/study), on renvoie la redirection telle quelle,
  //    sans vérification d'auth (elle aura lieu sur la requête suivante).
  const localeResponse = intlMiddleware(req);
  if (localeResponse.headers.get('location')) {
    return localeResponse;
  }

  // 2. Protection Clerk des pages app (auth.protect() déclenche la
  //    redirection vers Clerk si l'utilisateur n'est pas connecté)
  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  return localeResponse;
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.[^?]*$).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
