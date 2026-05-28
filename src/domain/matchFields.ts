import { GROUP_STAGE_SCHEDULE } from '../data/wc2026/groupStageSchedule'
import type { MatchDoc, MatchPredictionPayload } from '../types/predictions'
import { penaltiesWinnerIsTeamAFromPayload } from './matchPenalties'

const scheduleRowByMatchId = new Map(GROUP_STAGE_SCHEDULE.map((r) => [r.matchId, r]))

type MatchGoalsSource = Pick<MatchDoc, 'goalsTeamA' | 'goalsTeamB'>
type MatchTeamsSource = Pick<MatchDoc, 'teamAId' | 'teamBId'>
type PredictionGoalsSource = Pick<MatchPredictionPayload, 'goalsTeamA' | 'goalsTeamB'>

/** Goles oficiales del partido en formato Equipo A/B. */
export function matchGoalsTeamA(match: MatchGoalsSource): number | null {
  return match.goalsTeamA ?? null
}

export function matchGoalsTeamB(match: MatchGoalsSource): number | null {
  return match.goalsTeamB ?? null
}

export function matchTeamAId(match: MatchTeamsSource & { id?: string }): string | null {
  const fromDoc = match.teamAId
  if (fromDoc) return fromDoc
  if (match.id) return scheduleRowByMatchId.get(match.id)?.teamHomeId ?? null
  return null
}

export function matchTeamBId(match: MatchTeamsSource & { id?: string }): string | null {
  const fromDoc = match.teamBId
  if (fromDoc) return fromDoc
  if (match.id) return scheduleRowByMatchId.get(match.id)?.teamAwayId ?? null
  return null
}

export function predictionGoalsTeamA(prediction: PredictionGoalsSource): number {
  return prediction.goalsTeamA ?? 0
}

export function predictionGoalsTeamB(prediction: PredictionGoalsSource): number {
  return prediction.goalsTeamB ?? 0
}

/** Payload de predicción persistible: solo campos Equipo A/B. */
export function toTeamOnlyPredictionPayload(
  payload: MatchPredictionPayload,
): MatchPredictionPayload {
  const goalsTeamA = predictionGoalsTeamA(payload)
  const goalsTeamB = predictionGoalsTeamB(payload)
  const base: MatchPredictionPayload = {
    goalsTeamA,
    goalsTeamB,
  }
  if (payload.wentToPenalties === true) {
    const winnerIsTeamA = penaltiesWinnerIsTeamAFromPayload(payload)
    if (winnerIsTeamA !== null) {
      base.wentToPenalties = true
      base.penaltiesWinnerTeamA = winnerIsTeamA
      base.penaltiesWinnerTeamB = !winnerIsTeamA
    }
  }
  return base
}
