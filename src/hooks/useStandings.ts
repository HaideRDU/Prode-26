import { useEffect, useState } from 'react'
import type { StandingRow } from '../services/standingsService'
import { subscribeStandingsForRoom } from '../services/standingsService'
import { GLOBAL_ROOM_ID } from '../constants/rooms'

export function useStandings(roomId: string | undefined, currentUserId?: string): {
  standings: StandingRow[]
  error: string | null
  loading: boolean
  isGlobalRoom: boolean
} {
  const [standings, setStandings] = useState<StandingRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(!!roomId)
  const isGlobalRoom = roomId === GLOBAL_ROOM_ID

  useEffect(() => {
    if (!roomId) {
      setStandings([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const unsub = subscribeStandingsForRoom(
      roomId,
      currentUserId,
      (data) => {
        setStandings(data)
        setLoading(false)
      },
      (e) => {
        setStandings([])
        setError(e.message)
        setLoading(false)
      },
    )
    return () => {
      unsub?.()
    }
  }, [roomId, currentUserId])

  return { standings, error, loading, isGlobalRoom }
}
