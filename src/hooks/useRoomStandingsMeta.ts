import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { GLOBAL_ROOM_ID } from '../constants/rooms'
import type { StandingRow } from '../services/standingsService'
import { subscribeMatches } from '../services/matchesService'
import type { MatchDoc } from '../types/predictions'
import {
  formatMatchUpdateLabel,
  pickLatestFinishedMatch,
  tournamentProgressPercent,
} from '../utils/matchUpdateLabel'

export type RoomStandingsMeta = {
  lastUpdateLabel: string | null
  participantsCount: number
  tournamentProgressPct: number
  /** Suma de marcadores exactos de todos los participantes en la sala. */
  totalExactHits: number
  /** Puntos del jugador que va primero en la clasificación. */
  leaderPoints: number
  matchesLoading: boolean
}

const EMPTY_META: RoomStandingsMeta = {
  lastUpdateLabel: null,
  participantsCount: 0,
  tournamentProgressPct: 0,
  totalExactHits: 0,
  leaderPoints: 0,
  matchesLoading: true,
}

export function useRoomStandingsMeta(
  roomId: string | undefined,
  standings: StandingRow[],
): RoomStandingsMeta {
  const [matches, setMatches] = useState<(MatchDoc & { id: string })[]>([])
  const [matchesLoading, setMatchesLoading] = useState(true)
  const [participantsCount, setParticipantsCount] = useState(0)

  useEffect(() => {
    setMatchesLoading(true)
    const unsub = subscribeMatches(
      (data) => {
        setMatches(data)
        setMatchesLoading(false)
      },
      () => {
        setMatches([])
        setMatchesLoading(false)
      },
    )
    return () => unsub?.()
  }, [])

  useEffect(() => {
    if (!db || !roomId) {
      setParticipantsCount(0)
      return
    }
    if (roomId === GLOBAL_ROOM_ID) {
      setParticipantsCount(standings.length)
      return
    }
    const q = query(collection(db, 'roomMembers'), where('roomId', '==', roomId))
    return onSnapshot(
      q,
      (snap) => setParticipantsCount(snap.size),
      () => setParticipantsCount(standings.length),
    )
  }, [roomId, standings.length])

  return useMemo(() => {
    if (!roomId) return EMPTY_META

    const latest = pickLatestFinishedMatch(matches)
    const totalExactHits = standings.reduce(
      (sum, r) => sum + (r.tieBreak?.exactScoreHits ?? 0),
      0,
    )
    const leaderPoints = standings.reduce((max, r) => Math.max(max, r.points ?? 0), 0)

    return {
      lastUpdateLabel: latest
        ? `${formatMatchUpdateLabel(latest)} finalizado`
        : matchesLoading
          ? null
          : 'Sin partidos finalizados aún',
      participantsCount: participantsCount || standings.length,
      tournamentProgressPct: tournamentProgressPercent(matches),
      totalExactHits,
      leaderPoints,
      matchesLoading,
    }
  }, [roomId, matches, matchesLoading, participantsCount, standings])
}
