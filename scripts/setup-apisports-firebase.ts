/**
 * Configura APISPORTS_KEY en Firebase Functions y despliega las functions que la usan.
 *
 * Requisitos:
 * - APISPORTS_KEY en .env (https://www.api-football.com/)
 * - firebase login (npx firebase login)
 * - Plan Blaze en el proyecto .firebaserc
 *
 * Uso:
 *   npm run setup:apisports-firebase
 *   npm run setup:apisports-firebase -- --link   # además ejecuta link:api-sports si hay ADC
 */
import './seed-load-env.ts'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pingApiSports } from '../functions/lib/apiSports/linkFixtures.js'

const root = resolve(process.cwd())
const apiKey = process.env.APISPORTS_KEY?.trim()
const runLink = process.argv.includes('--link')

function firebaseArgs(extra: string[]): string[] {
  const token = process.env.FIREBASE_TOKEN?.trim()
  return token ? [...extra, '--token', token] : extra
}

function runFirebase(args: string[], input?: string): number {
  const r = spawnSync('npx', ['firebase', ...firebaseArgs(args)], {
    cwd: root,
    stdio: input != null ? ['pipe', 'inherit', 'inherit'] : 'inherit',
    input,
    encoding: 'utf8',
  })
  if (r.error) {
    console.error(r.error.message)
    return 1
  }
  return r.status ?? 1
}

async function main(): Promise<void> {
  if (!apiKey) {
    console.error(
      '[setup:apisports-firebase] Falta APISPORTS_KEY en .env.\n' +
        '  1. Obtén la key en https://www.api-football.com/\n' +
        '  2. Añade APISPORTS_KEY=tu_key en .env (no la subas a git)\n' +
        '  3. Vuelve a ejecutar: npm run setup:apisports-firebase',
    )
    process.exit(1)
  }

  console.log('[setup:apisports-firebase] Proyecto:', process.env.FIREBASE_PROJECT_ID ?? '(firebase use)')

  try {
    const ok = await pingApiSports(apiKey)
    if (!ok) console.warn('[setup:apisports-firebase] ping API-Sports: sin fixtures (revisa plan/cuota).')
    else console.log('[setup:apisports-firebase] ping API-Sports: OK')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[setup:apisports-firebase] ping API-Sports falló:', msg)
    if (msg.includes('2022 to 2024') || msg.includes('Free plans')) {
      console.warn(
        '  El plan Free de API-Football no incluye season=2026. Necesitas plan de pago para link/sync en producción.',
      )
    }
  }

  console.log('[setup:apisports-firebase] Registrando secreto APISPORTS_KEY…')

  const setCode = runFirebase(['functions:secrets:set', 'APISPORTS_KEY'], `${apiKey}\n`)
  if (setCode !== 0) {
    console.error(
      '[setup:apisports-firebase] No se pudo crear el secreto.\n' +
        '  - Ejecuta: npx firebase login\n' +
        '  - O exporta FIREBASE_TOKEN (npx firebase login:ci) y vuelve a correr este script.',
    )
    process.exit(setCode)
  }

  console.log('[setup:apisports-firebase] Desplegando Cloud Functions…')
  const deployCode = runFirebase(['deploy', '--only', 'functions'])
  if (deployCode !== 0) {
    process.exit(deployCode)
  }

  console.log('[setup:apisports-firebase] OK: secreto + functions desplegadas.')

  if (runLink) {
    const creds = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
    if (!creds) {
      console.warn(
        '[setup:apisports-firebase] --link omitido: define GOOGLE_APPLICATION_CREDENTIALS en .env',
      )
      return
    }
    console.log('[setup:apisports-firebase] Enlazando fixtures (link:api-sports)…')
    const linkCode = spawnSync('npm', ['run', 'link:api-sports'], {
      cwd: root,
      stdio: 'inherit',
    }).status
    if (linkCode !== 0) process.exit(linkCode ?? 1)
  } else {
    console.log(
      '[setup:apisports-firebase] Siguiente paso: npm run link:api-sports (tras seed:group-matches)',
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
