import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
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
