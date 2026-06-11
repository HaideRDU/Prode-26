import type { MatchScorerEntry, TeamPlayerDoc } from './types/predictions'

/** Referencia de jugador para comparar predicción ↔ goleador de la API. */
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

export function playerRefFromDoc(docId: string, data: TeamPlayerDoc): PlayerRef {
  const playerKey = data.paniniStickerCode?.trim() || docId
  return {
    playerKey,
    name: data.name?.trim() || undefined,
    theSportsDbPlayerId: data.theSportsDbPlayerId?.trim() || undefined,
    apiSportsPlayerId:
      typeof data.apiSportsPlayerId === 'number' && data.apiSportsPlayerId > 0
        ? data.apiSportsPlayerId
        : undefined,
  }
}

/** ¿La predicción del usuario corresponde a este goleador del partido? */
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
