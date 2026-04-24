import type { ReactNode } from 'react'
import { BrandLogo } from './BrandLogo'

export function LoginView({
  email,
  setEmail,
  password,
  setPassword,
  rememberMe,
  setRememberMe,
  onEmailLogin,
  onRegisterClick,
  onForgotClick,
  onGoogleSignIn,
  authError,
  info,
  profileError,
  children,
}: {
  email: string
  setEmail: (v: string) => void
  password: string
  setPassword: (v: string) => void
  rememberMe: boolean
  setRememberMe: (v: boolean) => void
  onEmailLogin: () => void
  onRegisterClick: () => void
  onForgotClick: () => void
  onGoogleSignIn: () => void
  authError: string | null
  info: string | null
  profileError: string | null
  children?: ReactNode
}) {
  return (
    <>
      <BrandLogo />
      <h1>Bienvenido</h1>
      <p className="auth-wc26-lead">Inicia sesión con tu correo o con Google.</p>

      <div className="auth-wc26-fields">
        <div className="auth-wc26-field-wrap">
          <label className="auth-wc26-label" htmlFor="auth-email">
            Correo electrónico
          </label>
          <input
            id="auth-email"
            type="email"
            className="auth-wc26-input"
            placeholder="tu@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
          />
        </div>
        <div className="auth-wc26-field-wrap">
          <label className="auth-wc26-label" htmlFor="auth-password">
            Contraseña
          </label>
          <input
            id="auth-password"
            type="password"
            className="auth-wc26-input"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <label className="auth-wc26-remember">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          Recordar mi correo en este dispositivo
        </label>
      </div>

      <div className="auth-wc26-actions">
        <button type="button" className="auth-wc26-btn-primary" onClick={onEmailLogin}>
          Entrar
        </button>
        <button type="button" className="auth-wc26-btn-secondary" onClick={onRegisterClick}>
          Crear cuenta
        </button>
      </div>

      <div className="auth-wc26-links">
        <button type="button" className="auth-wc26-link" onClick={onForgotClick}>
          Olvidé mi contraseña
        </button>
      </div>

      <button type="button" className="auth-wc26-google" onClick={onGoogleSignIn}>
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Continuar con Google
      </button>

      {children}

      {authError ? (
        <p className="auth-wc26-msg auth-wc26-msg--error" role="alert">
          {authError}
        </p>
      ) : null}
      {info ? (
        <p className="auth-wc26-msg auth-wc26-msg--ok" role="status">
          {info}
        </p>
      ) : null}
      {profileError ? (
        <p className="auth-wc26-msg auth-wc26-msg--warn" role="status">
          Firestore: {profileError}
        </p>
      ) : null}
    </>
  )
}
