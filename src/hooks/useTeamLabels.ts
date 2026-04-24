import { useEffect, useMemo, useState } from 'react'
import { subscribeTeams } from '../services/teamsService'

/** Mapa teamId (ISO-3) → nombre en español; si Firestore está vacío, el fallback es el propio id. */
export function useTeamLabels(): {
  label: (teamId: string) => string
  loading: boolean
  error: string | null
} {
  const [byId, setById] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unsub = subscribeTeams(
      (teams) => {
        const m = new Map<string, string>()
        for (const t of teams) {
          const id = t.teamId.trim().toUpperCase()
          m.set(id, t.nameEs)
        }
        setById(m)
        setLoading(false)
        setError(null)
      },
      (e) => {
        setError(e.message)
        setLoading(false)
      },
    )
    return () => unsub?.()
  }, [])

  const label = useMemo(
    () => (teamId: string) => byId.get(teamId.trim().toUpperCase()) ?? teamId,
    [byId],
  )

  return { label, loading, error }
}
