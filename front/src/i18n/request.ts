import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { locale as rootLocale } from 'next/root-params';
import { routing } from './routing';

export default getRequestConfig(async () => {
  // La locale est portée par le segment racine [locale] (Next.js 16.3+)
  const requested = await rootLocale();

  // Hors segment [locale] (prérendu de /_not-found, assets…) aucun paramètre
  // n'existe : on retombe sur la locale par défaut au lieu de planter.
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`@/messages/${locale}.json`)).default,
  };
});
