import { useEffect, useMemo, useState } from 'react'
import { playerDocToKey, subscribeTeamPlayers } from '../services/teamsService'
import type { MatchDoc, TeamPlayerDoc } from '../types/predictions'

export type MatchPlayerOption = {
  playerKey: string
  name: string
  teamId: string
  side: 'home' | 'away'
}

export function useMatchPlayerOptions(match: MatchDoc | null | undefined): {
  options: MatchPlayerOption[]
  loading: boolean
  hasRoster: boolean
} {
  const [homePlayers, setHomePlayers] = useState<(TeamPlayerDoc & { id: string })[]>([])
  const [awayPlayers, setAwayPlayers] = useState<(TeamPlayerDoc & { id: string })[]>([])
  const [loading, setLoading] = useState(true)

  const homeId = match?.teamHomeId
  const awayId = match?.teamAwayId

  useEffect(() => {
    if (!homeId || !awayId) {
      setHomePlayers([])
      setAwayPlayers([])
      setLoading(false)
      return
    }
    setLoading(true)
    let homeReady = false
    let awayReady = false
    const unsubHome = subscribeTeamPlayers(
      homeId,
      (rows) => {
        setHomePlayers(rows)
        homeReady = true
        if (awayReady) setLoading(false)
      },
      () => {
        setHomePlayers([])
        homeReady = true
        if (awayReady) setLoading(false)
      },
    )
    const unsubAway = subscribeTeamPlayers(
      awayId,
      (rows) => {
        setAwayPlayers(rows)
        awayReady = true
        if (homeReady) setLoading(false)
      },
      () => {
        setAwayPlayers([])
        awayReady = true
        if (homeReady) setLoading(false)
      },
    )
    return () => {
      unsubHome?.()
      unsubAway?.()
    }
  }, [homeId, awayId])

  const options = useMemo(() => {
    const list: MatchPlayerOption[] = []
    const seen = new Set<string>()
    for (const p of homePlayers) {
      const key = playerDocToKey(p)
      if (seen.has(key)) continue
      seen.add(key)
      list.push({ playerKey: key, name: p.name, teamId: homeId!, side: 'home' })
    }
    for (const p of awayPlayers) {
      const key = playerDocToKey(p)
      if (seen.has(key)) continue
      seen.add(key)
      list.push({ playerKey: key, name: p.name, teamId: awayId!, side: 'away' })
    }
    list.sort((a, b) => a.name.localeCompare(b.name, 'es'))
    return list
  }, [homePlayers, awayPlayers, homeId, awayId])

  const hasRoster = options.length > 0

  return { options, loading, hasRoster }
}
