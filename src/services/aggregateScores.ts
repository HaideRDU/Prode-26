/**
 * Agrega puntos por usuario a partir de datos ya cargados (útil en Cloud Functions y tests).
 */
import type {
  MatchDoc,
  MatchPredictionPayload,
  PlayerPerMatchPayload,
  PredictionDoc,
  TournamentPredictionPayload,
  TournamentResultDoc,
} from '../types/predictions'
import { getPredictedKoLineupForMatch } from '../domain/koPredictedLineup'
import {
  extractGroupAndKoPredMaps,
  officialTeamsByAdvancementRound,
  predictedTeamsByAdvancementRound,
  scoreBracketAdvancement,
} from '../domain/bracketAdvancement'
import {
  totalPointsFromParts,
  type MatchScoreInput,
  type PlayerPerMatchScoreInput,
  type TournamentScoreInput,
} from './scoring'

function isMatchPayload(p: unknown): p is MatchPredictionPayload {
  return (
    typeof p === 'object' &&
    p !== null &&
    (('goalsTeamA' in p && typeof (p as MatchPredictionPayload).goalsTeamA === 'number') ||
      ('goalsHome' in p && typeof (p as MatchPredictionPayload).goalsHome === 'number')) &&
    (('goalsTeamB' in p && typeof (p as MatchPredictionPayload).goalsTeamB === 'number') ||
      ('goalsAway' in p && typeof (p as MatchPredictionPayload).goalsAway === 'number'))
  )
}

function isTournamentPayload(p: unknown): p is TournamentPredictionPayload {
  return typeof p === 'object' && p !== null && 'kind' in p
}

function isPlayerPerMatchPayload(p: unknown): p is PlayerPerMatchPayload {
  return (
    typeof p === 'object' &&
    p !== null &&
    (p as PlayerPerMatchPayload).kind === 'player_match_pick' &&
    typeof (p as PlayerPerMatchPayload).playerKey === 'string'
  )
}

type ScoreRow = {
  points: number
  breakdown: {
    matchPoints: number
    tournamentPoints: number
    advancementPoints: number
    specialsPoints: number
    playerPickPoints: number
  }
  tieBreak: {
    exactScoreHits: number
    specialQuestionHits: number
    championHit: boolean
  }
}

/** Calcula puntos totales por userId para una sala */
export function computeScoresForRoom(
  predictions: PredictionDoc[],
  matchesById: Map<string, MatchDoc>,
  tournamentResultsByQuestionId: Map<string, TournamentResultDoc>,
  enabledQuestionIds?: ReadonlySet<string> | null,
): Map<string, ScoreRow> {
  const predsByUser = new Map<string, PredictionDoc[]>()
  for (const pr of predictions) {
    if (!predsByUser.has(pr.userId)) predsByUser.set(pr.userId, [])
    predsByUser.get(pr.userId)!.push(pr)
  }

  const byUser = new Map<
    string,
    {
      matchParts: MatchScoreInput[]
      tournamentParts: TournamentScoreInput[]
      playerPickParts: PlayerPerMatchScoreInput[]
    }
  >()

  for (const pr of predictions) {
    if (!byUser.has(pr.userId)) {
      byUser.set(pr.userId, { matchParts: [], tournamentParts: [], playerPickParts: [] })
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
    } else if (pr.scope === 'player_per_match' && pr.matchId) {
      const m = matchesById.get(pr.matchId)
      if (!m || !isPlayerPerMatchPayload(pr.payload)) continue
      bucket.playerPickParts.push({
        matchId: pr.matchId,
        match: m,
        playerKey: pr.payload.playerKey,
      })
    }
  }

  for (const [uid, bucket] of byUser.entries()) {
    const userPreds = predsByUser.get(uid) ?? []
    bucket.matchParts = bucket.matchParts.map((mp) => {
      if (mp.match.phase !== 'knockout') return mp
      const lineup = getPredictedKoLineupForMatch(userPreds, mp.matchId)
      return { ...mp, predictedLineup: lineup }
    })
  }

  const officialByRound = officialTeamsByAdvancementRound(matchesById)

  const out = new Map<string, ScoreRow>()
  for (const [uid, parts] of byUser) {
    const userPreds = predsByUser.get(uid) ?? []
    const { groupPredByMatchId, koPredByMatchId } = extractGroupAndKoPredMaps(userPreds)
    const predictedByRound = predictedTeamsByAdvancementRound(groupPredByMatchId, koPredByMatchId)
    const bracketAdvancementPoints = scoreBracketAdvancement(predictedByRound, officialByRound)

    const {
      total,
      matchPoints,
      tournamentPoints,
      advancementPoints,
      specialsPoints,
      playerPickPoints,
      tieBreak,
    } = totalPointsFromParts(
      parts.matchParts,
      parts.tournamentParts,
      parts.playerPickParts,
      bracketAdvancementPoints,
    )
    out.set(uid, {
      points: total,
      breakdown: {
        matchPoints,
        tournamentPoints,
        advancementPoints,
        specialsPoints,
        playerPickPoints,
      },
      tieBreak,
    })
  }
  return out
}

/** Asigna rank 1..N por puntos descendente; empates = mismo rank (estilo competición) */
export function assignRanks(scores: Map<string, ScoreRow>): Map<
  string,
  {
    rank: number
    points: number
    breakdown: ScoreRow['breakdown']
    tieBreak: ScoreRow['tieBreak']
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
      breakdown: ScoreRow['breakdown']
      tieBreak: ScoreRow['tieBreak']
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
