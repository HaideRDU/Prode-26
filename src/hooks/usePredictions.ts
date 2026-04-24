import { useEffect, useState } from 'react'
import type { PredictionDoc } from '../types/predictions'
import { subscribePredictionsForRoom } from '../services/predictionsService'

export function usePredictions(
  roomId: string | undefined,
  userId: string | undefined,
): { predictions: PredictionDoc[]; error: string | null; loading: boolean } {
  const [predictions, setPredictions] = useState<PredictionDoc[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!roomId || !userId) {
      setPredictions([])
      setLoading(false)
      return
    }
    setLoading(true)
    const unsub = subscribePredictionsForRoom(
      roomId,
      userId,
      (data) => {
        setPredictions(data)
        setLoading(false)
      },
      (e) => {
        setError(e.message)
        setLoading(false)
      },
    )
    return () => {
      unsub?.()
    }
  }, [roomId, userId])

  return { predictions, error, loading }
}
