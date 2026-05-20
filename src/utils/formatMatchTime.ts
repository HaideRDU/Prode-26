/**
 * Formatea horas de partidos (zona fija del torneo / COL por defecto).
 * La zona del perfil del usuario es solo preferencia visual por ahora.
 */
import { DEFAULT_USER_TIME_ZONE } from '../data/americasTimezones'

type FirestoreTimestamp = { toDate: () => Date }

function toMs(scheduledAt: unknown): number | null {
  if (scheduledAt == null) return null
  if (typeof scheduledAt === 'object' && 'toDate' in (scheduledAt as object)) {
    return (scheduledAt as FirestoreTimestamp).toDate().getTime()
  }
  if (scheduledAt instanceof Date) return scheduledAt.getTime()
  const parsed = Date.parse(String(scheduledAt))
  return Number.isFinite(parsed) ? parsed : null
}

export function formatMatchTime(scheduledAt: unknown, timeZone: string): string {
  const ms = toMs(scheduledAt)
  if (ms == null) return ''
  return new Intl.DateTimeFormat('es', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms))
}

export function formatMatchHour(scheduledAt: unknown, timeZone: string): string {
  const ms = toMs(scheduledAt)
  if (ms == null) return ''
  return new Intl.DateTimeFormat('es', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms))
}

export function formatMatchTimeCOL(scheduledAt: unknown): string {
  return formatMatchTime(scheduledAt, DEFAULT_USER_TIME_ZONE)
}

/** @deprecated Usar formatMatchHour(scheduledAt, timeZone) con zona del perfil. */
export function formatMatchHourCOL(scheduledAt: unknown): string {
  return formatMatchHour(scheduledAt, DEFAULT_USER_TIME_ZONE)
}
