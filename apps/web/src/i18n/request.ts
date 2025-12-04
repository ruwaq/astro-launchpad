import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, locales, type Locale } from './config';

export default getRequestConfig(async () => {
  // Get locale from cookie or use default
  // In a real app, you'd get this from cookies or user preferences
  const locale: Locale = defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});

export function getMessages(locale: Locale) {
  return import(`../../messages/${locale}.json`);
}

export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}
