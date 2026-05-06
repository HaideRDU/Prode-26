/**
 * Agrega puntos por usuario a partir de datos ya cargados (útil en Cloud Functions y tests).
 */
import type {
  MatchDoc,
  MatchPredictionPayload,
  PredictionDoc,
  TournamentPredictionPayload,
  TournamentResultDoc,
} from '../types/predictions'
import { totalPointsFromParts, type MatchScoreInput, type TournamentScoreInput } from './scoring'

function isMatchPayload(p: unknown): p is MatchPredictionPayload {
  return (
    typeof p === 'object' &&
    p !== null &&
    'goalsHome' in p &&
    'goalsAway' in p &&
    typeof (p as MatchPredictionPayload).goalsHome === 'number'
  )
}

function isTournamentPayload(p: unknown): p is TournamentPredictionPayload {
  return typeof p === 'object' && p !== null && 'kind' in p
}

/** Calcula puntos totales por userId para una sala */
export function computeScoresForRoom(
  predictions: PredictionDoc[],
  matchesById: Map<string, MatchDoc>,
  tournamentResultsByQuestionId: Map<string, TournamentResultDoc>,
  enabledQuestionIds?: ReadonlySet<string> | null,
): Map<
  string,
  {
    points: number
    breakdown: {
      matchPoints: number
      tournamentPoints: number
      advancementPoints: number
      specialsPoints: number
    }
    tieBreak: {
      exactScoreHits: number
      specialQuestionHits: number
      championHit: boolean
    }
  }
> {
  const byUser = new Map<
    string,
    { matchParts: MatchScoreInput[]; tournamentParts: TournamentScoreInput[] }
  >()

  for (const pr of predictions) {
    if (!byUser.has(pr.userId)) {
      byUser.set(pr.userId, { matchParts: [], tournamentParts: [] })
    }
    const bucket = byUser.get(pr.userId)!
    if (pr.scope === 'match' && pr.matchId) {
      const m = matchesById.get(pr.matchId)
      if (!m || !isMatchPayload(pr.payload)) continue
      bucket.matchParts.push({
        matchId: pr.matchId,
        match: m,
        prediction: pr.payload,
      })
    } else if (pr.scope === 'tournament' && pr.questionId) {
      if (enabledQuestionIds && !enabledQuestionIds.has(pr.questionId)) continue
      const res = tournamentResultsByQuestionId.get(pr.questionId)
      const official = res?.resolved ? res.answer : null
      if (!isTournamentPayload(pr.payload)) continue
      bucket.tournamentParts.push({
        questionId: pr.questionId,
        officialAnswer: official,
        prediction: pr.payload,
      })
    }
  }

  const out = new Map<
    string,
    {
      points: number
      breakdown: {
        matchPoints: number
        tournamentPoints: number
        advancementPoints: number
        specialsPoints: number
      }
      tieBreak: {
        exactScoreHits: number
        specialQuestionHits: number
        championHit: boolean
      }
    }
  >()
  for (const [uid, parts] of byUser) {
    const {
      total,
      matchPoints,
      tournamentPoints,
      advancementPoints,
      specialsPoints,
      tieBreak,
    } = totalPointsFromParts(
      parts.matchParts,
      parts.tournamentParts,
    )
    out.set(uid, {
      points: total,
      breakdown: { matchPoints, tournamentPoints, advancementPoints, specialsPoints },
      tieBreak,
    })
  }
  return out
}

/** Asigna rank 1..N por puntos descendente; empates = mismo rank (estilo competición) */
export function assignRanks(
  scores: Map<
    string,
    {
      points: number
      breakdown: {
        matchPoints: number
        tournamentPoints: number
        advancementPoints: number
        specialsPoints: number
      }
      tieBreak: {
        exactScoreHits: number
        specialQuestionHits: number
        championHit: boolean
      }
    }
  >,
): Map<
  string,
  {
    rank: number
    points: number
    breakdown: {
      matchPoints: number
      tournamentPoints: number
      advancementPoints: number
      specialsPoints: number
    }
    tieBreak: {
      exactScoreHits: number
      specialQuestionHits: number
      championHit: boolean
    }
  }
> {
  const sorted = [...scores.entries()].sort((a, b) => {
    if (a[1].points !== b[1].points) return b[1].points - a[1].points
    if (a[1].tieBreak.exactScoreHits !== b[1].tieBreak.exactScoreHits) {
      return b[1].tieBreak.exactScoreHits - a[1].tieBreak.exactScoreHits
    }
    if (a[1].tieBreak.specialQuestionHits !== b[1].tieBreak.specialQuestionHits) {
      return b[1].tieBreak.specialQuestionHits - a[1].tieBreak.specialQuestionHits
    }
    if (a[1].tieBreak.championHit !== b[1].tieBreak.championHit) {
      return a[1].tieBreak.championHit ? -1 : 1
    }
    return a[0].localeCompare(b[0])
  })
  const result = new Map<
    string,
    {
      rank: number
      points: number
      breakdown: {
        matchPoints: number
        tournamentPoints: number
        advancementPoints: number
        specialsPoints: number
      }
      tieBreak: {
        exactScoreHits: number
        specialQuestionHits: number
        championHit: boolean
      }
    }
  >()
  let rank = 0
  let lastComparable = ''
  for (let i = 0; i < sorted.length; i++) {
    const [uid, data] = sorted[i]
    const comparable = `${data.points}|${data.tieBreak.exactScoreHits}|${data.tieBreak.specialQuestionHits}|${data.tieBreak.championHit ? 1 : 0}`
    if (comparable !== lastComparable) {
      rank = i + 1
      lastComparable = comparable
    }
    result.set(uid, { rank, points: data.points, breakdown: data.breakdown, tieBreak: data.tieBreak })
  }
  return result
}
