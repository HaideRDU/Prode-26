import { useEffect, useState } from 'react'
import { DEFAULT_RULESET } from '../config/ruleset'

export interface TournamentCountdownParts {
  days: number
  hours: number
  minutes: number
  seconds: number
  started: boolean
}

const TOURNAMENT_START_MS = new Date(DEFAULT_RULESET.tournamentStartsAtIso).getTime()

function partsFromMs(nowMs: number): TournamentCountdownParts {
  if (nowMs >= TOURNAMENT_START_MS) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, started: true }
  }
  const totalSec = Math.floor((TOURNAMENT_START_MS - nowMs) / 1000)
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
    started: false,
  }
}

export function useTournamentCountdown(): TournamentCountdownParts {
  const [parts, setParts] = useState<TournamentCountdownParts>(() => partsFromMs(Date.now()))

  useEffect(() => {
    const tick = () => setParts(partsFromMs(Date.now()))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])

  return parts
}

export function tournamentKickoffLabel(): string {
  return new Date(DEFAULT_RULESET.tournamentStartsAtIso).toLocaleString('es-CO', {
    timeZone: DEFAULT_RULESET.timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
