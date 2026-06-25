import type { MatchScorerEntry, TeamPlayerDoc } from '../types/predictions'

export type PlayerRef = {
  playerKey: string
  name?: string
  theSportsDbPlayerId?: string
  apiSportsPlayerId?: number
}

type RosterPlayer = Pick<TeamPlayerDoc, 'name' | 'paniniStickerCode' | 'theSportsDbPlayerId'> & { id: string }

/** Nombre legible inferido del slug de una clave guardada (p. ej. `3-jamal-musiala` → Jamal Musiala). */
export function playerKeySlugDisplayName(playerKey: string): string | undefined {
  const slug = playerKey
    .trim()
    .replace(/^\d+-/, '')
    .replace(/-/g, ' ')
    .trim()
  if (!slug) return undefined
  return slug.replace(/\b\p{L}/gu, (c) => c.toUpperCase())
}

/**
 * Resuelve el nombre del jugador elegido aunque la plantilla haya cambiado de formato
 * (TSDB doc id → Panini sticker, etc.).
 */
export function resolvePlayerPickName(
  players: readonly RosterPlayer[],
  playerKey: string | undefined,
): string | undefined {
  const k = playerKey?.trim()
  if (!k) return undefined

  for (const p of players) {
    const canonical = p.paniniStickerCode?.trim() || p.id
    if (p.id === k || canonical === k) return p.name
    const tsdb = p.theSportsDbPlayerId?.trim()
    if (tsdb && tsdb === k) return p.name
    const slugName = playerKeySlugDisplayName(k)
    if (slugName && normalizePlayerName(slugName) === normalizePlayerName(p.name)) return p.name
  }

  return playerKeySlugDisplayName(k)
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
