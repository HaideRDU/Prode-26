import './seed-load-env.ts'
import { getApp, initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { API_SPORTS_ROSTER_TARGETS } from '../functions/lib/apiSports/rosterTargets.js'
import { syncApiSportsRosters } from '../functions/lib/apiSports/syncRosters.js'
import { parseTeamArg } from './parse-team-arg.ts'

const dryRun = process.argv.includes('--dry-run')
const apiKey = process.env.APISPORTS_KEY?.trim()

if (!apiKey) {
  console.error('[seed:apisports-rosters] Falta APISPORTS_KEY en .env')
  process.exit(1)
}

const teamFilter = parseTeamArg()
const targets = teamFilter
  ? API_SPORTS_ROSTER_TARGETS.filter((t) => t.teamId === teamFilter)
  : API_SPORTS_ROSTER_TARGETS

if (teamFilter && targets.length === 0) {
  console.error(`[seed:apisports-rosters] Equipo no está en la lista de 6: ${teamFilter}`)
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
  const label = dryRun ? 'check:apisports-rosters' : 'seed:apisports-rosters'
  console.log(`[${label}] equipos: ${targets.map((t) => t.teamId).join(', ')}`)
  console.log(`[${label}] llamadas API estimadas: ${targets.length * 2} (search + squads por equipo)`)

  const db = dryRun ? null! : getFirestore()
  if (!dryRun) {
    console.log(`[${label}] projectId:`, getApp().options.projectId ?? projectId)
  }

  const result = await syncApiSportsRosters(db, targets, apiKey, { dryRun })

  console.log(`\n[${label}] Llamadas API usadas: ${result.apiCalls}`)

  if (result.syncedTeams.length > 0) {
    console.log(dryRun ? '\n=== Listos para importar ===' : '\n=== Importados ===')
    for (const t of result.syncedTeams) {
      console.log(
        `  ${dryRun ? '○' : '✓'} ${t.teamId}  ${t.nameEs.padEnd(20)}  ${t.playerCount} jugadores  (apiTeamId ${t.apiSportsTeamId})`,
      )
    }
  }

  if (result.skippedTeams.length > 0) {
    console.log('\n=== Omitidos ===')
    for (const t of result.skippedTeams) {
      console.log(`  − ${t.teamId}  ${t.nameEs.padEnd(20)}  ${t.playerCount} — ${t.reason}`)
    }
  }

  console.log('\nResumen:', {
    apiCalls: result.apiCalls,
    synced: result.synced,
    skipped: result.skipped,
    errors: result.errors.length,
  })

  if (result.errors.length > 0) {
    console.log('Errores:', result.errors)
    process.exitCode = 1
  }

  if (dryRun && result.syncedTeams.length > 0 && teamFilter) {
    console.log(`\nImportar: npm run seed:apisports-rosters -- --team=${teamFilter}`)
  }

  if (!dryRun) {
    await getFirestore().terminate()
  }
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e)
  if (msg.includes('default credentials')) {
    console.error(
      '[seed:apisports-rosters] Sin credenciales Firebase Admin. Ejecuta: gcloud auth application-default login',
    )
  } else {
    console.error('[seed:apisports-rosters] ERROR:', e)
  }
  process.exit(1)
})
