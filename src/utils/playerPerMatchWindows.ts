import {
  DEFAULT_RULESET,
  getPlayerPerMatchOpensAt,
  getPlayerPickLockAt,
  toDate,
  type RulesetConfig,
} from '../config/ruleset'
import { sortByTournamentCatalog } from '../domain/matchCatalogOrder'
import type { MatchDoc } from '../types/predictions'

export type PlayerPickCardState = 'enabled' | 'blocked'

/** Partidos con ventana de jugador abierta antes de las 24 h (p. ej. apertura del torneo). */
export const PLAYER_PICK_EARLY_ACCESS_MATCH_IDS = new Set<string>(['wc26-A-01'])

export type ClassifiedPlayerPickMatches = {
  live: (MatchDoc & { id: string })[]
  prediction: (MatchDoc & { id: string })[]
  /** Primer partido futuro (bloqueado) cuando aún no hay ventana abierta; prioriza wc26-A-01. */
  preview: (MatchDoc & { id: string })[]
  /** Próximo partido que aún no abrió ventana (para mensaje vacío). */
  nextOpensAt: Date | null
}

function isPreviewCandidate(
  match: MatchDoc & { id: string },
  nowMs: number,
  config: RulesetConfig = DEFAULT_RULESET,
): boolean {
  if (match.status !== 'scheduled') return false
  if (isPlayerPickEarlyAccessOpen(match, nowMs, config)) return false
  if (isMatchVisibleForPlayerPrediction(match, nowMs, config)) return false
  const kickoff = kickoffMs(match)
  return kickoff !== null && kickoff > nowMs
}

/** Vista previa: primer partido pendiente en orden de catálogo (grupos A→L, -01…-06), no por hora en DB. */
function findPreviewMatch(
  matches: (MatchDoc & { id: string })[],
  nowMs: number,
  config: RulesetConfig = DEFAULT_RULESET,
): (MatchDoc & { id: string }) | null {
  for (const m of sortByTournamentCatalog(matches)) {
    if (isPreviewCandidate(m, nowMs, config)) return m
  }
  return null
}

function kickoffMs(match: MatchDoc): number | null {
  const t = toDate(match.scheduledAt)?.getTime()
  return t !== undefined && Number.isFinite(t) ? t : null
}

function pickLockMs(match: MatchDoc, config: RulesetConfig): number | null {
  const lock = getPlayerPickLockAt(match.scheduledAt, config)?.getTime()
  return lock !== undefined && Number.isFinite(lock) ? lock : null
}

/** México–Sudáfrica y otros IDs en PLAYER_PICK_EARLY_ACCESS_MATCH_IDS: editable hasta 1 h antes del pitazo. */
export function isPlayerPickEarlyAccessOpen(
  match: MatchDoc & { id: string },
  nowMs: number,
  config: RulesetConfig = DEFAULT_RULESET,
): boolean {
  if (!PLAYER_PICK_EARLY_ACCESS_MATCH_IDS.has(match.id)) return false
  if (match.status !== 'scheduled') return false
  const kickoff = kickoffMs(match)
  const lock = pickLockMs(match, config)
  if (kickoff === null || lock === null) return false
  return nowMs < lock && nowMs < kickoff
}

export function getPlayerPickCardState(
  match: MatchDoc & { id: string },
  nowMs: number,
  hasRoster: boolean,
  config: RulesetConfig = DEFAULT_RULESET,
): PlayerPickCardState {
  if (!hasRoster || match.status !== 'scheduled') return 'blocked'
  const lock = pickLockMs(match, config)
  if (lock === null) return 'blocked'
  if (isPlayerPickEarlyAccessOpen(match, nowMs, config)) return 'enabled'
  const opens = getPlayerPerMatchOpensAt(match.scheduledAt, config)?.getTime()
  if (opens === undefined || !Number.isFinite(opens)) return 'blocked'
  if (nowMs >= opens && nowMs < lock) return 'enabled'
  return 'blocked'
}

export function isMatchVisibleForPlayerPrediction(
  match: MatchDoc & { id: string },
  nowMs: number,
  config: RulesetConfig = DEFAULT_RULESET,
): boolean {
  if (match.status !== 'scheduled') return false
  if (isPlayerPickEarlyAccessOpen(match, nowMs, config)) return true
  const kickoff = kickoffMs(match)
  const opens = getPlayerPerMatchOpensAt(match.scheduledAt, config)?.getTime()
  if (kickoff === null || opens === undefined || !Number.isFinite(opens)) return false
  return nowMs >= opens && nowMs < kickoff
}

export function classifyPlayerPickMatches(
  matches: (MatchDoc & { id: string })[],
  nowMs: number = Date.now(),
  config: RulesetConfig = DEFAULT_RULESET,
): ClassifiedPlayerPickMatches {
  const live: (MatchDoc & { id: string })[] = []
  const prediction: (MatchDoc & { id: string })[] = []
  let nextOpensAt: Date | null = null
  let nextOpensMs = Number.POSITIVE_INFINITY

  const sorted = [...matches].sort((a, b) => {
    const ta = kickoffMs(a) ?? Number.MAX_SAFE_INTEGER
    const tb = kickoffMs(b) ?? Number.MAX_SAFE_INTEGER
    if (ta !== tb) return ta - tb
    return a.id.localeCompare(b.id)
  })

  for (const m of sorted) {
    if (m.status === 'live') {
      live.push(m)
      continue
    }
    if (isMatchVisibleForPlayerPrediction(m, nowMs, config)) {
      prediction.push(m)
      continue
    }
    if (m.status === 'scheduled') {
      const opens = getPlayerPerMatchOpensAt(m.scheduledAt, config)
      const kickoff = kickoffMs(m)
      if (opens && kickoff !== null && nowMs < kickoff) {
        const oms = opens.getTime()
        if (nowMs < oms && oms < nextOpensMs) {
          nextOpensMs = oms
          nextOpensAt = opens
        }
      }
    }
  }

  let preview: (MatchDoc & { id: string })[] = []
  if (prediction.length === 0) {
    const first = findPreviewMatch(matches, nowMs, config)
    if (first) preview = [first]
  }

  return { live, prediction, preview, nextOpensAt }
}

export function findNextPlayerPickOpensAt(
  matches: (MatchDoc & { id: string })[],
  nowMs: number = Date.now(),
  config: RulesetConfig = DEFAULT_RULESET,
): Date | null {
  return classifyPlayerPickMatches(matches, nowMs, config).nextOpensAt
}
