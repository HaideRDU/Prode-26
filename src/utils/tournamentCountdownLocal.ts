import { normalizeAmericasTimeZone } from '../data/americasTimezones'

export interface LocalCountdownParts {
  days: number
  hours: number
  minutes: number
  seconds: number
  started: boolean
}

function localDateKey(ms: number, timeZone: string): string {
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

function addCalendarDay(key: string): string {
  const { y, m, d } = parseDayKey(key)
  const t = Date.UTC(y, m - 1, d + 1)
  const ny = new Date(t).getUTCFullYear()
  const nm = new Date(t).getUTCMonth() + 1
  const nd = new Date(t).getUTCDate()
  return `${ny}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`
}

function getZonedYmdHms(ms: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  }).formatToParts(new Date(ms))
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return {
    y: n('year'),
    m: n('month'),
    d: n('day'),
    h: n('hour'),
    min: n('minute'),
    s: n('second'),
  }
}

function midnightLocalUtcMs(y: number, m: number, d: number, timeZone: string): number {
  let utc = Date.UTC(y, m - 1, d, 12, 0, 0)
  for (let i = 0; i < 6; i++) {
    const z = getZonedYmdHms(utc, timeZone)
    if (z.y === y && z.m === m && z.d === d && z.h === 0 && z.min === 0 && z.s === 0) {
      return utc
    }
    const desired = Date.UTC(y, m - 1, d, 0, 0, 0)
    const actual = Date.UTC(z.y, z.m - 1, z.d, z.h, z.min, z.s)
    utc += desired - actual
  }
  return utc
}

function msAtStartOfLocalDay(dayKey: string, timeZone: string): number {
  const { y, m, d } = parseDayKey(dayKey)
  return midnightLocalUtcMs(y, m, d, timeZone)
}

function calendarDaysBetween(fromKey: string, toKey: string): number {
  const toUtcDay = (key: string) => {
    const { y, m, d } = parseDayKey(key)
    return Date.UTC(y, m - 1, d) / 86_400_000
  }
  return Math.max(0, Math.round(toUtcDay(toKey) - toUtcDay(fromKey)))
}

function splitHms(totalSec: number): Pick<LocalCountdownParts, 'hours' | 'minutes' | 'seconds'> {
  const s = Math.max(0, totalSec)
  return {
    hours: Math.floor(s / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  }
}

/**
 * Cuenta regresiva en la zona del usuario:
 * - Días: medianoches locales completas hasta el día del pitido.
 * - Horas/min/seg: tiempo restante hasta la próxima medianoche local (baja cada segundo).
 * - El mismo día del pitido: solo h/m/s hasta el instante exacto del inicio.
 */
export function countdownPartsInTimeZone(
  nowMs: number,
  targetMs: number,
  timeZone: string,
): LocalCountdownParts {
  if (nowMs >= targetMs) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, started: true }
  }

  const tz = normalizeAmericasTimeZone(timeZone)
  const totalSec = Math.floor((targetMs - nowMs) / 1000)
  const nowKey = localDateKey(nowMs, tz)
  const targetKey = localDateKey(targetMs, tz)

  if (nowKey === targetKey) {
    return { days: 0, ...splitHms(totalSec), started: false }
  }

  const nextDayKey = addCalendarDay(nowKey)
  const days = calendarDaysBetween(nextDayKey, targetKey)
  const nextMidnightMs = msAtStartOfLocalDay(nextDayKey, tz)
  const remainderSec = Math.max(0, Math.floor((nextMidnightMs - nowMs) / 1000))

  return { days, ...splitHms(remainderSec), started: false }
}
