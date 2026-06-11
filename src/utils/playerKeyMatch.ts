import type { MatchScorerEntry } from '../types/predictions'

export type PlayerRef = {
  playerKey: string
  name?: string
  theSportsDbPlayerId?: string
  apiSportsPlayerId?: number
}

export function normalizePlayerName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

export function scorerMatchesPick(pick: PlayerRef, scorer: MatchScorerEntry): boolean {
  if (pick.playerKey === scorer.playerKey) return true

  const scorerTsdb = scorer.theSportsDbPlayerId?.trim()
  if (scorerTsdb) {
    if (pick.playerKey === scorerTsdb) return true
    if (pick.theSportsDbPlayerId === scorerTsdb) return true
  }

  if (pick.theSportsDbPlayerId && pick.theSportsDbPlayerId === scorer.playerKey) return true

  const pickName = pick.name?.trim()
  const scorerName = scorer.playerName?.trim()
  if (pickName && scorerName && normalizePlayerName(pickName) === normalizePlayerName(scorerName)) {
    return true
  }

  return false
}
