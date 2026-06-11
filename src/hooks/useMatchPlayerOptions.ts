import { useEffect, useMemo, useState } from 'react'
import { playerDocToKey, subscribeTeamPlayers } from '../services/teamsService'
import type { MatchDoc, TeamPlayerDoc } from '../types/predictions'

export type MatchPlayerOption = {
  playerKey: string
  name: string
  teamId: string
  side: 'teamA' | 'teamB'
  theSportsDbPlayerId?: string
}

export function useMatchPlayerOptions(match: MatchDoc | null | undefined): {
  options: MatchPlayerOption[]
  loading: boolean
  hasRoster: boolean
} {
  const [teamAPlayers, setTeamAPlayers] = useState<(TeamPlayerDoc & { id: string })[]>([])
  const [teamBPlayers, setTeamBPlayers] = useState<(TeamPlayerDoc & { id: string })[]>([])
  const [loading, setLoading] = useState(true)

  const teamAId = match?.teamAId ?? match?.teamHomeId
  const teamBId = match?.teamBId ?? match?.teamAwayId

  useEffect(() => {
    if (!teamAId || !teamBId) {
      setTeamAPlayers([])
      setTeamBPlayers([])
      setLoading(false)
      return
    }
    setLoading(true)
    let teamAReady = false
    let teamBReady = false
    const unsubTeamA = subscribeTeamPlayers(
      teamAId,
      (rows) => {
        setTeamAPlayers(rows)
        teamAReady = true
        if (teamBReady) setLoading(false)
      },
      () => {
        setTeamAPlayers([])
        teamAReady = true
        if (teamBReady) setLoading(false)
      },
    )
    const unsubTeamB = subscribeTeamPlayers(
      teamBId,
      (rows) => {
        setTeamBPlayers(rows)
        teamBReady = true
        if (teamAReady) setLoading(false)
      },
      () => {
        setTeamBPlayers([])
        teamBReady = true
        if (teamAReady) setLoading(false)
      },
    )
    return () => {
      unsubTeamA?.()
      unsubTeamB?.()
    }
  }, [teamAId, teamBId])

  const options = useMemo(() => {
    const list: MatchPlayerOption[] = []
    const seen = new Set<string>()
    for (const p of teamAPlayers) {
      const key = playerDocToKey(p)
      if (seen.has(key)) continue
      seen.add(key)
      list.push({
        playerKey: key,
        name: p.name,
        teamId: teamAId!,
        side: 'teamA',
        theSportsDbPlayerId: p.theSportsDbPlayerId,
      })
    }
    for (const p of teamBPlayers) {
      const key = playerDocToKey(p)
      if (seen.has(key)) continue
      seen.add(key)
      list.push({
        playerKey: key,
        name: p.name,
        teamId: teamBId!,
        side: 'teamB',
        theSportsDbPlayerId: p.theSportsDbPlayerId,
      })
    }
    list.sort((a, b) => a.name.localeCompare(b.name, 'es'))
    return list
  }, [teamAPlayers, teamBPlayers, teamAId, teamBId])

  const hasRoster = options.length > 0

  return { options, loading, hasRoster }
}
