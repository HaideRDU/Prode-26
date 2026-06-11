import { useEffect, useMemo, useState } from 'react'
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import type { StandingRow } from '../services/standingsService'
import { subscribeStandingsForRoom } from '../services/standingsService'
import { GLOBAL_ROOM_ID } from '../constants/rooms'
import type { RoomMemberDoc } from '../types/predictions'
import { isUidPlaceholder, resolvePlayerLabel } from '../utils/memberDisplayName'
import { applyDisplayRanks } from '../utils/rankMovement'

type UserLabelMeta = { username?: string; email?: string }

export function useStandings(roomId: string | undefined, currentUserId?: string): {
  standings: StandingRow[]
  error: string | null
  loading: boolean
  isGlobalRoom: boolean
} {
  const [rawStandings, setRawStandings] = useState<StandingRow[]>([])
  const [memberNames, setMemberNames] = useState<Record<string, string>>({})
  const [userMetaById, setUserMetaById] = useState<Record<string, UserLabelMeta>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(!!roomId)
  const isGlobalRoom = roomId === GLOBAL_ROOM_ID
  useEffect(() => {
    setUserMetaById({})
    setRawStandings([])
    setLoading(!!roomId)
  }, [roomId])

  useEffect(() => {
    if (!roomId) {
      return
    }
    setError(null)
    const unsub = subscribeStandingsForRoom(
      roomId,
      currentUserId,
      (data) => {
        setRawStandings(data)
        setLoading(false)
      },
      (e) => {
        setError(e.message)
        setLoading(false)
      },
    )
    return () => {
      unsub?.()
    }
  }, [roomId, currentUserId])

  useEffect(() => {
    if (!db || !roomId || roomId === GLOBAL_ROOM_ID) {
      setMemberNames({})
      return
    }
    const q = query(collection(db, 'roomMembers'), where('roomId', '==', roomId))
    return onSnapshot(
      q,
      (snap) => {
        const next: Record<string, string> = {}
        snap.forEach((d) => {
          const data = d.data() as RoomMemberDoc
          if (typeof data.userId === 'string' && data.userId) {
            next[data.userId] = data.displayName ?? ''
          }
        })
        setMemberNames(next)
      },
      () => setMemberNames({}),
    )
  }, [roomId])

  useEffect(() => {
    if (!db || rawStandings.length === 0) return
    let cancelled = false
    const uidsToFetch = [
      ...new Set(
        rawStandings
          .filter((row) =>
            isUidPlaceholder(
              resolvePlayerLabel(row.userId, {
                standingsDisplayName: row.displayName,
                memberDisplayName: memberNames[row.userId],
                username: userMetaById[row.userId]?.username,
                email: userMetaById[row.userId]?.email,
              }),
              row.userId,
            ),
          )
          .map((row) => row.userId),
      ),
    ].filter((uid) => !userMetaById[uid])

    if (uidsToFetch.length === 0) return

    void (async () => {
      const fetched: Record<string, UserLabelMeta> = {}
      await Promise.all(
        uidsToFetch.map(async (uid) => {
          const snap = await getDoc(doc(db!, 'users', uid))
          if (!snap.exists()) return
          const data = snap.data() as { username?: string; email?: string }
          fetched[uid] = {
            username: typeof data.username === 'string' ? data.username : undefined,
            email: typeof data.email === 'string' ? data.email : undefined,
          }
        }),
      )
      if (cancelled || Object.keys(fetched).length === 0) return
      setUserMetaById((prev) => ({ ...prev, ...fetched }))
    })()

    return () => {
      cancelled = true
    }
  }, [rawStandings, memberNames, userMetaById])

  const standings = useMemo(() => {
    if (!roomId) return []
    const withNames = rawStandings.map((row) => ({
      ...row,
      displayName: resolvePlayerLabel(row.userId, {
        standingsDisplayName: row.displayName,
        memberDisplayName: memberNames[row.userId],
        username: userMetaById[row.userId]?.username,
        email: userMetaById[row.userId]?.email,
      }),
    }))
    const withRanks = applyDisplayRanks(withNames).sort((a, b) => {
      const rankA = Number.isFinite(a.rank) ? a.rank : Number.MAX_SAFE_INTEGER
      const rankB = Number.isFinite(b.rank) ? b.rank : Number.MAX_SAFE_INTEGER
      if (rankA !== rankB) return rankA - rankB
      if (a.points !== b.points) return b.points - a.points
      return a.userId.localeCompare(b.userId)
    })
    const rawByUserId = new Map(rawStandings.map((r) => [r.userId, r]))
    // rankDelta viene de Firestore (recalculateRoom: puesto anterior − puesto nuevo).
    return withRanks.map((row) => {
      const raw = rawByUserId.get(row.userId)
      const storedDelta =
        typeof raw?.rankDelta === 'number' && Number.isFinite(raw.rankDelta) ? raw.rankDelta : 0
      const firestoreRank = raw?.rank
      let rankDelta = storedDelta
      if (
        typeof firestoreRank === 'number' &&
        Number.isFinite(firestoreRank) &&
        Number.isFinite(row.rank) &&
        firestoreRank !== row.rank
      ) {
        const prevRank = firestoreRank + storedDelta
        rankDelta = prevRank - row.rank
      }
      return { ...row, rankDelta }
    })
  }, [rawStandings, memberNames, userMetaById, roomId])

  return { standings, error, loading, isGlobalRoom }
}
