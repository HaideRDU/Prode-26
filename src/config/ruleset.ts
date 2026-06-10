export type RulesetId = 'wc2026_v1'

export type KnockoutRoundId = 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final'

/** Puntos por tipo de acierto en un partido (suma independiente; máx. = suma de las tres filas). */
export type MatchPointsRow = {
  winnerOrDraw: number
  goalsTeamA: number
  goalsTeamB: number
}

export function maxMatchPoints(row: MatchPointsRow): number {
  return row.winnerOrDraw + row.goalsTeamA + row.goalsTeamB
}

/** Cierre de predicciones generales (zona del torneo). */
export const GENERAL_PREDICTIONS_LOCK_AT_ISO = '2026-06-10T17:00:00-05:00'

/** Respaldo si no hay `generalPredictionsLockAtIso`: horas antes del pitazo inicial. */
export const GENERAL_PREDICTIONS_LOCK_HOURS_BEFORE_TOURNAMENT = 24 * 4

export interface RulesetConfig {
  id: RulesetId
  versionLabel: string
  timezone: string
  tournamentStartsAtIso: string
  /** Si está definido, tiene prioridad sobre `lockWindows.generalPredictionsHoursBeforeTournament`. */
  generalPredictionsLockAtIso?: string
  lockWindows: {
    generalPredictionsHoursBeforeTournament: number
    playerPerMatchOpensHoursBeforeKickoff: number
  }
  features: {
    playerPerMatchEnabled: boolean
  }
  points: {
    matchByPhase: {
      group: MatchPointsRow
      knockout: Record<KnockoutRoundId, MatchPointsRow>
    }
    advancement: {
      toR32: number
      toR16: number
      toQf: number
      toSf: number
      toFinal: number
      thirdPlace: number
      champion: number
      runnerUp: number
    }
    specials: {
      topScorer: number
      bestGoalkeeperAverage: number
      bonusQuestion: number
    }
    playerPerMatch: {
      goalsPerGoalByRound: Record<'group' | KnockoutRoundId, number>
    }
  }
}

const KO_ROWS: Record<KnockoutRoundId, MatchPointsRow> = {
  r32: { winnerOrDraw: 1, goalsTeamA: 3, goalsTeamB: 3 },
  r16: { winnerOrDraw: 2, goalsTeamA: 3, goalsTeamB: 3 },
  qf: { winnerOrDraw: 3, goalsTeamA: 3, goalsTeamB: 3 },
  sf: { winnerOrDraw: 3, goalsTeamA: 4, goalsTeamB: 4 },
  third: { winnerOrDraw: 3, goalsTeamA: 4, goalsTeamB: 4 },
  final: { winnerOrDraw: 4, goalsTeamA: 5, goalsTeamB: 5 },
}

export const DEFAULT_RULESET: RulesetConfig = {
  id: 'wc2026_v1',
  versionLabel: 'WC2026 v1 · reglamento oficial (jun 2026)',
  timezone: 'America/Bogota',
  tournamentStartsAtIso: '2026-06-11T00:00:00-05:00',
  generalPredictionsLockAtIso: GENERAL_PREDICTIONS_LOCK_AT_ISO,
  lockWindows: {
    generalPredictionsHoursBeforeTournament: GENERAL_PREDICTIONS_LOCK_HOURS_BEFORE_TOURNAMENT,
    playerPerMatchOpensHoursBeforeKickoff: 24,
  },
  features: {
    playerPerMatchEnabled: true,
  },
  points: {
    matchByPhase: {
      group: { winnerOrDraw: 1, goalsTeamA: 2, goalsTeamB: 2 },
      knockout: KO_ROWS,
    },
    advancement: {
      toR32: 2,
      toR16: 4,
      toQf: 6,
      toSf: 8,
      toFinal: 10,
      thirdPlace: 12,
      champion: 22,
      runnerUp: 15,
    },
    specials: {
      topScorer: 18,
      bestGoalkeeperAverage: 12,
      bonusQuestion: 5,
    },
    playerPerMatch: {
      goalsPerGoalByRound: {
        group: 1,
        r32: 2,
        r16: 3,
        qf: 3,
        sf: 4,
        third: 4,
        final: 5,
      },
    },
  },
}

function dateFromFirestoreSeconds(value: object): Date | null {
  if (!('seconds' in value)) return null
  const s = (value as { seconds: unknown }).seconds
  if (typeof s !== 'number' || !Number.isFinite(s)) return null
  const ns =
    'nanoseconds' in value && typeof (value as { nanoseconds: unknown }).nanoseconds === 'number'
      ? (value as { nanoseconds: number }).nanoseconds
      : 0
  const d = new Date(s * 1000 + ns / 1e6)
  return Number.isNaN(d.getTime()) ? null : d
}

export function toDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof value === 'number') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof value === 'object' && value !== null) {
    if ('toDate' in value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
      const d = (value as { toDate: () => Date }).toDate.call(value)
      return Number.isNaN(d.getTime()) ? null : d
    }
    const fromSeconds = dateFromFirestoreSeconds(value)
    if (fromSeconds) return fromSeconds
  }
  return null
}

export function getGeneralPredictionsLockAt(config: RulesetConfig = DEFAULT_RULESET): Date {
  if (config.generalPredictionsLockAtIso) {
    return new Date(config.generalPredictionsLockAtIso)
  }
  const start = new Date(config.tournamentStartsAtIso)
  return new Date(
    start.getTime() - config.lockWindows.generalPredictionsHoursBeforeTournament * 60 * 60 * 1000,
  )
}

/** Goleador y arquero siguen el mismo cierre que el plazo general de predicciones. */
export function areSpecialPlayersOpen(nowMs = Date.now(), config: RulesetConfig = DEFAULT_RULESET): boolean {
  return nowMs < getGeneralPredictionsLockAt(config).getTime()
}

export function formatGeneralPredictionsLockLabel(config: RulesetConfig = DEFAULT_RULESET): string {
  return getGeneralPredictionsLockAt(config).toLocaleString('es-CO', {
    timeZone: config.timezone,
    dateStyle: 'long',
    timeStyle: 'short',
  })
}

function localDateKeyInZone(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms))
}

function parseDayKey(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.split('-').map(Number)
  return { y, m, d }
}

function shiftCalendarDay(key: string, deltaDays: number): string {
  const { y, m, d } = parseDayKey(key)
  const t = Date.UTC(y, m - 1, d + deltaDays)
  const nd = new Date(t)
  return `${nd.getUTCFullYear()}-${String(nd.getUTCMonth() + 1).padStart(2, '0')}-${String(nd.getUTCDate()).padStart(2, '0')}`
}

function msAtLocalHms(
  dayKey: string,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const { y, m, d } = parseDayKey(dayKey)
  let utc = Date.UTC(y, m - 1, d, 12, 0, 0)
  for (let i = 0; i < 8; i++) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    }).formatToParts(new Date(utc))
    const n = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
    if (
      n('year') === y &&
      n('month') === m &&
      n('day') === d &&
      n('hour') === hour &&
      n('minute') === minute &&
      n('second') === second
    ) {
      return new Date(utc)
    }
    const desired = Date.UTC(y, m - 1, d, hour, minute, second)
    const actual = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'))
    utc += desired - actual
  }
  return new Date(utc)
}

/** 23:59:59 del día calendario anterior al partido (zona del torneo). */
export function getPlayerPickLockAt(
  kickoffAt: unknown,
  config: RulesetConfig = DEFAULT_RULESET,
): Date | null {
  const kickoff = toDate(kickoffAt)
  if (!kickoff) return null
  const tz = config.timezone
  const matchDayKey = localDateKeyInZone(kickoff.getTime(), tz)
  const prevDayKey = shiftCalendarDay(matchDayKey, -1)
  return msAtLocalHms(prevDayKey, 23, 59, 59, tz)
}

/** @deprecated Alias de getPlayerPickLockAt */
export function getKnockoutPickLockAt(
  kickoffAt: unknown,
  config: RulesetConfig = DEFAULT_RULESET,
): Date | null {
  return getPlayerPickLockAt(kickoffAt, config)
}

export function getPlayerPerMatchOpensAt(
  kickoffAt: unknown,
  config: RulesetConfig = DEFAULT_RULESET,
): Date | null {
  const kickoff = toDate(kickoffAt)
  if (!kickoff) return null
  return new Date(
    kickoff.getTime() - config.lockWindows.playerPerMatchOpensHoursBeforeKickoff * 60 * 60 * 1000,
  )
}

export function isGeneralPredictionsLocked(nowMs: number, config: RulesetConfig = DEFAULT_RULESET): boolean {
  return nowMs >= getGeneralPredictionsLockAt(config).getTime()
}

export function isPlayerPickLocked(
  kickoffAt: unknown,
  nowMs: number = Date.now(),
  config: RulesetConfig = DEFAULT_RULESET,
): boolean {
  const lock = getPlayerPickLockAt(kickoffAt, config)
  if (!lock) return true
  return nowMs > lock.getTime()
}
