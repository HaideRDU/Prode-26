import './ThemeSwitch.css'
import type { AppTheme } from '../theme/appTheme'
import { useTranslation } from '../i18n/LocaleContext'

function SunIcon({ active }: { active: boolean }) {
  return (
    <span className={`theme-switch__icon${active ? ' theme-switch__icon--active' : ''}`} aria-hidden>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    </span>
  )
}

function MoonIcon({ active }: { active: boolean }) {
  return (
    <span className={`theme-switch__icon${active ? ' theme-switch__icon--active' : ''}`} aria-hidden>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </span>
  )
}

export function ThemeSwitch({
  value,
  onChange,
  className = '',
  variant = 'default',
}: {
  value: AppTheme
  onChange: (t: AppTheme) => void
  className?: string
  /** `auth`: tokens WC26; `default`: variables del shell (perfil, etc.) */
  variant?: 'default' | 'auth'
}) {
  const { t } = useTranslation()
  const isDark = value === 'dark'
  const rootClass = ['theme-switch', variant === 'auth' ? 'theme-switch--auth' : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={rootClass} data-theme={value}>
      <button
        type="button"
        className="theme-switch__btn"
        role="switch"
        aria-checked={isDark}
        aria-label={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
        onClick={() => onChange(isDark ? 'light' : 'dark')}
      >
        <span className="theme-switch__thumb" aria-hidden />
        <span className="theme-switch__track-inner">
          <SunIcon active={!isDark} />
          <MoonIcon active={isDark} />
        </span>
      </button>
    </div>
  )
}
