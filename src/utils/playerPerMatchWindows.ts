import {
  DEFAULT_RULESET,
  getPlayerPerMatchOpensAt,
  getPlayerPickLockAt,
  toDate,
  type RulesetConfig,
} from '../config/ruleset'
import { sortByTournamentCatalog } from '../domain/matchCatalogOrder'
import type { MatchDoc } from '../types/predictions'

export function filterGroupStageMatches(
  matches: (MatchDoc & { id: string })[],
): (MatchDoc & { id: string })[] {
  return sortByTournamentCatalog(matches.filter((m) => m.phase === 'group'))
}

/** Fase de grupos en curso: queda al menos un partido programado o en juego. */
export function isGroupStagePhaseActive(matches: (MatchDoc & { id: string })[]): boolean {
  const groupMatches = matches.filter((m) => m.phase === 'group')
  if (groupMatches.length === 0) return false
  return groupMatches.some((m) => m.status === 'scheduled' || m.status === 'live')
}

export type PlayerPickCardState = 'enabled' | 'blocked' | 'closed'

/** Partidos con ventana de jugador abierta antes de las 24 h (p. ej. apertura del torneo). */
export const PLAYER_PICK_EARLY_ACCESS_MATCH_IDS = new Set<string>(['wc26-A-01'])

const SCHEDULED_MATCH_LIVE_FALLBACK_MS = 4 * 60 * 60 * 1000

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
function matchOpensMs(match: MatchDoc, config: RulesetConfig): number | null {
  const opens = getPlayerPerMatchOpensAt(match.scheduledAt, config)?.getTime()
  return opens !== undefined && Number.isFinite(opens) ? opens : null
}

function findPreviewMatches(
  matches: (MatchDoc & { id: string })[],
  nowMs: number,
  config: RulesetConfig = DEFAULT_RULESET,
): (MatchDoc & { id: string })[] {
  let nextOpenMs = Number.POSITIVE_INFINITY
  for (const m of matches) {
    if (!isPreviewCandidate(m, nowMs, config)) continue
    const opens = matchOpensMs(m, config)
    if (opens !== null && nowMs < opens && opens < nextOpenMs) nextOpenMs = opens
  }
  if (!Number.isFinite(nextOpenMs)) return []
  return sortByTournamentCatalog(
    matches.filter((m) => isPreviewCandidate(m, nowMs, config) && matchOpensMs(m, config) === nextOpenMs),
  )
}

function kickoffMs(match: MatchDoc): number | null {
  const t = toDate(match.scheduledAt)?.getTime()
  return t !== undefined && Number.isFinite(t) ? t : null
}

function pickLockMs(match: MatchDoc, config: RulesetConfig): number | null {
  const lock = getPlayerPickLockAt(match.scheduledAt, config)?.getTime()
  return lock !== undefined && Number.isFinite(lock) ? lock : null
}

function tournamentCalendarDay(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms))
}

function nextCalendarDay(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number)
  const t = Date.UTC(y, m - 1, d + 1)
  const date = new Date(t)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

/** Pitazo en el día calendario actual del torneo (America/Bogota). */
export function isGroupMatchOnTodayTournamentDay(
  match: MatchDoc,
  nowMs: number = Date.now(),
  config: RulesetConfig = DEFAULT_RULESET,
): boolean {
  const kickoff = kickoffMs(match)
  if (kickoff === null) return false
  const tz = config.timezone
  return tournamentCalendarDay(kickoff, tz) === tournamentCalendarDay(nowMs, tz)
}

/** @deprecated Usar isGroupMatchOnTodayTournamentDay */
export function isGroupMatchOnNextTournamentDay(
  match: MatchDoc,
  nowMs: number = Date.now(),
  config: RulesetConfig = DEFAULT_RULESET,
): boolean {
  const kickoff = kickoffMs(match)
  if (kickoff === null) return false
  const tz = config.timezone
  const tomorrow = nextCalendarDay(tournamentCalendarDay(nowMs, tz))
  return tournamentCalendarDay(kickoff, tz) === tomorrow
}

/** Partido de grupos aún no jugado (programado o live prematuro en DB). */
export function isRemainingGroupStageMatch(
  match: MatchDoc & { id: string },
  nowMs: number = Date.now(),
): boolean {
  if (match.phase !== 'group') return false
  if (!isScheduledForPlayerPickUi(match, nowMs)) return false
  const kickoff = kickoffMs(match)
  return kickoff !== null && nowMs < kickoff
}

function allowsGroupStageEarlyPlayerPick(
  match: MatchDoc & { id: string },
  nowMs: number,
  options?: { allowGroupStageEarlyPick?: boolean },
  config: RulesetConfig = DEFAULT_RULESET,
): boolean {
  if (options?.allowGroupStageEarlyPick) return true
  return isRemainingGroupStageMatch(match, nowMs) && isGroupMatchOnTodayTournamentDay(match, nowMs, config)
}

function isScheduledMatchInLiveFallback(match: MatchDoc, nowMs: number): boolean {
  if (match.status !== 'scheduled') return false
  const kickoff = kickoffMs(match)
  if (kickoff === null) return false
  return nowMs >= kickoff && nowMs < kickoff + SCHEDULED_MATCH_LIVE_FALLBACK_MS
}

/** FIFA/TSDB a veces marcan `live` antes del pitazo; la UI lo ignora hasta la hora oficial. */
export function isPrematureLiveStatus(match: MatchDoc, nowMs: number = Date.now()): boolean {
  if (match.status !== 'live') return false
  const kickoff = kickoffMs(match)
  return kickoff !== null && nowMs < kickoff
}

/** Partido aún no empezado para ventanas de jugador por partido (incluye live prematuro). */
export function isScheduledForPlayerPickUi(match: MatchDoc, nowMs: number = Date.now()): boolean {
  if (match.status === 'scheduled') return true
  return isPrematureLiveStatus(match, nowMs)
}

/** En juego real: status live tras kickoff, o scheduled con kickoff ya pasado (sync retrasado). */
export function isMatchLiveForDisplay(match: MatchDoc, nowMs: number = Date.now()): boolean {
  if (match.status === 'finished' || match.status === 'postponed' || match.status === 'cancelled') {
    return false
  }
  const kickoff = kickoffMs(match)
  if (match.status === 'live') {
    return kickoff === null || nowMs >= kickoff
  }
  return isScheduledMatchInLiveFallback(match, nowMs)
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
  options?: { allowGroupStageEarlyPick?: boolean },
): PlayerPickCardState {
  if (!hasRoster || !isScheduledForPlayerPickUi(match, nowMs)) return 'blocked'
  const lock = pickLockMs(match, config)
  if (lock === null) return 'blocked'
  if (nowMs >= lock) return 'closed'

  if (allowsGroupStageEarlyPlayerPick(match, nowMs, options, config) && match.phase === 'group') return 'enabled'

  if (isPlayerPickEarlyAccessOpen(match, nowMs, config)) return 'enabled'
  const opens = getPlayerPerMatchOpensAt(match.scheduledAt, config)?.getTime()
  if (opens === undefined || !Number.isFinite(opens)) return 'blocked'
  if (nowMs >= opens) return 'enabled'
  return 'blocked'
}

export function isMatchVisibleForPlayerPrediction(
  match: MatchDoc & { id: string },
  nowMs: number,
  config: RulesetConfig = DEFAULT_RULESET,
): boolean {
  if (!isScheduledForPlayerPickUi(match, nowMs)) return false
  if (isRemainingGroupStageMatch(match, nowMs) && isGroupMatchOnTodayTournamentDay(match, nowMs, config)) {
    return true
  }
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
    if (isMatchLiveForDisplay(m, nowMs)) {
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

  const preview = findPreviewMatches(matches, nowMs, config)

  return { live, prediction, preview, nextOpensAt }
}

/** Partido en curso para la UI (respeta kickoff; ignora live prematuro en Firestore). */
export function isMatchDisplayLive(
  match: MatchDoc & { id: string },
  nowMs: number = Date.now(),
): boolean {
  return isMatchLiveForDisplay(match, nowMs)
}

export function findNextPlayerPickOpensAt(
  matches: (MatchDoc & { id: string })[],
  nowMs: number = Date.now(),
  config: RulesetConfig = DEFAULT_RULESET,
): Date | null {
  return classifyPlayerPickMatches(matches, nowMs, config).nextOpensAt
}
