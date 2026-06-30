import type { MatchStatus } from '../lib/types/predictions'

/**
 * Convierte strStatus de TheSportsDB V1 a MatchStatus interno.
 *
 * Valores conocidos:
 *   "Not Started"   → scheduled
 *   "In Progress"   → live
 *   "1H", "HT", "2H", "ET", "Extra Time", "Penalties" → live
 *   "Match Finished", "FT", "AET", "PEN", "AP"  → finished
 *   "Postponed"     → postponed
 *   "Cancelled"     → cancelled
 */
export function mapTsdbStatus(strStatus: string): MatchStatus {
  const s = strStatus.trim().toUpperCase()

  const LIVE = new Set(['IN PROGRESS', '1H', 'HT', '2H', 'ET', 'EXTRA TIME', 'PENALTIES', 'LIVE', 'BT'])
  const FINISHED = new Set(['MATCH FINISHED', 'FT', 'AET', 'PEN', 'AP', 'AWD', 'WO'])
  const POSTPONED = new Set(['POSTPONED', 'PST', 'SUSP'])
  const CANCELLED = new Set(['CANCELLED', 'CANCELED', 'CANC', 'ABD'])

  if (LIVE.has(s)) return 'live'
  if (FINISHED.has(s)) return 'finished'
  if (POSTPONED.has(s)) return 'postponed'
  if (CANCELLED.has(s)) return 'cancelled'
  return 'scheduled'
}
