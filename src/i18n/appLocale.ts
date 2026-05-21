export const APP_LOCALE_KEY = 'appLocale'

/** Selector ES/EN en UI. Desactivado por ahora: app solo en español. */
export const I18N_UI_ENABLED = false

export type AppLocale = 'es' | 'en'

export function getStoredAppLocale(): AppLocale {
  if (!I18N_UI_ENABLED) return 'es'
  try {
    const v = localStorage.getItem(APP_LOCALE_KEY)
    if (v === 'en' || v === 'es') return v
  } catch {
    /* ignore */
  }
  if (typeof navigator !== 'undefined') {
    const lang = navigator.language.toLowerCase()
    if (lang.startsWith('en')) return 'en'
  }
  return 'es'
}

export function applyAppLocale(locale: AppLocale): void {
  document.documentElement.lang = locale === 'en' ? 'en' : 'es'
  try {
    localStorage.setItem(APP_LOCALE_KEY, locale)
  } catch {
    /* ignore */
  }
}
