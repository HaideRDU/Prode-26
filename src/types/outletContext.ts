import type { User } from 'firebase/auth'
import type { AppTheme } from '../theme/appTheme'

/** Contexto para rutas autenticadas (cuenta, vincular contraseña, etc.) */
export interface AccountOutletContext {
  user: User
  /** Nombre de usuario de la app (minúsculas, Firestore users.username) */
  publicDisplayName: string
  email: string
  setEmail: (v: string) => void
  password: string
  setPassword: (v: string) => void
  hasGoogleProvider: boolean
  hasPasswordProvider: boolean
  handleLinkPasswordToGoogleAccount: () => Promise<void>
  handleSignOut: () => Promise<void>
  authError: string | null
  info: string | null
  profileError: string | null
  appTheme: AppTheme
  setAppTheme: (theme: AppTheme) => void
}
