/**
 * Comprueba que el projectId del cliente (VITE_FIREBASE_PROJECT_ID en .env)
 * coincida con el usado por los seeds (FIREBASE_PROJECT_ID o JSON de servicio).
 *
 * Uso: npm run verify:firebase-project
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function loadDotEnv(path: string): Record<string, string> {
  if (!existsSync(path)) return {}
  const raw = readFileSync(path, 'utf8')
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

function main(): void {
  const root = resolve(process.cwd())
  const envFile = resolve(root, '.env')
  const fileEnv = loadDotEnv(envFile)

  const viteId = process.env.VITE_FIREBASE_PROJECT_ID || fileEnv.VITE_FIREBASE_PROJECT_ID || ''
  const seedId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    fileEnv.FIREBASE_PROJECT_ID ||
    ''

  console.log('[verify:firebase-project] Raíz:', root)
  if (existsSync(envFile)) {
    console.log('[verify:firebase-project] Leyendo:', envFile)
  } else {
    console.warn('[verify:firebase-project] No hay .env; usando solo variables de entorno del sistema.')
  }

  console.log('[verify:firebase-project] VITE_FIREBASE_PROJECT_ID (app web):', viteId || '(vacío)')
  console.log('[verify:firebase-project] FIREBASE_PROJECT_ID / seed:', seedId || '(vacío — el seed puede tomar project_id del JSON de servicio)')

  if (viteId && seedId && viteId !== seedId) {
    console.error(
      '[verify:firebase-project] ERROR: Los projectId no coinciden. Unifica VITE_FIREBASE_PROJECT_ID y FIREBASE_PROJECT_ID (o usa un JSON de servicio del mismo proyecto).',
    )
    process.exit(1)
  }

  if (viteId && !seedId) {
    console.warn(
      '[verify:firebase-project] AVISO: Define FIREBASE_PROJECT_ID para el seed o asegúrate de que GOOGLE_APPLICATION_CREDENTIALS apunte a un JSON del proyecto',
      `"${viteId}".`,
    )
  }

  console.log('[verify:firebase-project] OK')
}

main()
