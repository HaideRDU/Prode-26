import type { Firestore } from 'firebase-admin/firestore'
import { normalizePlayerName, playerRefFromDoc } from '../lib/playerKeyMatch'
import { mergeScorerEntries } from '../lib/scorerSync'
import type { MatchDoc, MatchScorerEntry, TeamPlayerDoc } from '../lib/types/predictions'
import { apiSportsGet } from './client'
import type { ApiSportsFixtureItem } from './types'

export interface ApiSportsFixtureEvent {
  time: { elapsed: number; extra: number | null }
  team: { id: number; name: string }
  player: { id: number; name: string }
  assist: { id: number | null; name: string | null }
  type: string
  detail: string
  comments: string | null
}

type ResolvedPlayer = { playerKey: string; rosterName?: string }

function lastNameToken(name: string): string | null {
  const n = normalizePlayerName(name)
  const parts = n.split(' ').filter(Boolean)
  return parts.length ? parts[parts.length - 1]! : null
}

async function findPlayerByApiSportsId(
  db: Firestore,
  teamAId: string,
  teamBId: string,
  apiSportsPlayerId: number,
): Promise<ResolvedPlayer | null> {
  for (const teamId of [teamAId, teamBId]) {
    const snap = await db
      .collection('teams')
      .doc(teamId)
      .collection('players')
      .where('apiSportsPlayerId', '==', apiSportsPlayerId)
      .limit(1)
      .get()
    if (!snap.empty) {
      const doc = snap.docs[0]!
      const ref = playerRefFromDoc(doc.id, doc.data() as TeamPlayerDoc)
      return { playerKey: ref.playerKey, rosterName: ref.name }
    }
  }
  return null
}

async function findPlayerByName(
  db: Firestore,
  teamAId: string,
  teamBId: string,
  apiName: string,
): Promise<ResolvedPlayer | null> {
  const target = normalizePlayerName(apiName)
  if (!target) return null
  const targetLast = lastNameToken(apiName)
  let lastNameMatches: ResolvedPlayer[] = []

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

async function resolveApiSportsPlayer(
  db: Firestore,
  teamAId: string,
  teamBId: string,
  apiSportsPlayerId: number,
  apiName: string,
  cache: Map<number, ResolvedPlayer>,
): Promise<ResolvedPlayer> {
  const cached = cache.get(apiSportsPlayerId)
  if (cached) return cached

  const byId = await findPlayerByApiSportsId(db, teamAId, teamBId, apiSportsPlayerId)
  if (byId) {
    cache.set(apiSportsPlayerId, byId)
    return byId
  }

  const byName = await findPlayerByName(db, teamAId, teamBId, apiName)
  if (byName) {
    cache.set(apiSportsPlayerId, byName)
    return byName
  }

  const fallback = {
    playerKey: String(apiSportsPlayerId),
    rosterName: apiName.trim() || undefined,
  }
  cache.set(apiSportsPlayerId, fallback)
  return fallback
}

function isPenaltyShootoutGoal(detail: string): boolean {
  const d = detail.toLowerCase()
  return d.includes('shootout')
}

function isCountableApiGoal(event: ApiSportsFixtureEvent): boolean {
  if (event.type !== 'Goal') return false
  if (!event.player?.id) return false
  if (isPenaltyShootoutGoal(event.detail)) return false
  return true
}

export async function fetchScorersFromApiSports(
  db: Firestore,
  match: Pick<MatchDoc, 'teamAId' | 'teamBId' | 'teamHomeId' | 'teamAwayId'>,
  fixtureId: number,
  apiKey: string,
): Promise<MatchScorerEntry[]> {
  const teamAId = match.teamAId ?? match.teamHomeId
  const teamBId = match.teamBId ?? match.teamAwayId
  if (!teamAId || !teamBId) return []

  const [eventsJson, fixtureJson] = await Promise.all([
    apiSportsGet<ApiSportsFixtureEvent>(apiKey, '/fixtures/events', { fixture: fixtureId }),
    apiSportsGet<ApiSportsFixtureItem>(apiKey, '/fixtures', { id: fixtureId }),
  ])

  const events = eventsJson.response ?? []
  const fixture = fixtureJson.response?.[0]
  const homeTeamId = fixture?.teams.home.id

  const scorers: MatchScorerEntry[] = []
  const cache = new Map<number, ResolvedPlayer>()

  for (const ev of events) {
    if (!isCountableApiGoal(ev)) continue
    const detail = ev.detail.toLowerCase()
    const isPenalty = detail.includes('penalty') && !isPenaltyShootoutGoal(ev.detail)
    const teamSide =
      homeTeamId != null && ev.team.id === homeTeamId
        ? 'teamA'
        : homeTeamId != null
          ? 'teamB'
          : undefined

    const { playerKey, rosterName } = await resolveApiSportsPlayer(
      db,
      teamAId,
      teamBId,
      ev.player.id,
      ev.player.name,
      cache,
    )

    const minute = ev.time.elapsed + (ev.time.extra ?? 0)
    const displayName = rosterName || ev.player.name || undefined

    scorers.push({
      playerKey,
      goals: 1,
      ...(displayName ? { playerName: displayName } : {}),
      ...(minute > 0 ? { minute } : {}),
      ...(teamSide ? { teamSide } : {}),
      ...(isPenalty ? { includesPenalties: true } : {}),
    })
  }

  scorers.sort((a, b) => {
    const ma = a.minute ?? 9999
    const mb = b.minute ?? 9999
    if (ma !== mb) return ma - mb
    return a.playerKey.localeCompare(b.playerKey)
  })

  return scorers
}

/** Combina timeline TSDB con eventos API-Sports (unión deduplicada de ambas fuentes). */
export function preferCompleteScorers(
  timelineScorers: MatchScorerEntry[],
  apiScorers: MatchScorerEntry[],
): MatchScorerEntry[] {
  if (apiScorers.length === 0) return timelineScorers
  if (timelineScorers.length === 0) return apiScorers
  return mergeScorerEntries(timelineScorers, apiScorers)
}
