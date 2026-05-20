import type { Firestore } from 'firebase-admin/firestore'
import { FieldValue } from 'firebase-admin/firestore'
import * as logger from 'firebase-functions/logger'
import { MIN_ROSTER_SIZE, ROSTER_SYNC_DELAY_MS, TSDB_FREE_KEY } from './constants'
import { lookupAllPlayers } from './client'
import { resolveTsdbTeamId } from './resolveTeamId'
import {
  fetchRosterFromLineups,
  ROSTER_WEB_VS_API_MESSAGE,
  type RosterFetchSource,
} from './rosterFromLineups'
import { filterRosterPlayers, rosterBelongsToTeam } from './rosterPlayers'
import { buildWc2026TeamIdMapLight } from './wc2026Events'
import type { TsdbPlayerItem } from './types'
import type { TeamPlayerDoc } from '../lib/types/predictions'

export interface Wc2026TeamRow {
  teamId: string
  groupId: string
  nameEs: string
}

export interface SyncRostersOptions {
  /** Modo --team=ISO3: solo mapa estático, sin eventsseason (1 llamada API por equipo) */
  useStaticTeamIdsOnly?: boolean
}

export interface SyncRostersResult {
  resolvedIds: number
  synced: number
  skipped: number
  errors: string[]
  syncedTeams: {
    teamId: string
    nameEs: string
    playerCount: number
    rosterSource?: RosterFetchSource | 'mixed'
  }[]
  skippedTeams: {
    teamId: string
    nameEs: string
    playerCount: number
    reason?: string
    primaryCount?: number
    lineupCount?: number
  }[]
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms))
}

function mergePlayersById(
  primary: TsdbPlayerItem[],
  lineup: TsdbPlayerItem[],
): TsdbPlayerItem[] {
  const byId = new Map<string, TsdbPlayerItem>()
  for (const p of primary) {
    if (p.idPlayer) byId.set(p.idPlayer, p)
  }
  for (const p of lineup) {
    if (p.idPlayer) byId.set(p.idPlayer, p)
  }
  return [...byId.values()]
}

function rosterSourceLabel(
  primaryCount: number,
  lineupCount: number,
): RosterFetchSource | 'mixed' {
  if (lineupCount > 0 && primaryCount > 0) return 'mixed'
  if (lineupCount > 0) return 'lineup'
  return 'primary'
}

function mapPlayerToDoc(item: TsdbPlayerItem): TeamPlayerDoc {
  return {
    theSportsDbPlayerId: item.idPlayer,
    name: item.strPlayer?.trim() || 'Unknown',
    ...(item.strPosition ? { position: item.strPosition } : {}),
    ...(item.strNumber ? { number: item.strNumber } : {}),
    ...(item.strThumb ? { thumbUrl: item.strThumb } : {}),
    syncedAt: FieldValue.serverTimestamp(),
  }
}

/**
 * Sincroniza plantillas desde TheSportsDB (lookup_all_players) hacia
 * teams/{teamId}/players/{idPlayer}.
 */
export async function syncRostersFromTsdb(
  db: Firestore,
  teams: readonly Wc2026TeamRow[],
  apiKey = TSDB_FREE_KEY,
  options: SyncRostersOptions = {},
): Promise<SyncRostersResult> {
  const result: SyncRostersResult = {
    resolvedIds: 0,
    synced: 0,
    skipped: 0,
    errors: [],
    syncedTeams: [],
    skippedTeams: [],
  }

  const writer = db.bulkWriter()

  let eventTeamIds = new Map<string, string>()
  if (!options.useStaticTeamIdsOnly) {
    logger.info('[tsdb:roster] cargando idTeam (eventsseason + mapa estático)…')
    eventTeamIds = await buildWc2026TeamIdMapLight(apiKey)
    logger.info(`[tsdb:roster] idTeam desde eventos: ${eventTeamIds.size} selecciones`)
  } else {
    logger.info('[tsdb:roster] modo un equipo: solo mapa estático TSDB_ID_TO_ISO3')
  }

  for (let i = 0; i < teams.length; i++) {
    const row = teams[i]
    if (i > 0) await sleep(ROSTER_SYNC_DELAY_MS)

    try {
      const tsdbTeamId = resolveTsdbTeamId(row.teamId, eventTeamIds)
      if (!tsdbTeamId) {
        result.errors.push(`${row.teamId}: no se resolvió idTeam TSDB (falta en mapa)`)
        result.skipped += 1
        continue
      }
      result.resolvedIds += 1

      const teamRef = db.collection('teams').doc(row.teamId)
      const rawPlayers = await lookupAllPlayers(apiKey, tsdbTeamId)
      const primaryFiltered = filterRosterPlayers(rawPlayers)
      let players = primaryFiltered
      let lineupCount = 0
      let eventIdsFromLineup: string[] = []

      if (players.length < MIN_ROSTER_SIZE) {
        logger.info(
          `[tsdb:roster] ${row.teamId}: primary=${players.length} (< ${MIN_ROSTER_SIZE}), intentando alineaciones…`,
        )
        const lineupResult = await fetchRosterFromLineups(apiKey, tsdbTeamId, row.teamId)
        const lineupFiltered = filterRosterPlayers(lineupResult.players)
        lineupCount = lineupFiltered.length
        eventIdsFromLineup = lineupResult.eventIds
        players = mergePlayersById(primaryFiltered, lineupFiltered)
        if (lineupCount > 0) {
          logger.info(
            `[tsdb:roster] ${row.teamId}: lineup=${lineupCount} desde eventos [${eventIdsFromLineup.join(', ')}]`,
          )
        }
      }

      const source = rosterSourceLabel(primaryFiltered.length, lineupCount)

      if (players.length < MIN_ROSTER_SIZE) {
        logger.info(
          `[tsdb:roster] skip ${row.teamId}: ${players.length} jugadores (< ${MIN_ROSTER_SIZE}, raw=${rawPlayers.length}, lineup=${lineupCount})`,
        )
        if (rawPlayers.length > 0 && primaryFiltered.length < MIN_ROSTER_SIZE) {
          logger.warn(`[tsdb:roster] ${row.teamId}: ${ROSTER_WEB_VS_API_MESSAGE}`)
        }
        result.skipped += 1
        result.skippedTeams.push({
          teamId: row.teamId,
          nameEs: row.nameEs,
          playerCount: players.length,
          reason: 'plantel_insuficiente_api',
          primaryCount: primaryFiltered.length,
          lineupCount,
        })
        continue
      }

      if (source === 'primary' && !rosterBelongsToTeam(players, row.teamId)) {
        const sampleTeam = players[0]?.strTeam ?? '?'
        logger.warn(
          `[tsdb:roster] skip ${row.teamId}: plantel no coincide (muestra strTeam=${sampleTeam})`,
        )
        result.skipped += 1
        result.skippedTeams.push({
          teamId: row.teamId,
          nameEs: row.nameEs,
          playerCount: players.length,
          reason: 'plantel_no_coincide',
        })
        continue
      }

      writer.set(
        teamRef,
        {
          theSportsDbTeamId: tsdbTeamId,
          rosterSyncedAt: FieldValue.serverTimestamp(),
          rosterPlayerCount: players.length,
        },
        { merge: true },
      )

      for (const p of players) {
        if (!p.idPlayer) continue
        const playerRef = teamRef.collection('players').doc(p.idPlayer)
        writer.set(playerRef, mapPlayerToDoc(p), { merge: true })
      }
      result.synced += 1
      result.syncedTeams.push({
        teamId: row.teamId,
        nameEs: row.nameEs,
        playerCount: players.length,
        rosterSource: source,
      })
      logger.info(
        `[tsdb:roster] synced ${row.teamId}: ${players.length} jugadores (source=${source})`,
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      result.errors.push(`${row.teamId}: ${msg}`)
      logger.error(`[tsdb:roster] error ${row.teamId}`, e)
    }
  }

  await writer.close()
  logger.info('[tsdb:roster] done', result)
  return result
}
