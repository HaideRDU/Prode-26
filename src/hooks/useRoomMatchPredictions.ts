import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import type { PredictionDoc } from '../types/predictions'

const PREDICTIONS = 'predictions'

type Listener = (rows: PredictionDoc[]) => void

const cache = new Map<string, PredictionDoc[]>()
const listenersByRoom = new Map<string, Set<Listener>>()
const unsubByRoom = new Map<string, () => void>()

function ensureSubscription(roomId: string) {
  if (unsubByRoom.has(roomId) || !db) return
  const q = query(collection(db, PREDICTIONS), where('roomId', '==', roomId))
  const unsub = onSnapshot(q, (snap) => {
    const list: PredictionDoc[] = []
    snap.forEach((d) => {
      list.push({ ...(d.data() as PredictionDoc), id: d.id })
    })
    cache.set(roomId, list)
    listenersByRoom.get(roomId)?.forEach((cb) => cb(list))
  })
  unsubByRoom.set(roomId, unsub)
}

/**
 * Predicciones de TODOS los partidos de la sala (solo lectura), con cache compartida
 * entre componentes: un único listener por sala, reutilizado al cambiar de partido
 * en el carrusel para evitar llamadas repetidas a Firestore.
 */
export function useRoomPredictions(roomId: string | undefined): {
  predictions: PredictionDoc[]
  loading: boolean
} {
  const [predictions, setPredictions] = useState<PredictionDoc[]>(() =>
    roomId ? cache.get(roomId) ?? [] : [],
  )
  const [loading, setLoading] = useState(() => Boolean(roomId) && !cache.has(roomId ?? ''))

  useEffect(() => {
    if (!db || !roomId) {
      setPredictions([])
      setLoading(false)
      return
    }
    const cached = cache.get(roomId)
    if (cached) {
      setPredictions(cached)
      setLoading(false)
    } else {
      setLoading(true)
    }
    const cb: Listener = (rows) => {
      setPredictions(rows)
      setLoading(false)
    }
    let set = listenersByRoom.get(roomId)
    if (!set) {
      set = new Set()
      listenersByRoom.set(roomId, set)
    }
    set.add(cb)
    ensureSubscription(roomId)
    return () => {
      set?.delete(cb)
    }
  }, [roomId])

  return { predictions, loading }
}
