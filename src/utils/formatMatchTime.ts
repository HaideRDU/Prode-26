/**
 * Formatea horas de partidos en una zona IANA.
 * En UI autenticada usar `useMatchTimeFormatters()` (zona del perfil).
 */
import { DEFAULT_USER_TIME_ZONE } from '../data/americasTimezones'
import { toDate } from '../config/ruleset'

function toMs(scheduledAt: unknown): number | null {
  const d = toDate(scheduledAt)
  return d ? d.getTime() : null
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

/** Abreviatura de zona (ej. GMT-5, COT) para la fecha dada. */
export function formatTimeZoneShort(timeZone: string, at: Date = new Date()): string {
  const part = new Intl.DateTimeFormat('es', { timeZone, timeZoneName: 'short' }).formatToParts(at)
  return part.find((p) => p.type === 'timeZoneName')?.value?.trim() || timeZone
}

export function formatDateTimeInZone(
  isoOrMs: string | number,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const ms = typeof isoOrMs === 'number' ? isoOrMs : Date.parse(isoOrMs)
  if (!Number.isFinite(ms)) return ''
  return new Intl.DateTimeFormat('es', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  }).format(new Date(ms))
}

export function formatMatchTimeCOL(scheduledAt: unknown): string {
  return formatMatchTime(scheduledAt, DEFAULT_USER_TIME_ZONE)
}

/** @deprecated Usar formatMatchHour(scheduledAt, timeZone) con zona del perfil. */
export function formatMatchHourCOL(scheduledAt: unknown): string {
  return formatMatchHour(scheduledAt, DEFAULT_USER_TIME_ZONE)
}
