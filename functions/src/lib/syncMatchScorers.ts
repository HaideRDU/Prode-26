import type { Firestore } from 'firebase-admin/firestore'
import * as logger from 'firebase-functions/logger'
import { fetchScorersFromApiSports, preferCompleteScorers } from '../apiSports/fetchScorers'
import { TSDB_FREE_KEY } from '../theSportsDb/constants'
import { fetchScorersFromTimeline } from '../theSportsDb/fetchScorers'
import { tsdbGetJson } from '../theSportsDb/client'
import type { TsdbTimelineItem, TsdbTimelineResponse } from '../theSportsDb/types'
import {
  countNonPenaltyScorerGoals,
  scorersIncompleteForScore,
} from './scorerSync'
import type { MatchDoc, MatchScorerEntry } from './types/predictions'

function timelineOrEmpty(response: TsdbTimelineResponse): TsdbTimelineItem[] {
  const rows = response.timeline
  if (rows == null) return []
  return Array.isArray(rows) ? rows : [rows]
}

/** idAPIfootball en timeline TSDB → fixture id en API-Sports. */
export async function resolveApiSportsFixtureId(
  match: MatchDoc,
  tsdbEventId: string,
  tsdbApiKey = TSDB_FREE_KEY,
): Promise<number | null> {
  if (typeof match.apiSportsFixtureId === 'number' && match.apiSportsFixtureId > 0) {
    return match.apiSportsFixtureId
  }

  try {
    const json = await tsdbGetJson<TsdbTimelineResponse>(tsdbApiKey, 'lookuptimeline.php', {
      id: tsdbEventId,
    })
    for (const row of timelineOrEmpty(json)) {
      const raw = (row as TsdbTimelineItem & { idAPIfootball?: string }).idAPIfootball
      if (raw == null || raw === '' || raw === '0') continue
      const n = parseInt(String(raw), 10)
      if (Number.isFinite(n) && n > 0) return n
    }
  } catch (err) {
    logger.warn(`[scorers] resolveApiSportsFixtureId failed tsdbEventId=${tsdbEventId}`, err)
  }
  return null
}

export interface FetchMatchScorersOptions {
  tsdbApiKey?: string
  apiSportsKey?: string
  goalsTeamA?: number | null
  goalsTeamB?: number | null
}

/**
 * Goleadores: primero timeline TSDB (uno por gol); si faltan vs el marcador, complementa con API-Sports.
 */
export async function fetchMatchScorers(
  db: Firestore,
  match: MatchDoc,
  tsdbEventId: string,
  options: FetchMatchScorersOptions = {},
): Promise<MatchScorerEntry[]> {
  const tsdbApiKey = options.tsdbApiKey ?? TSDB_FREE_KEY
  const goalsTeamA = options.goalsTeamA ?? match.goalsTeamA ?? match.goalsHome ?? null
  const goalsTeamB = options.goalsTeamB ?? match.goalsTeamB ?? match.goalsAway ?? null

  let scorers: MatchScorerEntry[] = []
  try {
    scorers = await fetchScorersFromTimeline(db, match, tsdbEventId, tsdbApiKey)
  } catch (err) {
    logger.warn(`[scorers] timeline failed tsdbEventId=${tsdbEventId}`, err)
  }

  const incomplete = scorersIncompleteForScore(goalsTeamA, goalsTeamB, scorers)
  if (!incomplete && scorers.length > 0) return scorers

  const apiSportsKey = options.apiSportsKey?.trim()
  if (!apiSportsKey) return scorers

  const fixtureId = await resolveApiSportsFixtureId(match, tsdbEventId, tsdbApiKey)
  if (fixtureId == null) return scorers

  try {
    const apiScorers = await fetchScorersFromApiSports(db, match, fixtureId, apiSportsKey)
    if (apiScorers.length === 0) return scorers

    const merged = preferCompleteScorers(scorers, apiScorers)
    const stillIncomplete = scorersIncompleteForScore(goalsTeamA, goalsTeamB, merged)
    const apiHasMore = countNonPenaltyScorerGoals(apiScorers) > countNonPenaltyScorerGoals(scorers)

    if (apiHasMore || stillIncomplete) {
      logger.info(
        `[scorers] API-Sports fallback tsdbEventId=${tsdbEventId} fixture=${fixtureId} timeline=${scorers.length} api=${apiScorers.length} merged=${merged.length}`,
      )
      return merged
    }
  } catch (err) {
    logger.warn(`[scorers] API-Sports failed fixtureId=${fixtureId}`, err)
  }

  return scorers
}

export function matchNeedsScorerBackfill(match: MatchDoc): boolean {
  if (!match.theSportsDbEventId) return false
  if (match.status !== 'finished' && match.status !== 'live') return false
  return scorersIncompleteForScore(
    match.goalsTeamA ?? match.goalsHome,
    match.goalsTeamB ?? match.goalsAway,
    match.scorers,
  )
}
