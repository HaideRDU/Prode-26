import { useEffect, useRef, useState } from 'react'
import { DEFAULT_RULESET } from '../config/ruleset'
import { normalizeAmericasTimeZone } from '../data/americasTimezones'
import { countdownPartsInTimeZone } from '../utils/tournamentCountdownLocal'
import { formatDateTimeInZone, formatTimeZoneShort } from '../utils/formatMatchTime'

export interface TournamentCountdownParts {
  days: number
  hours: number
  minutes: number
  seconds: number
  started: boolean
}

const TOURNAMENT_START_MS = new Date(DEFAULT_RULESET.tournamentStartsAtIso).getTime()

function partsForNow(nowMs: number, timeZone: string): TournamentCountdownParts {
  return countdownPartsInTimeZone(nowMs, TOURNAMENT_START_MS, timeZone)
}

export function useTournamentCountdown(timeZone: string): TournamentCountdownParts {
  const tz = normalizeAmericasTimeZone(timeZone)
  const tzRef = useRef(tz)
  tzRef.current = tz

  const [parts, setParts] = useState<TournamentCountdownParts>(() => partsForNow(Date.now(), tz))

  useEffect(() => {
    setParts(partsForNow(Date.now(), tz))
  }, [tz])

  useEffect(() => {
    const tick = () => setParts(partsForNow(Date.now(), tzRef.current))
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])

  return parts
}

/** Pitido inicial formateado en la zona horaria del perfil del usuario. */
export function tournamentKickoffLabel(timeZone: string): string {
  const tz = normalizeAmericasTimeZone(timeZone)
  const at = new Date(TOURNAMENT_START_MS)
  const when = formatDateTimeInZone(TOURNAMENT_START_MS, tz)
  const tzShort = formatTimeZoneShort(tz, at)
  return `Inicio oficial: ${when} (${tzShort})`
}
