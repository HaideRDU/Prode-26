export type RulesetId = 'wc2026_v1'

export type KnockoutRoundId = 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final'

/** Horas en que se cierran las predicciones generales antes del pitazo inicial del torneo (14 días = 2 semanas). */
export const GENERAL_PREDICTIONS_LOCK_HOURS_BEFORE_TOURNAMENT = 24 * 14

export interface RulesetConfig {
  id: RulesetId
  versionLabel: string
  timezone: string
  tournamentStartsAtIso: string
  lockWindows: {
    generalPredictionsHoursBeforeTournament: number
    knockoutPickMinutesBeforeKickoff: number
    playerPerMatchOpensHoursBeforeKickoff: number
  }
  features: {
    playerPerMatchEnabled: boolean
  }
  points: {
    group: {
      exactScore: number
      oneScoreHit: number
      winnerOrDrawHit: number
    }
    knockout: {
      exactScoreByRound: Record<KnockoutRoundId, number>
      oneScoreHitWhenNotExact: number
      winnerHitWhenNotExact: number
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
      goalsPerGoal: number
    }
  }
}

export const DEFAULT_RULESET: RulesetConfig = {
  id: 'wc2026_v1',
  versionLabel: 'WC2026 v1 · vigente (mayo 2026)',
  timezone: 'America/Bogota',
  tournamentStartsAtIso: '2026-06-11T00:00:00-05:00',
  lockWindows: {
    generalPredictionsHoursBeforeTournament: GENERAL_PREDICTIONS_LOCK_HOURS_BEFORE_TOURNAMENT,
    knockoutPickMinutesBeforeKickoff: 60,
    playerPerMatchOpensHoursBeforeKickoff: 24,
  },
  features: {
    playerPerMatchEnabled: true,
  },
  points: {
    group: {
      exactScore: 5,
      oneScoreHit: 2,
      winnerOrDrawHit: 1,
    },
    knockout: {
      exactScoreByRound: {
        r32: 6,
        r16: 7,
        qf: 8,
        sf: 10,
        third: 9,
        final: 12,
      },
      oneScoreHitWhenNotExact: 2,
      winnerHitWhenNotExact: 1,
    },
    advancement: {
      toR32: 6,
      toR16: 8,
      toQf: 10,
      toSf: 13,
      toFinal: 16,
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
      goalsPerGoal: 2,
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
  const start = new Date(config.tournamentStartsAtIso)
  return new Date(start.getTime() - config.lockWindows.generalPredictionsHoursBeforeTournament * 60 * 60 * 1000)
}

export function getKnockoutPickLockAt(
  kickoffAt: unknown,
  config: RulesetConfig = DEFAULT_RULESET,
): Date | null {
  return getPlayerPickLockAt(kickoffAt, config)
}

export function getPlayerPickLockAt(
  kickoffAt: unknown,
  config: RulesetConfig = DEFAULT_RULESET,
): Date | null {
  const kickoff = toDate(kickoffAt)
  if (!kickoff) return null
  return new Date(kickoff.getTime() - config.lockWindows.knockoutPickMinutesBeforeKickoff * 60 * 1000)
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
