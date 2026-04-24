import { collection, doc, onSnapshot, query, where, type Unsubscribe } from 'firebase/firestore'
import { db } from '../firebase'
import type { MatchDoc, PredictionDoc, RoomDoc, StandingUserDoc, TournamentResultDoc } from '../types/predictions'
import { assignRanks, computeScoresForRoom } from './aggregateScores'
import { GLOBAL_ROOM_ID } from '../constants/rooms'

export type StandingRow = StandingUserDoc & {
  id: string
  isCurrentUser?: boolean
  isOutsideTop50?: boolean
}
type RoomMemberLite = { roomId: string; userId: string; displayName?: string }

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

  let roomType: RoomDoc['type'] = roomId === GLOBAL_ROOM_ID ? 'global' : 'private'
  let predictions: PredictionDoc[] = []
  const matchesById = new Map<string, MatchDoc>()
  const tournamentResultsByQuestionId = new Map<string, TournamentResultDoc>()
  const memberNameByUserId = new Map<string, string>()

  function resolveDisplayName(uid: string): string {
    return memberNameByUserId.get(uid) ?? uid
  }

  function emitRows() {
    const scores = computeScoresForRoom(predictions, matchesById, tournamentResultsByQuestionId)
    if (roomType !== 'global') {
      for (const uid of memberNameByUserId.keys()) {
        if (!scores.has(uid)) {
          scores.set(uid, {
            points: 0,
            breakdown: { matchPoints: 0, tournamentPoints: 0 },
          })
        }
      }
    }
    const ranked = assignRanks(scores)
    const rows: StandingRow[] = [...ranked.entries()].map(([uid, row]) => ({
      id: uid,
      userId: uid,
      displayName: resolveDisplayName(uid),
      points: row.points,
      rank: row.rank,
      breakdown: row.breakdown,
      isCurrentUser: currentUserId ? uid === currentUserId : false,
    }))
    rows.sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank
      if (a.points !== b.points) return b.points - a.points
      return a.userId.localeCompare(b.userId)
    })

    if (roomType !== 'global') {
      onData(rows)
      return
    }

    const top = rows.slice(0, 50)
    if (!currentUserId) {
      onData(top)
      return
    }
    const mineInTop = top.some((r) => r.userId === currentUserId)
    if (mineInTop) {
      onData(top)
      return
    }
    const mine = rows.find((r) => r.userId === currentUserId)
    if (!mine) {
      onData(top)
      return
    }
    onData([...top, { ...mine, isCurrentUser: true, isOutsideTop50: true }])
  }

  const unsubs: Unsubscribe[] = []

  unsubs.push(
    onSnapshot(
      doc(db, 'rooms', roomId),
      (snap) => {
        if (snap.exists()) {
          const room = snap.data() as RoomDoc
          roomType = room.type ?? roomType
        } else {
          roomType = roomId === GLOBAL_ROOM_ID ? 'global' : 'private'
        }
        emitRows()
      },
      (err) => onError?.(err instanceof Error ? err : new Error(String(err))),
    ),
  )

  unsubs.push(
    onSnapshot(
      query(collection(db, 'predictions'), where('roomId', '==', roomId)),
      (snap) => {
        const list: PredictionDoc[] = []
        snap.forEach((d) => {
          const row = d.data() as PredictionDoc
          // Defensa adicional: nunca mezclar predicciones de otra sala.
          if (row.roomId !== roomId) return
          list.push({ ...row, id: d.id })
        })
        predictions = list
        emitRows()
      },
      (err) => onError?.(err instanceof Error ? err : new Error(String(err))),
    ),
  )

  unsubs.push(
    onSnapshot(
      collection(db, 'matches'),
      (snap) => {
        matchesById.clear()
        snap.forEach((d) => {
          matchesById.set(d.id, d.data() as MatchDoc)
        })
        emitRows()
      },
      (err) => onError?.(err instanceof Error ? err : new Error(String(err))),
    ),
  )

  unsubs.push(
    onSnapshot(
      collection(db, 'tournamentResults'),
      (snap) => {
        tournamentResultsByQuestionId.clear()
        snap.forEach((d) => {
          const data = d.data() as TournamentResultDoc
          tournamentResultsByQuestionId.set(d.id, { ...data, questionId: d.id })
        })
        emitRows()
      },
      (err) => onError?.(err instanceof Error ? err : new Error(String(err))),
    ),
  )

  unsubs.push(
    onSnapshot(
      query(collection(db, 'roomMembers'), where('roomId', '==', roomId)),
      (snap) => {
        memberNameByUserId.clear()
        snap.forEach((d) => {
          const m = d.data() as RoomMemberLite
          if (typeof m.userId === 'string' && m.userId.length > 0) {
            memberNameByUserId.set(m.userId, m.displayName?.trim() || m.userId)
          }
        })
        emitRows()
      },
      (err) => onError?.(err instanceof Error ? err : new Error(String(err))),
    ),
  )

  return () => {
    for (const u of unsubs) u()
  }
}
