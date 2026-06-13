import type { MatchScorerEntry } from './types/predictions'

export function countNonPenaltyScorerGoals(scorers: MatchScorerEntry[] | undefined): number {
  return (scorers ?? [])
    .filter((s) => !s.includesPenalties)
    .reduce((sum, s) => sum + (typeof s.goals === 'number' && s.goals > 0 ? s.goals : 1), 0)
}

export function expectedGoalsFromScore(
  goalsTeamA: number | null | undefined,
  goalsTeamB: number | null | undefined,
): number {
  if (goalsTeamA == null || goalsTeamB == null) return 0
  if (goalsTeamA < 0 || goalsTeamB < 0) return 0
  return goalsTeamA + goalsTeamB
}

/** El marcador indica más goles de los que hay en scorers[] (p. ej. timeline TSDB incompleto). */
export function scorersIncompleteForScore(
  goalsTeamA: number | null | undefined,
  goalsTeamB: number | null | undefined,
  scorers: MatchScorerEntry[] | undefined,
): boolean {
  const expected = expectedGoalsFromScore(goalsTeamA, goalsTeamB)
  if (expected <= 0) return false
  return countNonPenaltyScorerGoals(scorers) < expected
}

/** Goles del mismo jugador/equipo reportados por TSDB y API-Sports con minutos distintos cuentan como el mismo gol. */
const MERGE_MINUTE_TOLERANCE = 10

/** Preferir entrada con más metadatos (p. ej. theSportsDbPlayerId desde timeline). */
function scorerEntryScore(x: MatchScorerEntry): number {
  return (x.theSportsDbPlayerId ? 2 : 0) + (x.playerName ? 1 : 0)
}

export function mergeScorerEntries(
  primary: MatchScorerEntry[],
  secondary: MatchScorerEntry[],
): MatchScorerEntry[] {
  const groupKey = (s: MatchScorerEntry) =>
    `${s.playerKey}|${s.teamSide ?? ''}|${s.includesPenalties ? 1 : 0}`

  const result = [...primary]
  for (const s of secondary) {
    const sKey = groupKey(s)
    const dupIndex = result.findIndex((e) => {
      if (groupKey(e) !== sKey) return false
      if (e.minute == null || s.minute == null) return e.minute === s.minute
      return Math.abs(e.minute - s.minute) <= MERGE_MINUTE_TOLERANCE
    })
    if (dupIndex === -1) {
      result.push(s)
      continue
    }
    if (scorerEntryScore(s) > scorerEntryScore(result[dupIndex]!)) result[dupIndex] = s
  }

  return result.sort((a, b) => {
    const ma = a.minute ?? 9999
    const mb = b.minute ?? 9999
    if (ma !== mb) return ma - mb
    return a.playerKey.localeCompare(b.playerKey)
  })
}
