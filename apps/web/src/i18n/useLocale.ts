'use client';

import { useState, useEffect, useCallback } from 'react';
import { locales, defaultLocale, type Locale, localeNames, localeFlags } from './config';

const LOCALE_STORAGE_KEY = 'astro-locale';

export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [messages, setMessages] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Load locale from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null;
    if (stored && locales.includes(stored)) {
      setLocaleState(stored);
    } else {
      // Detect browser language
      const browserLang = navigator.language.split('-')[0] as Locale;
      if (locales.includes(browserLang)) {
        setLocaleState(browserLang);
      }
    }
  }, []);

  // Load messages when locale changes
  useEffect(() => {
    setIsLoading(true);
    import(`../../messages/${locale}.json`)
      .then((mod) => {
        setMessages(mod.default);
        setIsLoading(false);
      })
      .catch(() => {
        // Fallback to English
        import(`../../messages/en.json`).then((mod) => {
          setMessages(mod.default);
          setIsLoading(false);
        });
      });
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
    setLocaleState(newLocale);
  }, []);

  // Simple translation function
  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const keys = key.split('.');
      let value: unknown = messages;

      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = (value as Record<string, unknown>)[k];
        } else {
          return key; // Return key if translation not found
        }
      }

      if (typeof value !== 'string') return key;

      // Replace params like {name} with actual values
      if (params) {
        return value.replace(/\{(\w+)\}/g, (_, paramKey) =>
          String(params[paramKey] ?? `{${paramKey}}`)
        );
      }

      return value;
    },
    [messages]
  );

  return {
    locale,
    setLocale,
    t,
    isLoading,
    locales,
    localeNames,
    localeFlags,
  };
}

export type { Locale };
