import {
  DEFAULT_RULESET,
  getGeneralPredictionsLockAt,
  getPlayerPickLockAt,
  isPlayerPickLocked,
  toDate,
} from '../config/ruleset'

export class PredictionWriteBlockedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PredictionWriteBlockedError'
  }
}

export function assertGeneralPredictionsOpen(nowMs: number = Date.now()): void {
  const lockAt = getGeneralPredictionsLockAt(DEFAULT_RULESET)
  if (nowMs >= lockAt.getTime()) {
    throw new PredictionWriteBlockedError(
      `Las predicciones generales están cerradas desde el ${lockAt.toLocaleString('es-CO', { timeZone: DEFAULT_RULESET.timezone })}.`,
    )
  }
}

export function assertPlayerPickOpen(
  scheduledAt: unknown,
  nowMs: number = Date.now(),
): void {
  const kickoff = toDate(scheduledAt)
  if (!kickoff) {
    throw new PredictionWriteBlockedError('No se pudo determinar la hora del partido.')
  }
  if (isPlayerPickLocked(scheduledAt, nowMs, DEFAULT_RULESET)) {
    const lockAt = getPlayerPickLockAtDisplay(scheduledAt)
    throw new PredictionWriteBlockedError(
      `El cierre del goleador por partido fue el ${lockAt} (11:59 p. m. del día anterior, hora del torneo).`,
    )
  }
}

function getPlayerPickLockAtDisplay(scheduledAt: unknown): string {
  const lock = getPlayerPickLockAt(scheduledAt, DEFAULT_RULESET)
  if (!lock) return '—'
  return lock.toLocaleString('es-CO', { timeZone: DEFAULT_RULESET.timezone })
}
