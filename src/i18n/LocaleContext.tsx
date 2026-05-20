import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { applyAppLocale, type AppLocale } from './appLocale'
import { t, type MessageKey } from './messages'

type LocaleContextValue = {
  locale: AppLocale
  setLocale: (locale: AppLocale) => void
  tr: (key: MessageKey) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({
  locale,
  setLocale,
  children,
}: {
  locale: AppLocale
  setLocale: (locale: AppLocale) => void
  children: ReactNode
}) {
  const setLocaleAndApply = useCallback(
    (next: AppLocale) => {
      setLocale(next)
      applyAppLocale(next)
    },
    [setLocale],
  )

  const value = useMemo(
    () => ({
      locale,
      setLocale: setLocaleAndApply,
      tr: (key: MessageKey) => t(locale, key),
    }),
    [locale, setLocaleAndApply],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) {
    throw new Error('useLocale must be used within LocaleProvider')
  }
  return ctx
}

/** Atajo para traducciones en componentes bajo LocaleProvider. */
export function useTranslation() {
  const { tr, locale, setLocale } = useLocale()
  return { t: tr, locale, setLocale }
}
