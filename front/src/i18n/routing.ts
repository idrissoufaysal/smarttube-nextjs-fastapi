import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['fr', 'en'],
  defaultLocale: 'fr',
  // Chaque URL est préfixée (/fr/..., /en/...) avec détection automatique
  // du premier passage (Accept-Language) mémorisée dans un cookie.
  localePrefix: 'always',
  localeDetection: true,
});

export type Locale = (typeof routing.locales)[number];
