import type { Firestore } from 'firebase-admin/firestore'
import { apiSportsGet } from './client'
import { MIN_API_ROSTER_SIZE, type ApiSportsRosterTarget } from './rosterTargets'

/** Free tier ~10 req/min — pausa entre cada llamada HTTP */
const ROSTER_API_DELAY_MS = 3500
import type {
  ApiSportsSquadItem,
  ApiSportsSquadPlayer,
  ApiSportsTeamItem,
} from './types'
import type { TeamPlayerDoc } from '../lib/types/predictions'

export interface SyncApiSportsRostersOptions {
  dryRun?: boolean
}

export interface SyncApiSportsRostersResult {
  apiCalls: number
  synced: number
  skipped: number
  errors: string[]
  syncedTeams: {
    teamId: string
    nameEs: string
    playerCount: number
    apiSportsTeamId: number
  }[]
  skippedTeams: {
    teamId: string
    nameEs: string
    playerCount: number
    reason: string
  }[]
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
}

function pickNationalTeam(
  rows: ApiSportsTeamItem[],
  searchName: string,
): ApiSportsTeamItem | null {
  const needle = normalizeName(searchName)
  const nationals = rows.filter((r) => r.team?.national === true)
  const pool = nationals.length > 0 ? nationals : rows

  let best: ApiSportsTeamItem | null = null
  let bestScore = -1
  for (const row of pool) {
    const name = normalizeName(row.team?.name ?? '')
    let score = 0
    if (name === needle) score = 100
    else if (name.includes(needle) || needle.includes(name)) score = 50
    else if (row.team?.national) score = 10
    if (score > bestScore) {
      bestScore = score
      best = row
    }
  }
  return best
}

export async function resolveApiTeamIdBySearch(
  apiKey: string,
  searchName: string,
): Promise<{ teamId: number; teamName: string; apiCalls: number }> {
  const json = await apiSportsGet<ApiSportsTeamItem>(apiKey, '/teams', { search: searchName })
  const rows = json.response ?? []
  const picked = pickNationalTeam(rows, searchName)
  if (!picked?.team?.id) {
    throw new Error(`No se encontró selección nacional para search="${searchName}" (${rows.length} resultados)`)
  }
  return {
    teamId: picked.team.id,
    teamName: picked.team.name,
    apiCalls: 1,
  }
}

export async function fetchTeamSquad(
  apiKey: string,
  apiTeamId: number,
): Promise<{ players: ApiSportsSquadPlayer[]; teamName: string; apiCalls: number }> {
  const json = await apiSportsGet<ApiSportsSquadItem>(apiKey, '/players/squads', { team: apiTeamId })
  const row = json.response?.[0]
  if (!row?.players?.length) {
    return { players: [], teamName: row?.team?.name ?? '', apiCalls: 1 }
  }
  return {
    players: row.players.filter((p) => p.id && p.name?.trim()),
    teamName: row.team?.name ?? '',
    apiCalls: 1,
  }
}

function mapPlayerToDoc(player: ApiSportsSquadPlayer, syncedAt: Date): TeamPlayerDoc {
  return {
    apiSportsPlayerId: player.id,
    name: player.name.trim(),
    ...(player.position ? { position: player.position } : {}),
    ...(player.number != null ? { number: String(player.number) } : {}),
    ...(player.photo ? { photoUrl: player.photo } : {}),
    syncedAt,
  }
}

export async function syncApiSportsRosters(
  db: Firestore,
  targets: readonly ApiSportsRosterTarget[],
  apiKey: string,
  options: SyncApiSportsRostersOptions = {},
): Promise<SyncApiSportsRostersResult> {
  const result: SyncApiSportsRostersResult = {
    apiCalls: 0,
    synced: 0,
    skipped: 0,
    errors: [],
    syncedTeams: [],
    skippedTeams: [],
  }

  for (let i = 0; i < targets.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, ROSTER_API_DELAY_MS))
    const target = targets[i]
    try {
      const resolved = await resolveApiTeamIdBySearch(apiKey, target.searchName)
      result.apiCalls += resolved.apiCalls

      await new Promise((r) => setTimeout(r, ROSTER_API_DELAY_MS))
      const squad = await fetchTeamSquad(apiKey, resolved.teamId)
      result.apiCalls += squad.apiCalls

      const players = squad.players
      if (players.length < MIN_API_ROSTER_SIZE) {
        result.skipped += 1
        result.skippedTeams.push({
          teamId: target.teamId,
          nameEs: target.nameEs,
          playerCount: players.length,
          reason: 'plantel_insuficiente_api',
        })
        continue
      }

      if (options.dryRun) {
        result.synced += 1
        result.syncedTeams.push({
          teamId: target.teamId,
          nameEs: target.nameEs,
          playerCount: players.length,
          apiSportsTeamId: resolved.teamId,
        })
        continue
      }

      const teamRef = db.collection('teams').doc(target.teamId)
      const syncedAt = new Date()
      const batch = db.batch()
      batch.set(
        teamRef,
        {
          apiSportsTeamId: resolved.teamId,
          rosterSyncedAt: syncedAt,
          rosterPlayerCount: players.length,
          rosterSource: 'apisports',
        },
        { merge: true },
      )

      for (const p of players) {
        const playerRef = teamRef.collection('players').doc(String(p.id))
        batch.set(playerRef, mapPlayerToDoc(p, syncedAt), { merge: true })
      }
      await batch.commit()

      result.synced += 1
      result.syncedTeams.push({
        teamId: target.teamId,
        nameEs: target.nameEs,
        playerCount: players.length,
        apiSportsTeamId: resolved.teamId,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      result.errors.push(`${target.teamId}: ${msg}`)
      result.skipped += 1
      result.skippedTeams.push({
        teamId: target.teamId,
        nameEs: target.nameEs,
        playerCount: 0,
        reason: msg,
      })
    }
  }

  return result
}
