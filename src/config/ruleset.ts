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
  }
}

export const DEFAULT_RULESET: RulesetConfig = {
  id: 'wc2026_v1',
  versionLabel: 'Reglamento PDF 1.0 (2026-05-01)',
  timezone: 'America/Bogota',
  tournamentStartsAtIso: '2026-06-11T00:00:00-05:00',
  lockWindows: {
    generalPredictionsHoursBeforeTournament: GENERAL_PREDICTIONS_LOCK_HOURS_BEFORE_TOURNAMENT,
    knockoutPickMinutesBeforeKickoff: 60,
  },
  features: {
    // Se deja preparado, pero desactivado hasta tener fuente oficial de goleadores por partido.
    playerPerMatchEnabled: false,
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
  },
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
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const maybe = (value as { toDate?: () => Date }).toDate
    if (typeof maybe === 'function') {
      const d = maybe()
      return Number.isNaN(d.getTime()) ? null : d
    }
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
  const kickoff = toDate(kickoffAt)
  if (!kickoff) return null
  return new Date(kickoff.getTime() - config.lockWindows.knockoutPickMinutesBeforeKickoff * 60 * 1000)
}
