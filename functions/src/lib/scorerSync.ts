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

export function mergeScorerEntries(
  primary: MatchScorerEntry[],
  secondary: MatchScorerEntry[],
): MatchScorerEntry[] {
  const key = (s: MatchScorerEntry) =>
    `${s.playerKey}|${s.minute ?? ''}|${s.teamSide ?? ''}|${s.includesPenalties ? 1 : 0}`
  const map = new Map<string, MatchScorerEntry>()
  for (const s of primary) map.set(key(s), s)
  for (const s of secondary) {
    const k = key(s)
    const existing = map.get(k)
    if (!existing) {
      map.set(k, s)
      continue
    }
    // Preferir entrada con más metadatos (p. ej. theSportsDbPlayerId desde timeline).
    const score = (x: MatchScorerEntry) =>
      (x.theSportsDbPlayerId ? 2 : 0) + (x.playerName ? 1 : 0)
    if (score(s) > score(existing)) map.set(k, s)
  }
  return [...map.values()].sort((a, b) => {
    const ma = a.minute ?? 9999
    const mb = b.minute ?? 9999
    if (ma !== mb) return ma - mb
    return a.playerKey.localeCompare(b.playerKey)
  })
}
