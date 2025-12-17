'use client';

import { useState, useEffect, useCallback } from 'react';
import { locales, defaultLocale, type Locale, localeNames, localeFlags } from './config';

// Static imports for all locales (ensures bundling works in production)
import messagesEn from '../../messages/en.json';
import messagesEs from '../../messages/es.json';
import messagesPt from '../../messages/pt.json';

const LOCALE_STORAGE_KEY = 'astro-locale';

// Pre-loaded messages map
const messagesMap: Record<Locale, Record<string, unknown>> = {
  en: messagesEn,
  es: messagesEs,
  pt: messagesPt,
};

export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  // Initialize with default locale messages immediately (no loading state needed)
  const [messages, setMessages] = useState<Record<string, unknown>>(messagesMap[defaultLocale]);
  const [isLoading, setIsLoading] = useState(false);

  // Load locale from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null;
    if (stored && locales.includes(stored)) {
      setLocaleState(stored);
      setMessages(messagesMap[stored]);
    } else {
      // Detect browser language
      const browserLang = navigator.language.split('-')[0] as Locale;
      if (locales.includes(browserLang)) {
        setLocaleState(browserLang);
        setMessages(messagesMap[browserLang]);
      }
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
    setLocaleState(newLocale);
    setMessages(messagesMap[newLocale]);
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
