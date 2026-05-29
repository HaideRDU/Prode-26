import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import type { TournamentResultDoc } from '../types/predictions'

export function useTournamentResults(): {
  tournamentResultsByQuestionId: Map<string, TournamentResultDoc>
  loading: boolean
  error: string | null
} {
  const [tournamentResultsByQuestionId, setMap] = useState<Map<string, TournamentResultDoc>>(
    () => new Map(),
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!db) {
      setMap(new Map())
      setLoading(false)
      return
    }
    setLoading(true)
    const unsub = onSnapshot(
      collection(db, 'tournamentResults'),
      (snap) => {
        const next = new Map<string, TournamentResultDoc>()
        snap.forEach((d) => {
          const data = d.data() as TournamentResultDoc
          next.set(d.id, { ...data, questionId: d.id })
        })
        setMap(next)
        setLoading(false)
        setError(null)
      },
      (err) => {
        setMap(new Map())
        setError(err.message)
        setLoading(false)
      },
    )
    return () => unsub()
  }, [])

  return { tournamentResultsByQuestionId, loading, error }
}
