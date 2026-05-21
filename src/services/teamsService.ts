import { collection, onSnapshot, query, type Unsubscribe } from 'firebase/firestore'
import { db } from '../firebase'
import type { TeamDoc, TeamPlayerDoc } from '../types/predictions'

const TEAMS = 'teams'

export function subscribeTeams(
  onData: (teams: (TeamDoc & { id: string })[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe | null {
  if (!db) {
    onData([])
    return null
  }
  const q = query(collection(db, TEAMS))
  return onSnapshot(
    q,
    (snap) => {
      const list: (TeamDoc & { id: string })[] = []
      snap.forEach((d) => {
        list.push({ ...(d.data() as TeamDoc), id: d.id })
      })
      onData(list)
    },
    (err) => onError?.(err instanceof Error ? err : new Error(String(err))),
  )
}

export function subscribeTeamPlayers(
  teamId: string,
  onData: (players: (TeamPlayerDoc & { id: string })[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe | null {
  if (!db) {
    onData([])
    return null
  }
  const q = query(collection(db, TEAMS, teamId, 'players'))
  return onSnapshot(
    q,
    (snap) => {
      const list: (TeamPlayerDoc & { id: string })[] = []
      snap.forEach((d) => {
        list.push({ ...(d.data() as TeamPlayerDoc), id: d.id })
      })
      onData(list)
    },
    (err) => onError?.(err instanceof Error ? err : new Error(String(err))),
  )
}

/** Clave estable para predicciones: sticker Panini o id del documento. */
export function playerDocToKey(player: TeamPlayerDoc & { id: string }): string {
  return player.paniniStickerCode?.trim() || player.id
}
