import { useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { normalizeAmericasTimeZone } from '../data/americasTimezones'
import type { AccountOutletContext } from '../types/outletContext'
import { formatMatchHour, formatMatchTime, formatTimeZoneShort } from '../utils/formatMatchTime'

/** Zona horaria del perfil (Américas), vía React Router outlet. */
export function useUserTimeZone(): string {
  const { timeZone } = useOutletContext<AccountOutletContext>()
  return normalizeAmericasTimeZone(timeZone)
}

export function useMatchTimeFormatters() {
  const timeZone = useUserTimeZone()
  return useMemo(
    () => ({
      timeZone,
      formatMatchTime: (scheduledAt: unknown) => formatMatchTime(scheduledAt, timeZone),
      formatMatchHour: (scheduledAt: unknown) => formatMatchHour(scheduledAt, timeZone),
      timeZoneShort: formatTimeZoneShort(timeZone),
    }),
    [timeZone],
  )
}
