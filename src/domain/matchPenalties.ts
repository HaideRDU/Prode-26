/** Flags de penales: true = ganador, false = perdedor (solo Equipo A/B). */
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

/** Lee ganador en penales (solo TeamA/B). */
export function penaltiesWinnerIsTeamAFromPayload(payload: {
  wentToPenalties?: boolean | null
  penaltiesWinnerTeamA?: boolean | null
  penaltiesWinnerTeamB?: boolean | null
}): boolean | null {
  if (payload.wentToPenalties !== true) return null
  if (payload.penaltiesWinnerTeamA !== undefined && payload.penaltiesWinnerTeamA !== null) {
    return payload.penaltiesWinnerTeamA
  }
  if (payload.penaltiesWinnerTeamB !== undefined && payload.penaltiesWinnerTeamB !== null) {
    return !payload.penaltiesWinnerTeamB
  }
  return null
}

export function penaltiesWinnerFlagsFromPayload(payload: {
  wentToPenalties?: boolean | null
  penaltiesWinnerTeamA?: boolean | null
  penaltiesWinnerTeamB?: boolean | null
}): PenaltiesWinnerFlags {
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
