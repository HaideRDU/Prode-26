import { useEffect, useMemo, useState } from 'react'
import { matchTeamAId, matchTeamBId } from '../domain/matchFields'
import { playerDocToKey, subscribeTeamPlayers } from '../services/teamsService'
import { resolvePlayerPickName } from '../utils/playerKeyMatch'
import type { MatchDoc, TeamPlayerDoc } from '../types/predictions'

/**
 * Resuelve playerKey → nombre legible para las elecciones de jugador por partido.
 */
export function usePlayerPickDisplayLabels(
  matches: (MatchDoc & { id: string })[],
  picksByMatchId: Record<string, string>,
): { labelByMatchId: Record<string, string>; nameByPlayerKey: Record<string, string>; loading: boolean } {
  const [nameByPlayerKey, setNameByPlayerKey] = useState<Record<string, string>>({})
  const [playersByTeamId, setPlayersByTeamId] = useState<Record<string, (TeamPlayerDoc & { id: string })[]>>({})
  const [loading, setLoading] = useState(false)

  const teamIds = useMemo(() => {
    const ids = new Set<string>()
    const matchById = new Map(matches.map((m) => [m.id, m]))
    for (const matchId of Object.keys(picksByMatchId)) {
      const m = matchById.get(matchId)
      if (!m) continue
      const a = matchTeamAId(m)
      const b = matchTeamBId(m)
      if (a) ids.add(a)
      if (b) ids.add(b)
    }
    return [...ids]
  }, [matches, picksByMatchId])

  useEffect(() => {
    if (teamIds.length === 0) {
      setNameByPlayerKey({})
      setPlayersByTeamId({})
      setLoading(false)
      return
    }
    setLoading(true)
    const names: Record<string, string> = {}
    const rosterByTeam: Record<string, (TeamPlayerDoc & { id: string })[]> = {}
    const loadedTeams = new Set<string>()
    let cancelled = false

    function mergePlayers(players: (TeamPlayerDoc & { id: string })[]) {
      for (const p of players) {
        const key = playerDocToKey(p)
        if (!names[key]) names[key] = p.name
      }
    }

    function markTeamLoaded(teamId: string) {
      loadedTeams.add(teamId)
      if (!cancelled && loadedTeams.size >= teamIds.length) {
        setNameByPlayerKey({ ...names })
        setLoading(false)
      }
    }

    const unsubs = teamIds.map((teamId) =>
      subscribeTeamPlayers(
        teamId,
        (players) => {
          mergePlayers(players)
          rosterByTeam[teamId] = players
          markTeamLoaded(teamId)
          if (!cancelled && loadedTeams.size >= teamIds.length) {
            setNameByPlayerKey({ ...names })
            setPlayersByTeamId({ ...rosterByTeam })
          }
        },
        () => {
          rosterByTeam[teamId] = []
          markTeamLoaded(teamId)
        },
      ),
    )

    return () => {
      cancelled = true
      for (const u of unsubs) u?.()
    }
  }, [teamIds.join('|')])

  const labelByMatchId = useMemo(() => {
    const matchById = new Map(matches.map((m) => [m.id, m]))
    const out: Record<string, string> = {}
    for (const [matchId, playerKey] of Object.entries(picksByMatchId)) {
      const trimmed = playerKey.trim()
      if (!trimmed) continue
      const m = matchById.get(matchId)
      const rosterPlayers: (TeamPlayerDoc & { id: string })[] = []
      if (m) {
        const a = matchTeamAId(m)
        const b = matchTeamBId(m)
        if (a && playersByTeamId[a]) rosterPlayers.push(...playersByTeamId[a])
        if (b && playersByTeamId[b]) rosterPlayers.push(...playersByTeamId[b])
      }
      out[matchId] = resolvePlayerPickName(rosterPlayers, trimmed) ?? nameByPlayerKey[trimmed] ?? trimmed
    }
    return out
  }, [picksByMatchId, nameByPlayerKey, playersByTeamId, matches])

  return { labelByMatchId, nameByPlayerKey, loading }
}
