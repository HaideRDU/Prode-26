import {
  eventsLastForTeam,
  eventsNextForTeam,
  lookupEventLineup,
} from './client'
import { ROSTER_SYNC_DELAY_MS } from './constants'
import { expectedTeamNamesForIso3 } from './rosterPlayers'
import type { TsdbEventItem, TsdbLineupItem, TsdbPlayerItem } from './types'

export type RosterFetchSource = 'primary' | 'lineup'

export interface RosterFromLineupsResult {
  players: TsdbPlayerItem[]
  eventIds: string[]
  lineupPlayerCount: number
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function isHomeSideForTeam(event: TsdbEventItem, tsdbTeamId: string): boolean | null {
  if (event.idHomeTeam === tsdbTeamId) return true
  if (event.idAwayTeam === tsdbTeamId) return false
  return null
}

function lineupRowForTeamSide(row: TsdbLineupItem, isHome: boolean): boolean {
  const side = (row.strHome ?? '').trim().toLowerCase()
  if (side === 'yes') return isHome
  if (side === 'no') return !isHome
  return false
}

function lineupRowToPlayer(
  row: TsdbLineupItem,
  nationalTeamLabel: string,
  tsdbTeamId: string,
): TsdbPlayerItem {
  return {
    idPlayer: row.idPlayer,
    strPlayer: row.strPlayer,
    strPosition: row.strPosition ?? undefined,
    strNumber: row.intSquadNumber ?? undefined,
    strThumb: row.strThumb ?? undefined,
    strCutout: row.strCutout ?? undefined,
    strTeam: nationalTeamLabel,
    idTeam: tsdbTeamId,
    strSport: 'Soccer',
  }
}

/**
 * Agrega jugadores desde alineaciones de eventsnext + eventslast (Free: 1 evento cada uno).
 * Solo incluye filas del lado local/visitante que corresponde a idTeam.
 */
export async function fetchRosterFromLineups(
  apiKey: string,
  tsdbTeamId: string,
  iso3: string,
): Promise<RosterFromLineupsResult> {
  const nationalLabel = expectedTeamNamesForIso3(iso3)[0] ?? iso3
  const next = await eventsNextForTeam(apiKey, tsdbTeamId)
  await sleep(ROSTER_SYNC_DELAY_MS)
  const last = await eventsLastForTeam(apiKey, tsdbTeamId)

  const eventById = new Map<string, TsdbEventItem>()
  for (const ev of [...next, ...last]) {
    if (ev?.idEvent) eventById.set(ev.idEvent, ev)
  }

  const byPlayerId = new Map<string, TsdbPlayerItem>()
  const eventIds: string[] = []

  for (const event of eventById.values()) {
    const isHome = isHomeSideForTeam(event, tsdbTeamId)
    if (isHome == null) continue

    await sleep(ROSTER_SYNC_DELAY_MS)
    const rows = await lookupEventLineup(apiKey, event.idEvent)
    if (rows.length === 0) continue

    eventIds.push(event.idEvent)
    for (const row of rows) {
      if (!row.idPlayer || !row.strPlayer?.trim()) continue
      if (!lineupRowForTeamSide(row, isHome)) continue
      if (!byPlayerId.has(row.idPlayer)) {
        byPlayerId.set(row.idPlayer, lineupRowToPlayer(row, nationalLabel, tsdbTeamId))
      }
    }
  }

  const players = [...byPlayerId.values()]
  return {
    players,
    eventIds,
    lineupPlayerCount: players.length,
  }
}

export const ROSTER_WEB_VS_API_MESSAGE =
  'Plantel visible en thesportsdb.com pero no disponible en API V1 Free (lookup_all_players solo equipo primario). Reintentar tras publicar alineación o valorar Premium para list/players.'
