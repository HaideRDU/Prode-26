import './seed-load-env.ts'
import { getApp, initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { WC2026_TEAMS_BY_GROUP } from '../src/data/wc2026/teamsByGroup.ts'
import { syncRostersFromTsdb } from '../functions/lib/theSportsDb/syncRosters.js'
import { parseTeamArg } from './parse-team-arg.ts'

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.VITE_FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT

const teamFilter = parseTeamArg()
const teams = teamFilter
  ? WC2026_TEAMS_BY_GROUP.filter((t) => t.teamId === teamFilter)
  : WC2026_TEAMS_BY_GROUP

if (teamFilter && teams.length === 0) {
  console.error(`[seed:tsdb-rosters] Equipo desconocido: ${teamFilter}`)
  process.exit(1)
}

initializeApp({
  credential: applicationDefault(),
  ...(projectId ? { projectId } : {}),
})

const db = getFirestore()
console.log('[seed:tsdb-rosters] projectId:', getApp().options.projectId ?? projectId)
if (teamFilter) {
  console.log(`[seed:tsdb-rosters] Modo un equipo: ${teamFilter} (${teams[0]?.nameEs})`)
}

syncRostersFromTsdb(db, teams, undefined, {
  useStaticTeamIdsOnly: Boolean(teamFilter),
})
  .then((r) => {
    console.log('\n[seed:tsdb-rosters] Plantillas importadas a Firestore (teams/{id}/players/):')
    for (const t of r.syncedTeams) {
      console.log(`  ✓ ${t.teamId} ${t.nameEs} — ${t.playerCount} jugadores`)
    }
    if (r.skippedTeams.length > 0) {
      console.log('\n[seed:tsdb-rosters] No importados:')
      for (const t of r.skippedTeams) {
        console.log(`  − ${t.teamId} ${t.nameEs} — ${t.playerCount} jugadores (${t.reason ?? 'skip'})`)
      }
    }
    console.log('\n[seed:tsdb-rosters] Resumen:', {
      resolvedIds: r.resolvedIds,
      synced: r.synced,
      skipped: r.skipped,
      errors: r.errors.length,
    })
    if (r.errors.length > 0) {
      console.log('Errores:', r.errors)
      process.exitCode = 1
    }
  })
  .catch((e) => {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('default credentials')) {
      console.error(
        '[seed:tsdb-rosters] Sin credenciales Firebase Admin. Ejecuta: gcloud auth application-default login',
      )
    } else {
      console.error('[seed:tsdb-rosters] ERROR:', e)
    }
    process.exit(1)
  })
