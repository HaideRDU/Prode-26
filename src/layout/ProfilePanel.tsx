import type { AccountOutletContext } from '../types/outletContext'
import { ThemeSwitch } from '../components/ThemeSwitch'

/** Contenido del panel lateral de perfil (antes página Cuenta). */
export function ProfilePanel({
  ctx,
  onClose,
}: {
  ctx: AccountOutletContext
  onClose: () => void
}) {
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
  } = ctx

  const googleName = user.displayName?.trim()

  return (
    <div className="profile-panel">
      <div className="profile-panel-header">
        <h2 className="profile-panel-title">Perfil</h2>
        <button type="button" className="profile-panel-close" onClick={onClose} aria-label="Cerrar">
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
              <span className="app-muted">Nombre en Google: </span>
              {googleName}
            </p>
          ) : null}
          {user.email ? (
            <p className="user-email">
              <span className="app-muted">Correo: </span>
              {user.email}
            </p>
          ) : null}
        </div>

        <div className="profile-theme-block" style={{ marginBottom: 24 }}>
          <p className="app-muted" style={{ marginBottom: 8, fontSize: '0.85rem' }}>
            Tema de la aplicación
          </p>
          <ThemeSwitch value={appTheme} onChange={setAppTheme} className="profile-theme-switch" />
        </div>

        {hasGoogleProvider && !hasPasswordProvider ? (
          <>
            <p className="auth-lead small" style={{ textAlign: 'left' }}>
              Opcional: vincula una contraseña para entrar también con correo.
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
                placeholder="Nueva contraseña"
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
              Vincular contraseña
            </button>
          </>
        ) : null}

        {authError ? <p className="auth-error">{authError}</p> : null}
        {info ? <p className="auth-info">{info}</p> : null}
        {profileError ? <p className="auth-warn">Firestore: {profileError}</p> : null}

        <button
          type="button"
          className="btn-header-signout profile-panel-signout"
          onClick={() => void handleSignOut()}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
