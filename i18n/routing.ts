import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['nl', 'en', 'fr', 'de', 'es', 'it', 'ja', 'pt'],
  defaultLocale: 'nl',
  localePrefix: 'never'
});

export const locales = routing.locales;
export const defaultLocale = routing.defaultLocale;
export type Locale = (typeof locales)[number];
