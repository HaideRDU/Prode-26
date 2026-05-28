import { FieldValue } from 'firebase-admin/firestore'
import { penaltiesWinnerFlagsFromPayload } from '../../src/domain/matchPenalties.ts'
import { predictionGoalsTeamA, predictionGoalsTeamB } from '../../src/domain/matchFields.ts'
import type { MatchPredictionPayload } from '../../src/types/predictions.ts'

const LEGACY_MATCH_FIELDS_DELETE = {
  goalsHome: FieldValue.delete(),
  goalsAway: FieldValue.delete(),
  penaltiesWinnerHome: FieldValue.delete(),
  penaltiesWinnerAway: FieldValue.delete(),
  teamHomeId: FieldValue.delete(),
  teamAwayId: FieldValue.delete(),
} as const

/** Cierra partido en Firestore usando solo Equipo A/B (borra alias home/away). */
export function finishedMatchUpdate(payload: MatchPredictionPayload): Record<string, unknown> {
  const goalsTeamA = predictionGoalsTeamA(payload)
  const goalsTeamB = predictionGoalsTeamB(payload)
  const pens = penaltiesWinnerFlagsFromPayload({
    ...payload,
    goalsTeamA,
    goalsTeamB,
  })
  return {
    status: 'finished',
    goalsTeamA,
    goalsTeamB,
    wentToPenalties: pens.wentToPenalties,
    penaltiesWinnerTeamA: pens.penaltiesWinnerTeamA,
    penaltiesWinnerTeamB: pens.penaltiesWinnerTeamB,
    finishedAt: FieldValue.serverTimestamp(),
    ...LEGACY_MATCH_FIELDS_DELETE,
  }
}

export function koMatchTeamsUpdate(teamAId: string, teamBId: string): Record<string, unknown> {
  return {
    teamAId,
    teamBId,
    ...LEGACY_MATCH_FIELDS_DELETE,
  }
}
