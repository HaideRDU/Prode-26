import type { Firestore } from 'firebase-admin/firestore'
import * as logger from 'firebase-functions/logger'
import type { MatchDoc } from '../lib/types/predictions'
import { WC_LEAGUE_ID, WC_SEASON } from './constants'
import { apiSportsGet, fetchAllPages } from './client'
import type { ApiSportsFixtureItem, ApiSportsTeamItem } from './types'
import { iso3FromApiTeam } from './teamCodes'
import { kickoffMs } from './matchWindow'

const KICKOFF_TOLERANCE_MS = 3 * 60 * 60 * 1000

export async function buildApiTeamIdToIso3(apiKey: string): Promise<Map<number, string>> {
  const teams = await fetchAllPages<ApiSportsTeamItem>(apiKey, '/teams', {
    league: WC_LEAGUE_ID,
    season: WC_SEASON,
  })
  const map = new Map<number, string>()
  for (const row of teams) {
    const id = row.team?.id
    const iso = iso3FromApiTeam(id, row.team?.code)
    if (id && iso) map.set(id, iso)
  }
  return map
}

function matchHomeAwayIds(d: MatchDoc): { homeId: string | undefined; awayId: string | undefined } {
  return {
    homeId: d.teamHomeId ?? d.teamAId,
    awayId: d.teamAwayId ?? d.teamBId,
  }
}

function findFirestoreMatchId(
  matches: { id: string; data: MatchDoc }[],
  homeIso: string,
  awayIso: string,
  fixtureKickoffMs: number,
): string | null {
  const direct = findFirestoreMatchIdStrict(matches, homeIso, awayIso, fixtureKickoffMs)
  if (direct) return direct
  return findFirestoreMatchIdStrict(matches, awayIso, homeIso, fixtureKickoffMs)
}

function findFirestoreMatchIdStrict(
  matches: { id: string; data: MatchDoc }[],
  homeIso: string,
  awayIso: string,
  fixtureKickoffMs: number,
): string | null {
  let best: { id: string; delta: number } | null = null
  for (const m of matches) {
    const d = m.data
    const { homeId, awayId } = matchHomeAwayIds(d)
    if (homeId !== homeIso || awayId !== awayIso) continue
    const scheduled = kickoffMs(d.scheduledAt)
    if (scheduled == null) continue
    const delta = Math.abs(scheduled - fixtureKickoffMs)
    if (delta > KICKOFF_TOLERANCE_MS) continue
    if (!best || delta < best.delta) best = { id: m.id, delta }
  }
  return best?.id ?? null
}

export async function linkApiSportsFixtures(db: Firestore, apiKey: string): Promise<{ linked: number; skipped: number }> {
  const teamMap = await buildApiTeamIdToIso3(apiKey)
  const fixtures = await fetchAllPages<ApiSportsFixtureItem>(apiKey, '/fixtures', {
    league: WC_LEAGUE_ID,
    season: WC_SEASON,
  })

  const snap = await db.collection('matches').get()
  const firestoreMatches = snap.docs.map((d) => ({ id: d.id, data: d.data() as MatchDoc }))

  let linked = 0
  let skipped = 0
  const writer = db.bulkWriter()

  for (const item of fixtures) {
    const homeIso = teamMap.get(item.teams.home.id)
    const awayIso = teamMap.get(item.teams.away.id)
    if (!homeIso || !awayIso) {
      skipped += 1
      continue
    }

    const fixtureKickoffMs =
      item.fixture.timestamp != null
        ? item.fixture.timestamp * 1000
        : Date.parse(item.fixture.date)
    if (!Number.isFinite(fixtureKickoffMs)) {
      skipped += 1
      continue
    }

    const matchId = findFirestoreMatchId(firestoreMatches, homeIso, awayIso, fixtureKickoffMs)
    if (!matchId) {
      skipped += 1
      continue
    }

    const ref = db.collection('matches').doc(matchId)
    writer.set(
      ref,
      {
        apiSportsFixtureId: item.fixture.id,
      },
      { merge: true },
    )
    linked += 1
  }

  await writer.close()
  logger.info(`linkApiSportsFixtures: linked=${linked} skipped=${skipped} fixtures=${fixtures.length}`)
  return { linked, skipped }
}

/** Una sola petición de prueba de conectividad */
export async function pingApiSports(apiKey: string): Promise<boolean> {
  const json = await apiSportsGet<ApiSportsFixtureItem>(apiKey, '/fixtures', {
    league: WC_LEAGUE_ID,
    season: WC_SEASON,
    next: 1,
  })
  return Array.isArray(json.response)
}
