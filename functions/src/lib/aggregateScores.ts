import type {
  MatchDoc,
  MatchPredictionPayload,
  PredictionDoc,
  TournamentPredictionPayload,
  TournamentResultDoc,
} from './types/predictions'
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

export function computeScoresForRoom(
  predictions: PredictionDoc[],
  matchesById: Map<string, MatchDoc>,
  tournamentResultsByQuestionId: Map<string, TournamentResultDoc>,
): Map<string, { points: number; breakdown: { matchPoints: number; tournamentPoints: number } }> {
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
    { points: number; breakdown: { matchPoints: number; tournamentPoints: number } }
  >()
  for (const [uid, parts] of byUser) {
    const { total, matchPoints, tournamentPoints } = totalPointsFromParts(
      parts.matchParts,
      parts.tournamentParts,
    )
    out.set(uid, {
      points: total,
      breakdown: { matchPoints, tournamentPoints },
    })
  }
  return out
}

export function assignRanks(
  scores: Map<string, { points: number; breakdown: { matchPoints: number; tournamentPoints: number } }>,
): Map<string, { rank: number; points: number; breakdown: { matchPoints: number; tournamentPoints: number } }> {
  const sorted = [...scores.entries()].sort((a, b) => b[1].points - a[1].points)
  const result = new Map<
    string,
    { rank: number; points: number; breakdown: { matchPoints: number; tournamentPoints: number } }
  >()
  let rank = 0
  let lastPoints = Number.NaN
  for (let i = 0; i < sorted.length; i++) {
    const [uid, data] = sorted[i]
    if (data.points !== lastPoints) {
      rank = i + 1
      lastPoints = data.points
    }
    result.set(uid, { rank, points: data.points, breakdown: data.breakdown })
  }
  return result
}
