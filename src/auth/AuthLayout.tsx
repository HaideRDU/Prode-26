import type { ReactNode } from 'react'
import { LanguageSwitch } from '../components/LanguageSwitch'
import { ThemeSwitch } from '../components/ThemeSwitch'
import type { UiControl } from '../theme/uiControl'

export function AuthLayout({
  children,
  uiControl,
}: {
  children: ReactNode
  uiControl?: UiControl
}) {
  return (
    <main className="auth-wc26 auth-wc26-shell">
      {uiControl ? (
        <div className="auth-wc26-prefs-corner">
          <ThemeSwitch
            value={uiControl.theme}
            onChange={uiControl.onThemeChange}
            variant="auth"
          />
          <LanguageSwitch
            value={uiControl.locale}
            onChange={uiControl.onLocaleChange}
            variant="auth"
          />
        </div>
      ) : null}
      <div className="auth-wc26-card">{children}</div>
    </main>
  )
}
