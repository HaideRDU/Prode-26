import type { ReactNode } from 'react'
import type { AppTheme } from '../theme/appTheme'
import { ThemeSwitch } from '../components/ThemeSwitch'

export function AuthLayout({
  children,
  themeControl,
}: {
  children: ReactNode
  themeControl?: { theme: AppTheme; onThemeChange: (t: AppTheme) => void }
}) {
  return (
    <main className="auth-wc26 auth-wc26-shell">
      {themeControl ? (
        <div className="auth-wc26-theme-corner">
          <ThemeSwitch
            value={themeControl.theme}
            onChange={themeControl.onThemeChange}
            variant="auth"
          />
        </div>
      ) : null}
      <div className="auth-wc26-card">{children}</div>
    </main>
  )
}
