import { collection, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { db } from '../firebase'
import type { StandingUserDoc } from '../types/predictions'
import { GLOBAL_ROOM_ID } from '../constants/rooms'

export type StandingRow = StandingUserDoc & {
  id: string
  isCurrentUser?: boolean
  isOutsideTop50?: boolean
}

export function subscribeStandingsForRoom(
  roomId: string,
  currentUserId: string | undefined,
  onData: (rows: StandingRow[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe | null {
  if (!db) {
    onData([])
    return null
  }
  const standingsRef = collection(db, 'standings', roomId, 'users')
  return onSnapshot(
    standingsRef,
    (snap) => {
      const rows: StandingRow[] = []
      snap.forEach((d) => {
        const data = d.data() as StandingUserDoc
        const userId = typeof data.userId === 'string' && data.userId ? data.userId : d.id
        rows.push({
          ...data,
          id: d.id,
          userId,
          displayName: data.displayName?.trim() || userId,
          isCurrentUser: currentUserId ? userId === currentUserId : false,
        })
      })

      rows.sort((a, b) => {
        const rankA = Number.isFinite(a.rank) ? a.rank : Number.MAX_SAFE_INTEGER
        const rankB = Number.isFinite(b.rank) ? b.rank : Number.MAX_SAFE_INTEGER
        if (rankA !== rankB) return rankA - rankB
        if (a.points !== b.points) return b.points - a.points
        return a.userId.localeCompare(b.userId)
      })

      if (roomId !== GLOBAL_ROOM_ID) {
        onData(rows)
        return
      }

      const top = rows.slice(0, 50)
      if (!currentUserId) {
        onData(top)
        return
      }

      const mineInTop = top.some((row) => row.userId === currentUserId)
      if (mineInTop) {
        onData(top)
        return
      }

      const mine = rows.find((row) => row.userId === currentUserId)
      if (!mine) {
        onData(top)
        return
      }

      onData([...top, { ...mine, isCurrentUser: true, isOutsideTop50: true }])
    },
    (err) => onError?.(err instanceof Error ? err : new Error(String(err))),
  )
}
