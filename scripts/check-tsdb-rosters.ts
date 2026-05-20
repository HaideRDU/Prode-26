/**
 * Revisa en TheSportsDB qué selecciones tienen plantel (>= MIN_ROSTER_SIZE jugadores).
 * No escribe en Firestore.
 */
import { WC2026_TEAMS_BY_GROUP } from '../src/data/wc2026/teamsByGroup.ts'
import { MIN_ROSTER_SIZE, ROSTER_SYNC_DELAY_MS, TSDB_FREE_KEY } from '../functions/lib/theSportsDb/constants.js'
import { lookupAllPlayers } from '../functions/lib/theSportsDb/client.js'
import { fetchRosterFromLineups } from '../functions/lib/theSportsDb/rosterFromLineups.js'
import { resolveTsdbTeamId } from '../functions/lib/theSportsDb/resolveTeamId.js'
import { filterRosterPlayers, rosterBelongsToTeam } from '../functions/lib/theSportsDb/rosterPlayers.js'
import { buildWc2026TeamIdMapLight } from '../functions/lib/theSportsDb/wc2026Events.js'
import { parseTeamArg } from './parse-team-arg.ts'

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function main(): Promise<void> {
  const teamFilter = parseTeamArg()
  const teams = teamFilter
    ? WC2026_TEAMS_BY_GROUP.filter((t) => t.teamId === teamFilter)
    : WC2026_TEAMS_BY_GROUP

  if (teamFilter && teams.length === 0) {
    console.error(`[check:tsdb-rosters] Equipo desconocido: ${teamFilter}`)
    process.exit(1)
  }

  let eventTeamIds = new Map<string, string>()
  if (!teamFilter) {
    console.log('[check:tsdb-rosters] Cargando idTeam (eventsseason + mapa estático)…')
    eventTeamIds = await buildWc2026TeamIdMapLight(TSDB_FREE_KEY)
    console.log(`[check:tsdb-rosters] ${eventTeamIds.size} selecciones con idTeam conocido\n`)
  } else {
    console.log(`[check:tsdb-rosters] Modo un equipo: ${teamFilter}\n`)
  }

  const withRoster: {
    teamId: string
    nameEs: string
    count: number
    tsdbTeamId: string
    source: string
    primary: number
    lineup: number
  }[] = []
  const withoutRoster: {
    teamId: string
    nameEs: string
    count: number
    raw: number
    primary: number
    lineup: number
    reason: string
    tsdbTeamId?: string
  }[] = []
  const failed: { teamId: string; nameEs: string; reason: string }[] = []

  for (let i = 0; i < teams.length; i++) {
    const row = teams[i]
    if (i > 0) await sleep(ROSTER_SYNC_DELAY_MS)

    try {
      const tsdbTeamId = resolveTsdbTeamId(row.teamId, eventTeamIds)
      if (!tsdbTeamId) {
        failed.push({ teamId: row.teamId, nameEs: row.nameEs, reason: 'sin idTeam en mapa' })
        continue
      }
      const raw = await lookupAllPlayers(TSDB_FREE_KEY, tsdbTeamId)
      const primaryOnly = filterRosterPlayers(raw)
      let players = primaryOnly
      let lineupCount = 0
      let source = 'primary'

      if (players.length < MIN_ROSTER_SIZE) {
        const lineupResult = await fetchRosterFromLineups(TSDB_FREE_KEY, tsdbTeamId, row.teamId)
        const fromLineup = filterRosterPlayers(lineupResult.players)
        lineupCount = fromLineup.length
        if (fromLineup.length > 0) {
          const byId = new Map<string, (typeof players)[0]>()
          for (const p of players) if (p.idPlayer) byId.set(p.idPlayer, p)
          for (const p of fromLineup) if (p.idPlayer) byId.set(p.idPlayer, p)
          players = [...byId.values()]
          source =
            primaryOnly.length > 0 && lineupCount > 0
              ? 'mixed'
              : lineupCount > 0
                ? 'lineup'
                : 'primary'
        }
      }

      const belongs =
        source === 'primary' ? rosterBelongsToTeam(players, row.teamId) : true

      if (players.length >= MIN_ROSTER_SIZE && belongs) {
        withRoster.push({
          teamId: row.teamId,
          nameEs: row.nameEs,
          count: players.length,
          tsdbTeamId,
          source,
          primary: primaryOnly.length,
          lineup: lineupCount,
        })
      } else {
        const reason =
          players.length < MIN_ROSTER_SIZE
            ? 'plantel_insuficiente_api'
            : 'plantel_no_coincide'
        withoutRoster.push({
          teamId: row.teamId,
          nameEs: row.nameEs,
          count: players.length,
          raw: raw.length,
          primary: primaryOnly.length,
          lineup: lineupCount,
          reason,
          tsdbTeamId,
        })
      }
    } catch (e) {
      failed.push({
        teamId: row.teamId,
        nameEs: row.nameEs,
        reason: e instanceof Error ? e.message : String(e),
      })
    }
  }

  console.log(
    `=== Listos para importar (>=${MIN_ROSTER_SIZE} jugadores; fuente primary/lineup/mixed) ===\n`,
  )
  for (const t of withRoster) {
    console.log(
      `  ${t.teamId}  ${t.nameEs.padEnd(22)}  ${t.count} jugadores  source=${t.source}  primary=${t.primary} lineup=${t.lineup}  (idTeam ${t.tsdbTeamId})`,
    )
  }
  console.log(`\nTotal: ${withRoster.length} equipos\n`)

  if (withoutRoster.length > 0) {
    console.log('=== No listos en API ===\n')
    for (const t of withoutRoster) {
      console.log(
        `  ${t.teamId}  ${t.nameEs.padEnd(22)}  ${t.count} jugadores (${t.raw} bruto, primary=${t.primary}, lineup=${t.lineup}) — ${t.reason}`,
      )
    }
    console.log(`\nTotal: ${withoutRoster.length} equipos\n`)
  }

  if (failed.length > 0) {
    console.log('=== Errores ===\n')
    for (const t of failed) {
      console.log(`  ${t.teamId}  ${t.nameEs}  — ${t.reason}`)
    }
  }

  if (withRoster.length > 0 && teamFilter) {
    console.log(`\nImportar: npm run seed:tsdb-rosters -- --team=${teamFilter}\n`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
