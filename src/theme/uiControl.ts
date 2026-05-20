import type { AppLocale } from '../i18n/appLocale'
import type { AppTheme } from './appTheme'

/** Tema + idioma para landing, auth y perfil. */
export interface UiControl {
  theme: AppTheme
  onThemeChange: (theme: AppTheme) => void
  locale: AppLocale
  onLocaleChange: (locale: AppLocale) => void
}
