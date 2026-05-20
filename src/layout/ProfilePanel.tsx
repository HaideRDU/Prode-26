import { AmericasTimezonePicker } from '../components/AmericasTimezonePicker'
import '../components/americas-timezone-picker.css'
import { LanguageSwitch } from '../components/LanguageSwitch'
import { ThemeSwitch } from '../components/ThemeSwitch'
import { useTranslation } from '../i18n/LocaleContext'
import type { AccountOutletContext } from '../types/outletContext'

/** Contenido del panel lateral de perfil (antes página Cuenta). */
export function ProfilePanel({
  ctx,
  onClose,
}: {
  ctx: AccountOutletContext
  onClose: () => void
}) {
  const { t, locale, setLocale } = useTranslation()
  const {
    user,
    publicDisplayName,
    email,
    setEmail,
    password,
    setPassword,
    hasGoogleProvider,
    hasPasswordProvider,
    handleLinkPasswordToGoogleAccount,
    handleSignOut,
    authError,
    info,
    profileError,
    appTheme,
    setAppTheme,
    timeZone,
    americasRegion,
    setAmericasRegion,
    setTimeZone,
    persistTimeZone,
  } = ctx

  const googleName = user.displayName?.trim()

  async function handleTimeZoneChange(next: string) {
    setTimeZone(next)
    try {
      await persistTimeZone(next)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="profile-panel">
      <div className="profile-panel-header">
        <h2 className="profile-panel-title">{t('profile.title')}</h2>
        <button
          type="button"
          className="profile-panel-close"
          onClick={onClose}
          aria-label={t('profile.close')}
        >
          ×
        </button>
      </div>
      <div className="profile-panel-body">
        <div className="user-block" style={{ marginBottom: 24 }}>
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt=""
              className="user-avatar"
              width={72}
              height={72}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="profile-panel-avatar-fallback" aria-hidden>
              {publicDisplayName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <p className="user-name profile-panel-username">{publicDisplayName}</p>
          {hasGoogleProvider && googleName ? (
            <p className="user-email">
              <span className="app-muted">{t('profile.googleName')} </span>
              {googleName}
            </p>
          ) : null}
          {user.email ? (
            <p className="user-email">
              <span className="app-muted">{t('profile.email')} </span>
              {user.email}
            </p>
          ) : null}
        </div>

        <div className="profile-prefs-row profile-prefs-row--with-tz" style={{ marginBottom: 24 }}>
          <div className="profile-pref-block">
            <p className="app-muted profile-pref-label">{t('profile.appTheme')}</p>
            <ThemeSwitch value={appTheme} onChange={setAppTheme} className="profile-theme-switch" />
          </div>
          <div className="profile-pref-block">
            <p className="app-muted profile-pref-label">{t('profile.language')}</p>
            <LanguageSwitch value={locale} onChange={setLocale} className="profile-lang-switch" />
          </div>
          <div className="profile-pref-block profile-pref-block--timezone">
            <p className="app-muted profile-pref-label">{t('profile.timeZone')}</p>
            <AmericasTimezonePicker
              idPrefix="profile-tz"
              variant="profile"
              region={americasRegion}
              timeZone={timeZone}
              onRegionChange={setAmericasRegion}
              onTimeZoneChange={(tz) => void handleTimeZoneChange(tz)}
            />
          </div>
        </div>

        {hasGoogleProvider && !hasPasswordProvider ? (
          <>
            <p className="auth-lead small" style={{ textAlign: 'left' }}>
              {t('profile.linkPasswordLead')}
            </p>
            <div className="form-fields" style={{ maxWidth: '100%' }}>
              <input
                type="email"
                className="field-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              <input
                type="password"
                className="field-input"
                placeholder={t('profile.newPassword')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <button
              type="button"
              className="btn-secondary"
              style={{ marginTop: 8 }}
              onClick={() => void handleLinkPasswordToGoogleAccount()}
            >
              {t('profile.linkPassword')}
            </button>
          </>
        ) : null}

        {authError ? <p className="auth-error">{authError}</p> : null}
        {info ? <p className="auth-info">{info}</p> : null}
        {profileError ? (
          <p className="auth-warn">
            {t('profile.firestore')} {profileError}
          </p>
        ) : null}

        <button
          type="button"
          className="btn-header-signout profile-panel-signout"
          onClick={() => void handleSignOut()}
        >
          {t('profile.signOut')}
        </button>
      </div>
    </div>
  )
}
