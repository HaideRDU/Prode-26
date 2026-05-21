import { useEffect, useMemo, useState } from 'react'
import { subscribePredictionsForRoom } from '../services/predictionsService'
import type { PlayerPerMatchPayload, PredictionDoc } from '../types/predictions'

function isPlayerPerMatchPayload(p: unknown): p is PlayerPerMatchPayload {
  return (
    typeof p === 'object' &&
    p !== null &&
    (p as PlayerPerMatchPayload).kind === 'player_match_pick' &&
    typeof (p as PlayerPerMatchPayload).playerKey === 'string'
  )
}

export function usePlayerPerMatchPicks(
  roomId: string | undefined,
  userId: string | undefined,
): { picksByMatchId: Record<string, string>; loading: boolean } {
  const [rows, setRows] = useState<PredictionDoc[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!roomId || !userId) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    const unsub = subscribePredictionsForRoom(
      roomId,
      userId,
      (list) => {
        setRows(list)
        setLoading(false)
      },
      () => {
        setRows([])
        setLoading(false)
      },
    )
    return () => unsub?.()
  }, [roomId, userId])

  const picksByMatchId = useMemo(() => {
    const map: Record<string, string> = {}
    for (const pr of rows) {
      if (pr.scope !== 'player_per_match' || !pr.matchId) continue
      if (!isPlayerPerMatchPayload(pr.payload)) continue
      map[pr.matchId] = pr.payload.playerKey
    }
    return map
  }, [rows])

  return { picksByMatchId, loading }
}
