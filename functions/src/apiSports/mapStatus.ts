import type { MatchStatus } from '../lib/types/predictions'

const LIVE_SHORT = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT'])
const FINISHED_SHORT = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO'])
const POSTPONED_SHORT = new Set(['PST', 'SUSP'])
const CANCELLED_SHORT = new Set(['CANC', 'ABD'])

export function mapApiStatusShort(short: string): MatchStatus {
  const s = short.trim().toUpperCase()
  if (LIVE_SHORT.has(s)) return 'live'
  if (FINISHED_SHORT.has(s)) return 'finished'
  if (POSTPONED_SHORT.has(s)) return 'postponed'
  if (CANCELLED_SHORT.has(s)) return 'cancelled'
  return 'scheduled'
}
