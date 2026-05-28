import type { MatchPredictionPayload } from './types/predictions'

export type PenaltiesWinnerFlags = {
  wentToPenalties: boolean | null
  penaltiesWinnerTeamA: boolean | null
  penaltiesWinnerTeamB: boolean | null
}

export function penaltiesWinnerFlagsForTeamA(winnerIsTeamA: boolean): {
  penaltiesWinnerTeamA: boolean
  penaltiesWinnerTeamB: boolean
} {
  return {
    penaltiesWinnerTeamA: winnerIsTeamA,
    penaltiesWinnerTeamB: !winnerIsTeamA,
  }
}

export function penaltiesWinnerIsTeamAFromPayload(
  payload: Pick<
    MatchPredictionPayload,
    | 'wentToPenalties'
    | 'penaltiesWinnerTeamA'
    | 'penaltiesWinnerTeamB'
    | 'penaltiesWinnerHome'
    | 'penaltiesWinnerAway'
  >,
): boolean | null {
  if (payload.wentToPenalties !== true) return null
  if (payload.penaltiesWinnerTeamA !== undefined && payload.penaltiesWinnerTeamA !== null) {
    return payload.penaltiesWinnerTeamA
  }
  if (payload.penaltiesWinnerTeamB !== undefined && payload.penaltiesWinnerTeamB !== null) {
    return !payload.penaltiesWinnerTeamB
  }
  if (payload.penaltiesWinnerHome !== undefined && payload.penaltiesWinnerHome !== null) {
    return payload.penaltiesWinnerHome
  }
  if (payload.penaltiesWinnerAway !== undefined && payload.penaltiesWinnerAway !== null) {
    return !payload.penaltiesWinnerAway
  }
  return null
}

export function penaltiesWinnerFlagsFromPayload(
  payload: Pick<
    MatchPredictionPayload,
    | 'wentToPenalties'
    | 'penaltiesWinnerTeamA'
    | 'penaltiesWinnerTeamB'
    | 'penaltiesWinnerHome'
    | 'penaltiesWinnerAway'
  >,
): PenaltiesWinnerFlags {
  if (payload.wentToPenalties !== true) {
    return {
      wentToPenalties: payload.wentToPenalties ?? null,
      penaltiesWinnerTeamA: null,
      penaltiesWinnerTeamB: null,
    }
  }
  const winnerIsTeamA = penaltiesWinnerIsTeamAFromPayload(payload)
  if (winnerIsTeamA === null) {
    return {
      wentToPenalties: true,
      penaltiesWinnerTeamA: null,
      penaltiesWinnerTeamB: null,
    }
  }
  return {
    wentToPenalties: true,
    ...penaltiesWinnerFlagsForTeamA(winnerIsTeamA),
  }
}
