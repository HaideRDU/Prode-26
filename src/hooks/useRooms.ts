import { doc, getDoc, onSnapshot, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../firebase'
import { getRoom, roomMembersCollectionRef } from '../services/roomsService'
import type { RoomDoc } from '../types/predictions'

export interface RoomSummary {
  roomId: string
  room: RoomDoc
  /** Puntos del usuario en esa sala (desde standings si existe) */
  myPoints: number | null
  /** Posición del usuario (desde standings) */
  myRank: number | null
}

export function useRooms(userId: string | undefined): {
  rooms: RoomSummary[]
  error: string | null
  loading: boolean
} {
  const [rooms, setRooms] = useState<RoomSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db || !userId) {
      setRooms([])
      setLoading(false)
      return
    }

    const col = roomMembersCollectionRef()
    if (!col) {
      setLoading(false)
      return
    }

    const q = query(col, where('userId', '==', userId))
    const unsub = onSnapshot(
      q,
      async (snap) => {
        const summaries: RoomSummary[] = []
        for (const d of snap.docs) {
          const data = d.data() as { roomId: string }
          const roomId = data.roomId
          const room = await getRoom(roomId)
          if (!room) continue
          let myPoints: number | null = null
          let myRank: number | null = null
          try {
            if (!db) continue
            const st = await getDoc(doc(db, 'standings', roomId, 'users', userId))
            if (st.exists()) {
              const stData = st.data() as { points?: number; rank?: number }
              myPoints = stData.points ?? null
              myRank = stData.rank ?? null
            }
          } catch {
            /* standings aún vacíos */
          }
          summaries.push({ roomId, room, myPoints, myRank })
        }
        setRooms(summaries)
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )
    return () => unsub()
  }, [userId])

  return { rooms, error, loading }
}
