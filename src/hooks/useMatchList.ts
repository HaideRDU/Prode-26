import { useEffect, useState } from 'react'
import type { MatchDoc } from '../types/predictions'
import { subscribeMatches } from '../services/matchesService'

export function useMatchList(): {
  matches: (MatchDoc & { id: string })[]
  error: string | null
  loading: boolean
} {
  const [matches, setMatches] = useState<(MatchDoc & { id: string })[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const unsub = subscribeMatches(
      (data) => {
        setMatches(data)
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
  }, [])

  return { matches, error, loading }
}
