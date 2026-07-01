import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { GLOBAL_ROOM_ID } from '../constants/rooms'
import { db } from '../firebase'
import type { RoomMemberDoc } from '../types/predictions'

const ROOM_MEMBERS = 'roomMembers'

/** Miembros de la sala (id, displayName) — solo lectura. */
export function useRoomMembers(roomId: string | undefined): {
  members: (RoomMemberDoc & { id: string })[]
  loading: boolean
} {
  const [members, setMembers] = useState<(RoomMemberDoc & { id: string })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db || !roomId) {
      setMembers([])
      setLoading(false)
      return
    }
    setLoading(true)
    if (roomId === GLOBAL_ROOM_ID) {
      const unsub = onSnapshot(
        collection(db, 'standings', roomId, 'users'),
        (snap) => {
          const list: (RoomMemberDoc & { id: string })[] = []
          snap.forEach((d) => {
            const data = d.data() as { userId?: string; displayName?: string; updatedAt?: unknown }
            const userId = data.userId || d.id
            list.push({
              id: d.id,
              roomId,
              userId,
              joinedAt: data.updatedAt ?? null,
              displayName: data.displayName?.trim() || userId,
            })
          })
          setMembers(list)
          setLoading(false)
        },
        () => {
          setMembers([])
          setLoading(false)
        },
      )
      return () => unsub()
    }

    const q = query(collection(db, ROOM_MEMBERS), where('roomId', '==', roomId))
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: (RoomMemberDoc & { id: string })[] = []
        snap.forEach((d) => {
          list.push({ ...(d.data() as RoomMemberDoc), id: d.id })
        })
        setMembers(list)
        setLoading(false)
      },
      () => {
        setMembers([])
        setLoading(false)
      },
    )
    return () => unsub()
  }, [roomId])

  return { members, loading }
}
