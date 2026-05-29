import { useEffect, useState } from 'react'
import type { PredictionDoc } from '../types/predictions'
import { subscribePredictionsForRoom } from '../services/predictionsService'

const predictionsCacheKey = (roomId: string, userId: string) => `${roomId}:${userId}`
const predictionsCache = new Map<string, PredictionDoc[]>()

export function usePredictions(
  roomId: string | undefined,
  userId: string | undefined,
): { predictions: PredictionDoc[]; error: string | null; loading: boolean } {
  const [predictions, setPredictions] = useState<PredictionDoc[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!roomId) {
      setPredictions([])
      setError(null)
      setLoading(false)
      return
    }
    if (!userId) {
      setLoading(true)
      return
    }
    const cacheKey = predictionsCacheKey(roomId, userId)
    const cached = predictionsCache.get(cacheKey)
    if (cached?.length) {
      setPredictions(cached)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setError(null)
    const unsub = subscribePredictionsForRoom(
      roomId,
      userId,
      (data) => {
        predictionsCache.set(cacheKey, data)
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
