import { playerKeySlugDisplayName } from './playerKeyMatch'
import type { MatchScorerEntry } from '../types/predictions'

export type ScorerLineDisplay = {
  key: string
  name: string
  minute: number | null
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
): ScorerLineDisplay[] {
  return (scorers ?? [])
    .filter((s) => !s.includesPenalties && s.goals > 0 && s.teamSide === teamSide)
    .map((s, i) => ({
      key: `${s.playerKey}-${s.minute ?? 'x'}-${i}`,
      name: scorerDisplayName(s),
      minute: s.minute ?? null,
    }))
}
