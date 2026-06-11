import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { OAuth2Client } from 'google-auth-library'
import { Firestore } from '@google-cloud/firestore'

const FIREBASE_CLIENT_ID =
  '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com'
const FIREBASE_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi'

function loadRefreshToken(): string {
  const cfgPath = join(homedir(), '.config/configstore/firebase-tools.json')
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8')) as {
    tokens?: { refresh_token?: string }
  }
  const refresh = cfg.tokens?.refresh_token
  if (!refresh) {
    throw new Error('Sin refresh_token de Firebase CLI. Ejecuta: npx firebase login')
  }
  return refresh
}

let cachedDb: Firestore | null = null

/** Firestore usando credenciales de `firebase login` (sin JSON de servicio). */
export function initFirebaseCliAdmin(projectId: string): { db: Firestore } {
  if (cachedDb) return { db: cachedDb }

  const authClient = new OAuth2Client(FIREBASE_CLIENT_ID, FIREBASE_CLIENT_SECRET)
  authClient.setCredentials({ refresh_token: loadRefreshToken() })

  cachedDb = new Firestore({
    projectId,
    authClient,
  })
  return { db: cachedDb }
}
