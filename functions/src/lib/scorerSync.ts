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

/** Goles del mismo jugador/minuto de fuentes distintas cuentan como un solo gol (ignora teamSide erróneo de TSDB). */
const MERGE_MINUTE_TOLERANCE = 10

function mergeGroupKey(s: MatchScorerEntry): string {
  return `${s.playerKey}|${s.minute ?? 'x'}|${s.includesPenalties ? 1 : 0}|${s.ownGoal ? 1 : 0}`
}

/** Preferir entrada con más metadatos (p. ej. theSportsDbPlayerId desde timeline). */
function scorerEntryScore(x: MatchScorerEntry): number {
  return (x.theSportsDbPlayerId ? 2 : 0) + (x.playerName ? 1 : 0) + (x.teamSide ? 1 : 0)
}

export function mergeScorerEntries(
  primary: MatchScorerEntry[],
  secondary: MatchScorerEntry[],
): MatchScorerEntry[] {
  const result = [...primary]
  for (const s of secondary) {
    const sKey = mergeGroupKey(s)
    const dupIndex = result.findIndex((e) => {
      if (mergeGroupKey(e) !== sKey) return false
      if (e.minute == null || s.minute == null) return e.minute === s.minute
      return Math.abs(e.minute - s.minute) <= MERGE_MINUTE_TOLERANCE
    })
    if (dupIndex === -1) {
      result.push(s)
      continue
    }
    const existing = result[dupIndex]!
    if (s.teamSide && existing.teamSide && s.teamSide !== existing.teamSide) {
      continue
    }
    if (scorerEntryScore(s) > scorerEntryScore(existing)) {
      result[dupIndex] = s
    } else if (scorerEntryScore(s) === scorerEntryScore(existing) && s.teamSide && !existing.teamSide) {
      result[dupIndex] = s
    }
  }

  return result.sort((a, b) => {
    const ma = a.minute ?? 9999
    const mb = b.minute ?? 9999
    if (ma !== mb) return ma - mb
    return a.playerKey.localeCompare(b.playerKey)
  })
}

/** Elimina duplicados o goles de más respecto al marcador oficial. */
export function reconcileScorersWithScore(
  scorers: MatchScorerEntry[],
  goalsTeamA: number | null | undefined,
  goalsTeamB: number | null | undefined,
): MatchScorerEntry[] {
  if (goalsTeamA == null || goalsTeamB == null) return scorers

  const sorted = [...scorers].sort((a, b) => {
    const ma = a.minute ?? 9999
    const mb = b.minute ?? 9999
    if (ma !== mb) return ma - mb
    return a.playerKey.localeCompare(b.playerKey)
  })

  const seenGoal = new Set<string>()
  let countA = 0
  let countB = 0
  const result: MatchScorerEntry[] = []

  for (const s of sorted) {
    if (s.includesPenalties) continue
    const goals = typeof s.goals === 'number' && s.goals > 0 ? s.goals : 1
    const side = s.teamSide
    if (side !== 'teamA' && side !== 'teamB') continue

    const goalKey = `${s.playerKey}|${s.minute ?? 'x'}|${s.ownGoal ? 1 : 0}`
    if (seenGoal.has(goalKey)) continue

    if (side === 'teamA') {
      if (countA + goals > goalsTeamA) continue
      countA += goals
    } else {
      if (countB + goals > goalsTeamB) continue
      countB += goals
    }

    seenGoal.add(goalKey)
    result.push(s)
  }

  return result
}
