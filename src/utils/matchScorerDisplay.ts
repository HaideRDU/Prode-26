import { playerKeySlugDisplayName } from './playerKeyMatch'
import type { MatchScorerEntry } from '../types/predictions'

export type ScorerLineDisplay = {
  key: string
  name: string
  minute: number | null
}

/** Misma lógica que functions/src/lib/scorerSync.ts — evita duplicados en UI. */
export function reconcileScorersForDisplay(
  scorers: MatchScorerEntry[] | undefined,
  goalsTeamA: number | null | undefined,
  goalsTeamB: number | null | undefined,
): MatchScorerEntry[] {
  if (goalsTeamA == null || goalsTeamB == null) return scorers ?? []

  const sorted = [...(scorers ?? [])].sort((a, b) => {
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

function scorerDisplayName(s: MatchScorerEntry): string {
  return (
    s.playerName?.trim() ||
    playerKeySlugDisplayName(s.playerKey) ||
    s.playerKey
  )
}

/** Goles de un lado (90' reglamentarios; sin penales). */
export function scorersForTeamSide(
  scorers: MatchScorerEntry[] | undefined,
  teamSide: 'teamA' | 'teamB',
  goalsTeamA?: number | null,
  goalsTeamB?: number | null,
): ScorerLineDisplay[] {
  const rows =
    goalsTeamA != null && goalsTeamB != null
      ? reconcileScorersForDisplay(scorers, goalsTeamA, goalsTeamB)
      : (scorers ?? [])

  return rows
    .filter((s) => !s.includesPenalties && s.goals > 0 && s.teamSide === teamSide)
    .map((s, i) => ({
      key: `${s.playerKey}-${s.minute ?? 'x'}-${i}`,
      name: scorerDisplayName(s),
      minute: s.minute ?? null,
    }))
}
