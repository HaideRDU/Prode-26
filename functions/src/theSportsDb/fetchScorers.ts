import type { Firestore } from 'firebase-admin/firestore'
import { normalizePlayerName, playerRefFromDoc } from '../lib/playerKeyMatch'
import type { MatchDoc, MatchScorerEntry, TeamPlayerDoc } from '../lib/types/predictions'
import { TSDB_FREE_KEY } from './constants'
import { tsdbGetJson } from './client'
import type { TsdbTimelineItem, TsdbTimelineResponse } from './types'

function timelineOrEmpty(response: TsdbTimelineResponse): TsdbTimelineItem[] {
  const rows = response.timeline
  if (rows == null) return []
  return Array.isArray(rows) ? rows : [rows]
}

function isPenaltyShootoutGoal(row: TsdbTimelineItem): boolean {
  const period = (row.strPeriod ?? '').toLowerCase()
  if (period.includes('pen')) return true
  const detail = (row.strTimelineDetail ?? '').toLowerCase()
  return detail.includes('shootout')
}

function isCountableGoal(row: TsdbTimelineItem): boolean {
  if (row.strTimeline?.trim().toLowerCase() !== 'goal') return false
  if (!row.idPlayer?.trim()) return false
  return true
}

export interface ParsedGoalEvent {
  tsdbPlayerId: string
  playerName: string
  minute: number | null
  teamSide: 'teamA' | 'teamB'
  includesPenalties: boolean
}

/** Un evento por gol (no agregado), ordenado por minuto. */
export function parseTimelineGoals(rows: TsdbTimelineItem[]): ParsedGoalEvent[] {
  const goals: ParsedGoalEvent[] = []
  for (const row of rows) {
    if (!isCountableGoal(row)) continue
    const shootout = isPenaltyShootoutGoal(row)
    const rawMin = row.intTime != null && row.intTime !== '' ? parseInt(String(row.intTime), 10) : NaN
    const minute = Number.isFinite(rawMin) ? rawMin : null
    const teamSide = (row.strHome ?? '').trim().toLowerCase() === 'yes' ? 'teamA' : 'teamB'
    goals.push({
      tsdbPlayerId: row.idPlayer,
      playerName: row.strPlayer?.trim() ?? '',
      minute,
      teamSide,
      // Penal en juego normal cuenta como gol; solo se excluye si fue en tanda de penales (shootout).
      includesPenalties: shootout,
    })
  }
  goals.sort((a, b) => {
    const ma = a.minute ?? 9999
    const mb = b.minute ?? 9999
    if (ma !== mb) return ma - mb
    return a.tsdbPlayerId.localeCompare(b.tsdbPlayerId)
  })
  return goals
}

type ResolvedPlayer = { playerKey: string; rosterName?: string }

function lastNameToken(name: string): string | null {
  const n = normalizePlayerName(name)
  const parts = n.split(' ').filter(Boolean)
  return parts.length ? parts[parts.length - 1]! : null
}

async function findPlayerByNormalizedName(
  db: Firestore,
  teamAId: string,
  teamBId: string,
  timelineName: string,
): Promise<ResolvedPlayer | null> {
  const target = normalizePlayerName(timelineName)
  if (!target) return null
  const targetLast = lastNameToken(timelineName)
  const lastNameMatches: ResolvedPlayer[] = []

  for (const teamId of [teamAId, teamBId]) {
    const snap = await db.collection('teams').doc(teamId).collection('players').get()
    for (const doc of snap.docs) {
      const data = doc.data() as TeamPlayerDoc
      const name = data.name?.trim()
      if (!name) continue
      if (normalizePlayerName(name) === target) {
        const ref = playerRefFromDoc(doc.id, data)
        return { playerKey: ref.playerKey, rosterName: name }
      }
      if (targetLast && lastNameToken(name) === targetLast) {
        const ref = playerRefFromDoc(doc.id, data)
        lastNameMatches.push({ playerKey: ref.playerKey, rosterName: name })
      }
    }
  }

  if (lastNameMatches.length === 1) return lastNameMatches[0]!
  return null
}

/** Resuelve idPlayer de TSDB → playerKey de plantilla (Panini, doc id o nombre). */
export async function resolveTsdbPlayer(
  db: Firestore,
  teamAId: string,
  teamBId: string,
  tsdbPlayerId: string,
  timelineName: string,
  cache: Map<string, ResolvedPlayer>,
): Promise<ResolvedPlayer> {
  const cached = cache.get(tsdbPlayerId)
  if (cached) return cached

  for (const teamId of [teamAId, teamBId]) {
    const directRef = db.collection('teams').doc(teamId).collection('players').doc(tsdbPlayerId)
    const direct = await directRef.get()
    if (direct.exists) {
      const data = direct.data() as TeamPlayerDoc
      const ref = playerRefFromDoc(direct.id, data)
      const resolved = { playerKey: ref.playerKey, rosterName: ref.name }
      cache.set(tsdbPlayerId, resolved)
      return resolved
    }
  }
  for (const teamId of [teamAId, teamBId]) {
    const snap = await db
      .collection('teams')
      .doc(teamId)
      .collection('players')
      .where('theSportsDbPlayerId', '==', tsdbPlayerId)
      .limit(1)
      .get()
    if (!snap.empty) {
      const doc = snap.docs[0]
      const ref = playerRefFromDoc(doc.id, doc.data() as TeamPlayerDoc)
      const resolved = { playerKey: ref.playerKey, rosterName: ref.name }
      cache.set(tsdbPlayerId, resolved)
      return resolved
    }
  }

  const byName = await findPlayerByNormalizedName(db, teamAId, teamBId, timelineName)
  if (byName) {
    cache.set(tsdbPlayerId, byName)
    return byName
  }

  const fallback = {
    playerKey: tsdbPlayerId,
    rosterName: timelineName.trim() || undefined,
  }
  cache.set(tsdbPlayerId, fallback)
  return fallback
}

export async function fetchScorersFromTimeline(
  db: Firestore,
  match: Pick<MatchDoc, 'teamAId' | 'teamBId' | 'teamHomeId' | 'teamAwayId'>,
  eventId: string,
  apiKey = TSDB_FREE_KEY,
): Promise<MatchScorerEntry[]> {
  const teamAId = match.teamAId ?? match.teamHomeId
  const teamBId = match.teamBId ?? match.teamAwayId
  if (!teamAId || !teamBId) return []

  const json = await tsdbGetJson<TsdbTimelineResponse>(apiKey, 'lookuptimeline.php', { id: eventId })
  const rows = timelineOrEmpty(json)
  if (rows.length === 0) return []

  const parsed = parseTimelineGoals(rows)
  const scorers: MatchScorerEntry[] = []
  const cache = new Map<string, ResolvedPlayer>()

  for (const ev of parsed) {
    const { playerKey, rosterName } = await resolveTsdbPlayer(
      db,
      teamAId,
      teamBId,
      ev.tsdbPlayerId,
      ev.playerName,
      cache,
    )
    const displayName = rosterName || ev.playerName || undefined
    scorers.push({
      playerKey,
      theSportsDbPlayerId: ev.tsdbPlayerId,
      goals: 1,
      ...(displayName ? { playerName: displayName } : {}),
      ...(ev.minute != null ? { minute: ev.minute } : {}),
      teamSide: ev.teamSide,
      ...(ev.includesPenalties ? { includesPenalties: true } : {}),
    })
  }

  return scorers
}

export function scorersChanged(
  current: MatchDoc['scorers'] | undefined,
  next: MatchScorerEntry[],
): boolean {
  const a = current ?? []
  if (a.length !== next.length) return true
  const norm = (rows: MatchScorerEntry[]) =>
    [...rows]
      .map(
        (s) =>
          `${s.playerKey}:${s.goals}:${s.minute ?? ''}:${s.teamSide ?? ''}:${s.includesPenalties ? 1 : 0}`,
      )
      .sort()
      .join('|')
  return norm(a) !== norm(next)
}
