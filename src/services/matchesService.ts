import { collection, onSnapshot, query, type Unsubscribe } from 'firebase/firestore'
import { db } from '../firebase'
import type { MatchDoc } from '../types/predictions'

const MATCHES = 'matches'

export function subscribeMatches(
  onData: (matches: (MatchDoc & { id: string })[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe | null {
  if (!db) {
    onData([])
    return null
  }
  const q = query(collection(db, MATCHES))
  return onSnapshot(
    q,
    (snap) => {
      const list: (MatchDoc & { id: string })[] = []
      snap.forEach((d) => {
        list.push({ ...(d.data() as MatchDoc), id: d.id })
      })
      onData(list)
    },
    (err) => onError?.(err instanceof Error ? err : new Error(String(err))),
  )
}
