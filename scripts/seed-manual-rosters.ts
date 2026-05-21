import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import './seed-load-env.ts'
import { getApp, initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { WC2026_TEAMS_BY_GROUP } from '../src/data/wc2026/teamsByGroup.ts'
import type { PaniniRostersFile } from '../src/data/wc2026/paniniRosterTypes.ts'
import { syncPaniniRosters } from '../functions/lib/panini/syncRosters.js'
import { parseTeamArg } from './parse-team-arg.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const ROSTERS_PATH = join(ROOT, 'src/data/wc2026/manualRosters.json')

const dryRun = process.argv.includes('--dry-run')
const teamFilter = parseTeamArg()

const file = JSON.parse(readFileSync(ROSTERS_PATH, 'utf8')) as PaniniRostersFile
const teams = teamFilter
  ? WC2026_TEAMS_BY_GROUP.filter((t) => t.teamId === teamFilter)
  : WC2026_TEAMS_BY_GROUP

if (teamFilter && teams.length === 0) {
  console.error(`[seed:manual-rosters] Equipo desconocido: ${teamFilter}`)
  process.exit(1)
}

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.VITE_FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT

if (!dryRun) {
  initializeApp({
    credential: applicationDefault(),
    ...(projectId ? { projectId } : {}),
  })
}

async function main(): Promise<void> {
  const label = dryRun ? 'check:manual-rosters' : 'seed:manual-rosters'
  console.log(`[${label}] JSON: ${ROSTERS_PATH} (${file.version})`)
  console.log(
    `[${label}] equipos:`,
    teams.map((t) => t.teamId).join(', '),
  )

  const db = dryRun ? null! : getFirestore()
  if (!dryRun) {
    console.log(`[${label}] projectId:`, getApp().options.projectId ?? projectId)
  }

  const result = await syncPaniniRosters(db, file, teams, { dryRun, rosterSource: 'manual' })

  if (result.syncedTeams.length > 0) {
    console.log(dryRun ? '\n=== Listos para importar ===' : '\n=== Importados ===')
    for (const t of result.syncedTeams) {
      console.log(
        `  ${dryRun ? '○' : '✓'} ${t.teamId}  ${t.nameEs.padEnd(22)}  ${t.playerCount} jugadores`,
      )
    }
  }

  if (result.skippedTeams.length > 0) {
    console.log('\n=== Omitidos ===')
    for (const t of result.skippedTeams) {
      console.log(`  − ${t.teamId}  ${t.nameEs.padEnd(22)}  ${t.playerCount} — ${t.reason}`)
    }
  }

  console.log('\nResumen:', {
    synced: result.synced,
    skipped: result.skipped,
    deletedPlayers: result.deletedPlayers,
    errors: result.errors.length,
  })

  if (result.errors.length > 0) {
    console.log('Errores:', result.errors)
    process.exitCode = 1
  }

  if (dryRun && result.syncedTeams.length > 0 && teamFilter) {
    console.log(`\nImportar: npm run seed:manual-rosters -- --team=${teamFilter}`)
  }

  if (!dryRun) {
    await getFirestore().terminate()
  }
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e)
  if (msg.includes('default credentials')) {
    console.error(
      '[seed:manual-rosters] Sin credenciales Firebase Admin. Ejecuta: gcloud auth application-default login',
    )
  } else {
    console.error('[seed:manual-rosters] ERROR:', e)
  }
  process.exit(1)
})
