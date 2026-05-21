export const APP_THEME_KEY = 'appTheme'

/** Ocultar interruptor claro/oscuro en landing, auth y perfil hasta terminar estilos. */
export const THEME_SWITCH_UI_ENABLED = false

export type AppTheme = 'light' | 'dark'

export function getStoredAppTheme(): AppTheme {
  try {
    const v = localStorage.getItem(APP_THEME_KEY)
    if (v === 'dark' || v === 'light') return v
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

export function applyAppTheme(theme: AppTheme): void {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(APP_THEME_KEY, theme)
  } catch {
    /* ignore */
  }
}
