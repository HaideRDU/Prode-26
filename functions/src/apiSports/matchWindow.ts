import type { MatchDoc } from '../lib/types/predictions'
import {
  POLL_AFTER_KICKOFF_MS,
  POLL_BEFORE_KICKOFF_MS,
  TOURNAMENT_WINDOW_END_MS,
  TOURNAMENT_WINDOW_START_MS,
} from './constants'

export function kickoffMs(scheduledAt: unknown): number | null {
  if (scheduledAt == null) return null
  if (typeof scheduledAt === 'object' && scheduledAt !== null && 'toDate' in scheduledAt) {
    const d = (scheduledAt as { toDate: () => Date }).toDate()
    return d.getTime()
  }
  if (scheduledAt instanceof Date) return scheduledAt.getTime()
  const parsed = Date.parse(String(scheduledAt))
  return Number.isFinite(parsed) ? parsed : null
}

export function isWithinTournamentWindow(nowMs: number): boolean {
  return nowMs >= TOURNAMENT_WINDOW_START_MS && nowMs <= TOURNAMENT_WINDOW_END_MS
}

/** Ventana de polling: desde 15 min antes del inicio hasta 3.5 h después */
export function isMatchInPollingWindow(match: MatchDoc, nowMs: number): boolean {
  if (match.status === 'live') return true
  const start = kickoffMs(match.scheduledAt)
  if (start == null) return false
  return nowMs >= start - POLL_BEFORE_KICKOFF_MS && nowMs <= start + POLL_AFTER_KICKOFF_MS
}

export function shouldRunScheduledSync(nowMs: number): boolean {
  if (!isWithinTournamentWindow(nowMs)) return false
  return true
}
