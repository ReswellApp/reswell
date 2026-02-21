'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_LOCALE,
  getT,
  LOCALE_COOKIE_NAME,
  type Locale,
  SUPPORTED_LOCALES,
} from '@/lib/translations'

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

function getLocaleFromCookie(): Locale {
  if (typeof document === 'undefined') return DEFAULT_LOCALE
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE_NAME}=([^;]*)`))
  const value = match?.[1]?.trim()
  if (value === 'es' || value === 'en') return value
  return DEFAULT_LOCALE
}

function setLocaleCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
}

type LocaleContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: ReturnType<typeof getT>
  supportedLocales: typeof SUPPORTED_LOCALES
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode
  initialLocale?: Locale
}) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (initialLocale) return initialLocale
    return getLocaleFromCookie()
  })

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    setLocaleCookie(next)
    if (typeof document !== 'undefined') document.documentElement.lang = next
  }, [])

  const t = useMemo(() => getT(locale), [locale])

  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = locale
  }, [locale])

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t, supportedLocales: SUPPORTED_LOCALES }),
    [locale, setLocale, t]
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) {
    return {
      locale: DEFAULT_LOCALE as Locale,
      setLocale: () => {},
      t: getT(DEFAULT_LOCALE as Locale),
      supportedLocales: SUPPORTED_LOCALES,
    }
  }
  return ctx
}
