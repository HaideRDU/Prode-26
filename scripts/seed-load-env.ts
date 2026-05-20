/**
 * Carga `.env` del repo para scripts de seed (Node no lo lee solo).
 * Rellena process.env solo si la variable aún no está definida.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const KEYS = [
  'FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_PROJECT_ID',
  'GOOGLE_CLOUD_PROJECT',
  'GCLOUD_PROJECT',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'APISPORTS_KEY',
] as const

function parseDotEnv(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    out[k] = v
  }
  return out
}

const envPath = resolve(process.cwd(), '.env')
if (existsSync(envPath)) {
  const parsed = parseDotEnv(readFileSync(envPath, 'utf8'))
  for (const k of KEYS) {
    if (!process.env[k] && parsed[k]) process.env[k] = parsed[k]
  }
}
