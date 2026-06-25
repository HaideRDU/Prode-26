import type { Firestore } from 'firebase-admin/firestore'
import * as logger from 'firebase-functions/logger'
import { fetchScorersFromApiSports, preferCompleteScorers } from '../apiSports/fetchScorers'
import { TSDB_FREE_KEY } from '../theSportsDb/constants'
import { fetchScorersFromTimeline } from '../theSportsDb/fetchScorers'
import { tsdbGetJson } from '../theSportsDb/client'
import type { TsdbTimelineItem, TsdbTimelineResponse } from '../theSportsDb/types'
import {
  countNonPenaltyScorerGoals,
  expectedGoalsFromScore,
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
 * Goleadores: TSDB timeline para actualización en vivo (sin costo).
 * Al finalizar el partido, se complementa una vez con API-Sports y se compara: si alguna
 * fuente trae datos que la otra no tiene, se toma la versión más completa (unión deduplicada).
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

  const expectedGoals = expectedGoalsFromScore(goalsTeamA, goalsTeamB)

  /**
   * Nunca regresar a una versión MENOS completa de los goleadores: si lo que ya está
   * guardado cubre más goles (p. ej. corrección manual o backfill previo de API-Sports)
   * y el candidato viene incompleto, conservar lo existente. Evita que el sync en vivo
   * pise data buena con la timeline incompleta de TSDB cuando API-Sports no responde.
   */
  const keepMoreComplete = (candidate: MatchScorerEntry[]): MatchScorerEntry[] => {
    if (match.status !== 'finished') return candidate
    const existing = match.scorers ?? []
    if (existing.length === 0) return candidate
    const candCount = countNonPenaltyScorerGoals(candidate)
    const existingCount = countNonPenaltyScorerGoals(existing)
    if (candCount < expectedGoals && existingCount > candCount && existingCount <= expectedGoals) {
      return existing
    }
    return candidate
  }

  let scorers: MatchScorerEntry[] = []
  try {
    scorers = await fetchScorersFromTimeline(db, match, tsdbEventId, tsdbApiKey)
  } catch (err) {
    logger.warn(`[scorers] timeline failed tsdbEventId=${tsdbEventId}`, err)
  }

  // API-Sports (cuota limitada en plan free) solo se consulta al finalizar el partido.
  if (match.status !== 'finished') return scorers

  const incomplete = scorersIncompleteForScore(goalsTeamA, goalsTeamB, scorers)
  if (!incomplete && scorers.length > 0) return keepMoreComplete(scorers)

  const apiSportsKey = options.apiSportsKey?.trim()
  if (!apiSportsKey) return keepMoreComplete(scorers)

  const fixtureId = await resolveApiSportsFixtureId(match, tsdbEventId, tsdbApiKey)
  if (fixtureId == null) return keepMoreComplete(scorers)

  try {
    const apiScorers = await fetchScorersFromApiSports(db, match, fixtureId, apiSportsKey)
    if (apiScorers.length === 0) return keepMoreComplete(scorers)

    const merged = preferCompleteScorers(scorers, apiScorers)
    if (merged.length !== scorers.length) {
      logger.info(
        `[scorers] API-Sports fallback tsdbEventId=${tsdbEventId} fixture=${fixtureId} timeline=${scorers.length} api=${apiScorers.length} merged=${merged.length}`,
      )
    }
    return keepMoreComplete(merged)
  } catch (err) {
    logger.warn(`[scorers] API-Sports failed fixtureId=${fixtureId}`, err)
  }

  return keepMoreComplete(scorers)
}

/** Backfill solo para partidos finalizados (API-Sports no se consulta mientras está en vivo). */
export function matchNeedsScorerBackfill(match: MatchDoc): boolean {
  if (!match.theSportsDbEventId) return false
  if (match.status !== 'finished') return false
  return scorersIncompleteForScore(
    match.goalsTeamA ?? match.goalsHome,
    match.goalsTeamB ?? match.goalsAway,
    match.scorers,
  )
}
