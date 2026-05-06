import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import {
  EmailAuthProvider,
  type AuthCredential,
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  GoogleAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
  type AuthError,
} from 'firebase/auth'
import { auth, isFirebaseConfigured } from './firebase'
import { getStoredUsername, saveUsername, syncUserProfile } from './userProfile'
import { MainLayout } from './layout/MainLayout'
import './layout/MainLayout.css'
import { DashboardPage } from './pages/DashboardPage'
import { RoomsHubPage } from './pages/RoomsHubPage'
import { RoomPredictionsPage } from './pages/RoomPredictionsPage'
import { RoomStandingsPage } from './pages/RoomStandingsPage'
import { ReglamentoPage } from './pages/ReglamentoPage'
import type { AccountOutletContext } from './types/outletContext'
import { AuthLayout } from './auth/AuthLayout'
import { BrandLogo } from './auth/BrandLogo'
import { LoginView } from './auth/LoginView'
import './auth/auth-theme.css'
import './theme/theme-dark.css'
import './App.css'
import { applyAppTheme, getStoredAppTheme, type AppTheme } from './theme/appTheme'

const AUTH_SAVED_EMAIL_KEY = 'authSavedEmail'

const EMAIL_VERIFY_RESEND_COOLDOWN_MS = 120_000

/** Alineado con `normalizeBase` en vite.config: URL absoluta de la raíz de la app (basename / GitHub Pages). */
function getAppRootHref(): string {
  const raw = import.meta.env.BASE_URL?.trim()
  if (!raw || raw === '/') return `${window.location.origin}/`
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`
  const base = withSlash.endsWith('/') ? withSlash : `${withSlash}/`
  return new URL(base, window.location.origin).href
}

function getEmailVerifySentAtKey(emailValue: string): string {
  return `firebaseEmailVerifySentAt:${emailValue}`
}

function getLastEmailVerifySentAt(emailValue: string): number {
  try {
    return Number(localStorage.getItem(getEmailVerifySentAtKey(emailValue)) || 0)
  } catch {
    return 0
  }
}

function setLastEmailVerifySentAt(emailValue: string): void {
  try {
    localStorage.setItem(getEmailVerifySentAtKey(emailValue), String(Date.now()))
  } catch {
    /* ignore */
  }
}

function mapFirebaseAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code
  switch (code) {
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Espera unos minutos y vuelve a intentar.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Correo o contraseña incorrectos.'
    case 'auth/invalid-email':
      return 'El correo no tiene un formato válido.'
    case 'auth/user-disabled':
      return 'Esta cuenta está deshabilitada.'
    case 'auth/network-request-failed':
      return 'Error de red. Comprueba tu conexión e inténtalo de nuevo.'
    default:
      return error instanceof Error ? error.message : 'Ocurrió un error.'
  }
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(isFirebaseConfigured)
  const [authError, setAuthError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false)
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState('')
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [registerSuccess, setRegisterSuccess] = useState(false)
  const skipAuthStateWhileEmailSignupRef = useRef(false)
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false)
  const [isVerifyEmailModalOpen, setIsVerifyEmailModalOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotError, setForgotError] = useState<string | null>(null)
  const [forgotSuccess, setForgotSuccess] = useState(false)
  const [forgotSending, setForgotSending] = useState(false)
  const [username, setUsername] = useState('')
  const [needsUsername, setNeedsUsername] = useState(false)
  const [pendingGoogleCredential, setPendingGoogleCredential] =
    useState<AuthCredential | null>(null)
  const [isLinkGoogleModalOpen, setIsLinkGoogleModalOpen] = useState(false)
  const [linkGoogleEmail, setLinkGoogleEmail] = useState('')
  const [linkGooglePassword, setLinkGooglePassword] = useState('')
  const [linkGoogleError, setLinkGoogleError] = useState<string | null>(null)
  const [linkGoogleBusy, setLinkGoogleBusy] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [appTheme, setAppThemeState] = useState<AppTheme>(() =>
    typeof window !== 'undefined' ? getStoredAppTheme() : 'light',
  )

  const setAppTheme = useCallback((t: AppTheme) => {
    setAppThemeState(t)
    applyAppTheme(t)
  }, [])

  const authThemeControl = useMemo(
    () => ({ theme: appTheme, onThemeChange: setAppTheme }),
    [appTheme, setAppTheme],
  )

  useLayoutEffect(() => {
    applyAppTheme(appTheme)
  }, [appTheme])

  const providerIds = useMemo(
    () => new Set(user?.providerData.map((provider) => provider.providerId) ?? []),
    [user],
  )
  const hasGoogleProvider = providerIds.has('google.com')
  const hasPasswordProvider = providerIds.has('password')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTH_SAVED_EMAIL_KEY)
      if (saved) {
        setEmail(saved)
        setRememberMe(true)
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (!auth) {
      setLoading(false)
      return
    }
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      try {
        if (skipAuthStateWhileEmailSignupRef.current && nextUser) {
          return
        }
        if (skipAuthStateWhileEmailSignupRef.current && !nextUser) {
          skipAuthStateWhileEmailSignupRef.current = false
        }
        setUser(nextUser)
        setAuthError(null)
        if (!nextUser) {
          setInfo(null)
        }
        if (nextUser) {
          const isGoogle = nextUser.providerData?.some((p) => p.providerId === 'google.com')
          if (isGoogle && !nextUser.photoURL && auth) {
            try {
              await nextUser.reload()
              if (auth.currentUser) setUser(auth.currentUser)
            } catch {
              /* ignore */
            }
          }
          if (nextUser.email) {
            setEmail(nextUser.email)
          }
          try {
            await syncUserProfile(nextUser)
            const storedUsername = await getStoredUsername(nextUser)
            setNeedsUsername(!storedUsername)
            setUsername(storedUsername ?? '')
            setProfileError(null)
          } catch (e) {
            setNeedsUsername(true)
            setUsername('')
            setProfileError(
              e instanceof Error ? e.message : 'No se pudo guardar el perfil en Firestore.',
            )
          }
        } else {
          setNeedsUsername(false)
          setUsername('')
          setProfileError(null)
        }
      } finally {
        setLoading(false)
      }
    })
    return () => unsub()
  }, [])

  function normalizeEmail(value: string): string {
    return value.trim().toLowerCase()
  }

  function validateEmailPassword(): { emailValue: string; passwordValue: string } | null {
    const emailValue = normalizeEmail(email)
    const passwordValue = password.trim()

    if (!emailValue || !passwordValue) {
      setAuthError('Completa correo y contraseña.')
      return null
    }
    if (passwordValue.length < 6) {
      setAuthError('La contraseña debe tener al menos 6 caracteres.')
      return null
    }
    return { emailValue, passwordValue }
  }

  function validatePasswordPolicy(passwordValue: string): string | null {
    if (passwordValue.length < 6) {
      return 'La contraseña debe tener al menos 6 caracteres.'
    }
    if (!/[A-Z]/.test(passwordValue)) {
      return 'La contraseña debe incluir al menos una mayúscula.'
    }
    if (!/\d/.test(passwordValue)) {
      return 'La contraseña debe incluir al menos un número.'
    }
    if (!/[^A-Za-z0-9]/.test(passwordValue)) {
      return 'La contraseña debe incluir al menos un símbolo especial.'
    }
    return null
  }

  async function handleGoogleSignIn() {
    if (!auth) return
    setAuthError(null)
    setInfo(null)
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
    } catch (e) {
      const firebaseError = e as { code?: string; customData?: { email?: string } }
      if (firebaseError.code === 'auth/account-exists-with-different-credential') {
        const pending = GoogleAuthProvider.credentialFromError(e as AuthError)
        if (pending) {
          setPendingGoogleCredential(pending)
        }
        const conflictEmail = firebaseError.customData?.email
        const resolved = normalizeEmail(conflictEmail ?? email)
        if (resolved) {
          setEmail(resolved)
          setLinkGoogleEmail(resolved)
        }
        setLinkGooglePassword('')
        setLinkGoogleError(null)
        setIsLinkGoogleModalOpen(true)
        return
      }
      setAuthError(mapFirebaseAuthError(e))
    }
  }

  async function handleEmailRegister() {
    if (!auth) return
    setAuthError(null)
    setInfo(null)
    setRegisterError(null)
    setRegisterSuccess(false)
    const emailValue = normalizeEmail(registerEmail)
    const passwordValue = registerPassword.trim()
    const passwordConfirmValue = registerPasswordConfirm.trim()

    if (!emailValue) {
      setRegisterError('Introduce un correo para crear la cuenta.')
      return
    }
    if (!passwordValue || !passwordConfirmValue) {
      setRegisterError('Completa contraseña y confirmar contraseña.')
      return
    }
    const passwordPolicyError = validatePasswordPolicy(passwordValue)
    if (passwordPolicyError) {
      setRegisterError(passwordPolicyError)
      return
    }
    if (passwordValue !== passwordConfirmValue) {
      setRegisterError('Las contraseñas no coinciden.')
      return
    }

    try {
      const existingMethods = await fetchSignInMethodsForEmail(auth, emailValue)
      if (existingMethods.includes('password')) {
        setRegisterError('Este correo ya tiene cuenta con contraseña. Usa "Entrar con correo".')
        return
      }
      if (existingMethods.includes('google.com')) {
        setRegisterError(
          'Este correo ya existe con Google. Entra con Google y luego vincula una contraseña.',
        )
        return
      }

      skipAuthStateWhileEmailSignupRef.current = true
      try {
        const credential = await createUserWithEmailAndPassword(auth, emailValue, passwordValue)
        await sendEmailVerification(credential.user)
        setLastEmailVerifySentAt(emailValue)
        await signOut(auth)
        setEmail(emailValue)
        setPassword('')
        setRegisterPassword('')
        setRegisterPasswordConfirm('')
        setRegisterError(null)
        setRegisterSuccess(true)
      } catch (e) {
        try {
          await signOut(auth)
        } catch {
          /* ignore */
        }
        skipAuthStateWhileEmailSignupRef.current = false
        setRegisterError(mapFirebaseAuthError(e))
      }
    } catch (e) {
      setRegisterError(mapFirebaseAuthError(e))
    }
  }

  async function handleEmailLogin() {
    if (!auth) return
    setAuthError(null)
    setInfo(null)
    const validData = validateEmailPassword()
    if (!validData) return

    const { emailValue, passwordValue } = validData

    try {
      const credential = await signInWithEmailAndPassword(auth, emailValue, passwordValue)

      if (!credential.user.emailVerified) {
        await signOut(auth)
        setAuthError(null)
        setInfo(null)
        setIsVerifyEmailModalOpen(true)
        return
      }

      try {
        if (rememberMe) {
          localStorage.setItem(AUTH_SAVED_EMAIL_KEY, emailValue)
        } else {
          localStorage.removeItem(AUTH_SAVED_EMAIL_KEY)
        }
      } catch {
        /* ignore */
      }

      if (pendingGoogleCredential) {
        await linkWithCredential(credential.user, pendingGoogleCredential)
        setPendingGoogleCredential(null)
        setInfo('Tu cuenta ahora puede iniciar sesión con correo/contraseña y con Google.')
      }
    } catch (e) {
      setAuthError(mapFirebaseAuthError(e))
    }
  }

  async function handleResendEmailVerification() {
    if (!auth) return
    setAuthError(null)
    setInfo(null)
    const validData = validateEmailPassword()
    if (!validData) return

    const { emailValue, passwordValue } = validData
    const lastSent = getLastEmailVerifySentAt(emailValue)
    const elapsed = Date.now() - lastSent
    if (lastSent > 0 && elapsed < EMAIL_VERIFY_RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((EMAIL_VERIFY_RESEND_COOLDOWN_MS - elapsed) / 1000)
      setAuthError(`Espera ${waitSec} s antes de volver a pedir el correo de verificación.`)
      return
    }

    try {
      const credential = await signInWithEmailAndPassword(auth, emailValue, passwordValue)
      if (credential.user.emailVerified) {
        await signOut(auth)
        setInfo('Tu correo ya está verificado. Puedes iniciar sesión con correo y contraseña.')
        return
      }
      await sendEmailVerification(credential.user)
      setLastEmailVerifySentAt(emailValue)
      await signOut(auth)
      setInfo('Te enviamos un nuevo correo de verificación. Revisa también la carpeta de spam.')
    } catch (e) {
      setAuthError(mapFirebaseAuthError(e))
    }
  }

  async function handleLinkGoogleWithPassword() {
    if (!auth || !pendingGoogleCredential) return
    const emailValue = normalizeEmail(linkGoogleEmail)
    const passwordValue = linkGooglePassword.trim()
    if (!emailValue) {
      setLinkGoogleError('Falta el correo.')
      return
    }
    if (!passwordValue) {
      setLinkGoogleError('Introduce la contraseña de tu cuenta con correo.')
      return
    }

    setLinkGoogleError(null)
    setLinkGoogleBusy(true)
    try {
      const credential = await signInWithEmailAndPassword(auth, emailValue, passwordValue)
      if (!credential.user.emailVerified) {
        await signOut(auth)
        setLinkGoogleError(
          'Primero verifica tu correo. Luego podrás vincular Google desde aquí o iniciando sesión con correo.',
        )
        return
      }
      await linkWithCredential(credential.user, pendingGoogleCredential)
      setPendingGoogleCredential(null)
      setIsLinkGoogleModalOpen(false)
      setLinkGooglePassword('')
      setInfo('Google quedó vinculado a tu cuenta. Ya puedes usar correo/contraseña o Google.')
    } catch (e) {
      setLinkGoogleError(mapFirebaseAuthError(e))
    } finally {
      setLinkGoogleBusy(false)
    }
  }

  async function handleForgotPassword() {
    if (!auth) return
    setForgotError(null)
    setForgotSending(true)
    const emailValue = normalizeEmail(forgotEmail)
    if (!emailValue) {
      setForgotError('Introduce un correo.')
      setForgotSending(false)
      return
    }

    try {
      const existingMethods = await fetchSignInMethodsForEmail(auth, emailValue)
      const hasPassword = existingMethods.includes('password')
      const hasGoogle = existingMethods.includes('google.com')

      if (hasGoogle && !hasPassword) {
        setForgotError(
          'Esta cuenta usa solo Google. Entra con Google; aquí no aplica restablecer contraseña.',
        )
        setForgotSending(false)
        return
      }

      const actionCodeSettings =
        typeof window !== 'undefined'
          ? { url: window.location.origin, handleCodeInApp: false as const }
          : undefined
      await sendPasswordResetEmail(auth, emailValue, actionCodeSettings)
      setForgotSuccess(true)
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code === 'auth/user-not-found' || code === 'auth/invalid-email') {
        setForgotError('No hay cuenta con ese correo o el formato no es válido.')
      } else {
        setForgotError(
          e instanceof Error ? e.message : 'No se pudo enviar el correo de restablecimiento.',
        )
      }
    } finally {
      setForgotSending(false)
    }
  }

  async function handleLinkPasswordToGoogleAccount() {
    if (!auth || !user?.email) return
    setAuthError(null)
    setInfo(null)
    const validData = validateEmailPassword()
    if (!validData) return

    const { emailValue, passwordValue } = validData
    if (emailValue !== normalizeEmail(user.email)) {
      setAuthError('El correo debe coincidir con el correo de la cuenta de Google actual.')
      return
    }
    const passwordPolicyError = validatePasswordPolicy(passwordValue)
    if (passwordPolicyError) {
      setAuthError(passwordPolicyError)
      return
    }

    try {
      const passwordCredential = EmailAuthProvider.credential(emailValue, passwordValue)
      await linkWithCredential(user, passwordCredential)
      setPassword('')
      setInfo('Contraseña vinculada correctamente. Ya puedes entrar por ambos métodos.')
    } catch (e) {
      setAuthError(mapFirebaseAuthError(e))
    }
  }

  async function handleSignOut() {
    if (!auth) return
    setAuthError(null)
    setInfo(null)
    try {
      await signOut(auth)
      window.location.replace(getAppRootHref())
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Error al cerrar sesión.')
    }
  }

  async function handleSaveUsername() {
    if (!user) return
    setAuthError(null)
    setInfo(null)
    const usernameValue = username.trim().toLowerCase()
    if (!usernameValue) {
      setAuthError('Introduce un nombre de usuario.')
      return
    }
    if (!/^[a-z0-9_]{3,20}$/.test(usernameValue)) {
      setAuthError(
        'El nombre de usuario debe tener 3-20 caracteres, solo minúsculas (a-z), números o _.',
      )
      return
    }
    try {
      await saveUsername(user, usernameValue)
      setNeedsUsername(false)
      setInfo('Nombre de usuario guardado correctamente.')
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'No se pudo guardar el nombre de usuario.')
    }
  }

  const accountOutletContext = useMemo((): AccountOutletContext | null => {
    if (!user) return null
    return {
      user,
      publicDisplayName: username.trim() || user.email?.split('@')[0] || 'usuario',
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
    }
  }, [
    user,
    username,
    email,
    password,
    hasGoogleProvider,
    hasPasswordProvider,
    authError,
    info,
    profileError,
    appTheme,
    setAppTheme,
  ])

  if (!isFirebaseConfigured) {
    return (
      <AuthLayout themeControl={authThemeControl}>
        <BrandLogo />
        <h1>Configura Firebase</h1>
        <p className="auth-wc26-lead">
          Copia <code>.env.example</code> a <code>.env</code> y completa las variables{' '}
          <code>VITE_FIREBASE_*</code> desde la consola de Firebase (app web).
        </p>
      </AuthLayout>
    )
  }

  if (loading) {
    return (
      <AuthLayout themeControl={authThemeControl}>
        <BrandLogo />
        <p className="auth-wc26-lead" style={{ marginBottom: 0 }}>
          Cargando sesión…
        </p>
      </AuthLayout>
    )
  }

  if (user && needsUsername) {
    return (
      <AuthLayout themeControl={authThemeControl}>
        <BrandLogo />
        <h1>Crea tu usuario</h1>
        <p className="auth-wc26-lead">
          Antes de continuar, define tu nombre de usuario. Lo usarás más adelante en la app.
        </p>
        <div className="auth-wc26-fields">
          <div className="auth-wc26-field-wrap">
            <label className="auth-wc26-label" htmlFor="auth-username">
              Nombre de usuario
            </label>
            <input
              id="auth-username"
              type="text"
              className="auth-wc26-input"
              placeholder="solo minúsculas, números y _"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              autoComplete="username"
            />
          </div>
        </div>
        <div className="auth-wc26-actions" style={{ marginTop: 20 }}>
          <button type="button" className="auth-wc26-btn-primary" onClick={handleSaveUsername}>
            Guardar nombre de usuario
          </button>
          <button type="button" className="auth-wc26-link" onClick={handleSignOut}>
            Cerrar sesión
          </button>
        </div>
        {authError ? <p className="auth-wc26-msg auth-wc26-msg--error" role="alert">{authError}</p> : null}
        {info ? <p className="auth-wc26-msg auth-wc26-msg--ok" role="status">{info}</p> : null}
        {profileError ? (
          <p className="auth-wc26-msg auth-wc26-msg--warn" role="status">
            Firestore: {profileError}
          </p>
        ) : null}
      </AuthLayout>
    )
  }

  if (user && !needsUsername && accountOutletContext) {
    return (
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route
            path="/"
            element={
              <MainLayout
                user={user}
                publicDisplayName={username.trim() || user.email?.split('@')[0] || 'usuario'}
                accountOutletContext={accountOutletContext}
              />
            }
          >
            <Route index element={<DashboardPage user={user} />} />
            <Route path="rooms" element={<RoomsHubPage user={user} />} />
            <Route path="rooms/new" element={<Navigate to="/rooms" replace />} />
            <Route path="join" element={<Navigate to="/rooms?tab=join" replace />} />
            <Route path="room/:roomId/predictions" element={<RoomPredictionsPage user={user} />} />
            <Route path="room/:roomId/standings" element={<RoomStandingsPage />} />
            <Route path="reglamento" element={<ReglamentoPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    )
  }

  return (
    <AuthLayout themeControl={authThemeControl}>
      <LoginView
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        rememberMe={rememberMe}
        setRememberMe={setRememberMe}
        onEmailLogin={handleEmailLogin}
        onRegisterClick={() => {
          setAuthError(null)
          setInfo(null)
          setRegisterEmail(email)
          setRegisterPassword('')
          setRegisterPasswordConfirm('')
          setRegisterError(null)
          setRegisterSuccess(false)
          setIsRegisterModalOpen(true)
        }}
        onForgotClick={() => {
          setAuthError(null)
          setInfo(null)
          setForgotEmail(email)
          setForgotError(null)
          setForgotSuccess(false)
          setForgotSending(false)
          setIsForgotModalOpen(true)
        }}
        onGoogleSignIn={handleGoogleSignIn}
        authError={authError}
        info={info}
        profileError={profileError}
      >
            {isVerifyEmailModalOpen ? (
              <div className="modal-overlay" role="presentation">
                <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="verify-email-title">
                  <div className="modal-header">
                    <h2 id="verify-email-title">Verifica el correo para poder iniciar sesión</h2>
                    <button
                      type="button"
                      className="modal-close"
                      aria-label="Cerrar"
                      onClick={() => {
                        setIsVerifyEmailModalOpen(false)
                        setAuthError(null)
                        setInfo(null)
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <p className="auth-lead small" style={{ textAlign: 'left' }}>
                    Si no te ha llegado el correo de verificación:
                  </p>
                  <div className="button-group">
                    <button type="button" className="btn-secondary" onClick={() => void handleResendEmailVerification()}>
                      Reenviar verificación de correo
                    </button>
                  </div>
                  {authError ? (
                    <p className="auth-error" role="alert">
                      {authError}
                    </p>
                  ) : null}
                  {info ? (
                    <p className="auth-info" role="status">
                      {info}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
            {isForgotModalOpen ? (
              <div className="modal-overlay" role="presentation">
                <div className="modal-card" role="dialog" aria-modal="true">
                  <div className="modal-header">
                    <h2>Restablecer contraseña</h2>
                    <button
                      type="button"
                      className="modal-close"
                      aria-label="Cerrar"
                      onClick={() => {
                        setIsForgotModalOpen(false)
                        setForgotError(null)
                        setForgotSuccess(false)
                        setForgotSending(false)
                      }}
                    >
                      ×
                    </button>
                  </div>
                  {forgotSuccess ? (
                    <p className="auth-info" role="status">
                      Revisa tu correo para restablecer la contraseña (revisa también la carpeta de
                      spam).
                    </p>
                  ) : (
                    <>
                      <p className="auth-lead small">
                        Escribe tu correo y te enviaremos un enlace de restablecimiento.
                      </p>
                      <div className="form-fields">
                        <input
                          type="email"
                          className="field-input"
                          placeholder="Correo"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          autoComplete="email"
                        />
                      </div>
                      <div className="button-group">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={handleForgotPassword}
                          disabled={forgotSending}
                        >
                          {forgotSending ? 'Enviando…' : 'Restablecer contraseña'}
                        </button>
                      </div>
                      {forgotError ? (
                        <p className="auth-error" role="alert">
                          {forgotError}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            ) : null}
            {isRegisterModalOpen ? (
              <div className="modal-overlay" role="presentation">
                <div className="modal-card" role="dialog" aria-modal="true">
                  <div className="modal-header">
                    <h2>Crear cuenta</h2>
                    <button
                      type="button"
                      className="modal-close"
                      aria-label="Cerrar"
                      onClick={() => {
                        setIsRegisterModalOpen(false)
                        setRegisterError(null)
                        setRegisterSuccess(false)
                      }}
                    >
                      ×
                    </button>
                  </div>
                  {registerSuccess ? (
                    <p className="auth-info" role="status">
                      Revisa tu correo para verificar tu cuenta (revisa también la carpeta de spam).
                    </p>
                  ) : (
                    <>
                      <p className="auth-lead small">
                        Contraseña requerida: 6+ caracteres, una mayúscula, un número y un símbolo.
                      </p>
                      <div className="form-fields">
                        <input
                          type="email"
                          className="field-input"
                          placeholder="Correo"
                          value={registerEmail}
                          onChange={(e) => setRegisterEmail(e.target.value)}
                          autoComplete="email"
                        />
                        <input
                          type="password"
                          className="field-input"
                          placeholder="Contraseña"
                          value={registerPassword}
                          onChange={(e) => setRegisterPassword(e.target.value)}
                          autoComplete="new-password"
                        />
                        <input
                          type="password"
                          className="field-input"
                          placeholder="Repite la contraseña"
                          value={registerPasswordConfirm}
                          onChange={(e) => setRegisterPasswordConfirm(e.target.value)}
                          autoComplete="new-password"
                        />
                      </div>
                      <div className="button-group">
                        <button type="button" className="btn-secondary" onClick={handleEmailRegister}>
                          Crear cuenta
                        </button>
                      </div>
                      {registerError ? (
                        <p className="auth-error" role="alert">
                          {registerError}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            ) : null}
            {isLinkGoogleModalOpen ? (
              <div className="modal-overlay" role="presentation">
                <div className="modal-card" role="dialog" aria-modal="true">
                  <div className="modal-header">
                    <h2>Vincular Google a tu cuenta</h2>
                    <button
                      type="button"
                      className="modal-close"
                      aria-label="Cerrar"
                      onClick={() => {
                        setIsLinkGoogleModalOpen(false)
                        setLinkGoogleError(null)
                        setLinkGoogleBusy(false)
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <p className="auth-lead small">
                    Este correo ya tiene cuenta con contraseña. Google confirma el mismo correo;
                    introduce tu contraseña una vez para unir el inicio con Google (requisito de
                    seguridad de Firebase).
                  </p>
                  <div className="form-fields">
                    <input
                      type="email"
                      className="field-input"
                      placeholder="Correo"
                      value={linkGoogleEmail}
                      onChange={(e) => setLinkGoogleEmail(e.target.value)}
                      autoComplete="email"
                    />
                    <input
                      type="password"
                      className="field-input"
                      placeholder="Contraseña de la cuenta"
                      value={linkGooglePassword}
                      onChange={(e) => setLinkGooglePassword(e.target.value)}
                      autoComplete="current-password"
                    />
                  </div>
                  <div className="button-group">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleLinkGoogleWithPassword}
                      disabled={linkGoogleBusy}
                    >
                      {linkGoogleBusy ? 'Vinculando…' : 'Vincular e iniciar sesión'}
                    </button>
                  </div>
                  {linkGoogleError ? (
                    <p className="auth-error" role="alert">
                      {linkGoogleError}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
      </LoginView>
    </AuthLayout>
  )
}

export default App
