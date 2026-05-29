/**
 * Recalcula standings con la misma lógica de puntuación que el cliente (src/services).
 * La escritura en Firestore replica recalculateRoom de Cloud Functions.
 */
import { FieldValue, type Firestore } from 'firebase-admin/firestore'
import { assignRanks, computeScoresForRoom } from '../../src/services/aggregateScores.ts'
import { filterPredictionsForStandings, loadFinalizedUserIds } from './loadFinalizedUserIds.ts'
import type { MatchDoc, PredictionDoc, TournamentResultDoc } from '../../src/types/predictions.ts'

export type RecalculateStandingsSummary = {
  roomId: string
  ok: boolean
  error?: string
}

type RoomMemberLite = { userId: string; displayName?: string }
type RoomLite = { type?: 'private' | 'global'; enabledQuestionIds?: string[] }
type UserProfileLite = { username?: string; email?: string }

async function getAllRoomIds(db: Firestore): Promise<string[]> {
  const snap = await db.collection('rooms').get()
  const ids = snap.docs.map((d) => d.id)
  if (!ids.includes('global')) ids.unshift('global')
  return [...new Set(ids)]
}

function isUidPlaceholder(name: string | undefined, userId: string): boolean {
  const s = name?.trim()
  if (!s) return true
  return s === userId
}

function resolveDisplayName(
  userId: string,
  memberDisplayName: string | undefined,
  profile?: UserProfileLite,
): string {
  const member = memberDisplayName?.trim()
  if (member && !isUidPlaceholder(member, userId)) return member
  const username = profile?.username?.trim()
  if (username) return username
  const emailLocal = profile?.email?.split('@')[0]?.trim()
  if (emailLocal) return emailLocal
  return userId
}

async function loadUserProfiles(
  db: Firestore,
  userIds: string[],
): Promise<Map<string, UserProfileLite>> {
  const map = new Map<string, UserProfileLite>()
  await Promise.all(
    userIds.map(async (uid) => {
      const snap = await db.collection('users').doc(uid).get()
      if (!snap.exists) return
      map.set(uid, snap.data() as UserProfileLite)
    }),
  )
  return map
}

async function recalculateStandingsForRoom(db: Firestore, roomId: string): Promise<void> {
  const predsSnap = await db.collection('predictions').where('roomId', '==', roomId).get()
  const predictions: PredictionDoc[] = []
  predsSnap.forEach((d) => {
    predictions.push({ id: d.id, ...(d.data() as PredictionDoc) })
  })

  const matchesSnap = await db.collection('matches').get()
  const matchesById = new Map<string, MatchDoc>()
  matchesSnap.forEach((d) => {
    matchesById.set(d.id, d.data() as MatchDoc)
  })

  const trSnap = await db.collection('tournamentResults').get()
  const tournamentResultsByQuestionId = new Map<string, TournamentResultDoc>()
  trSnap.forEach((d) => {
    const data = d.data() as TournamentResultDoc
    tournamentResultsByQuestionId.set(d.id, { ...data, questionId: d.id })
  })

  const roomSnap = await db.collection('rooms').doc(roomId).get()
  const room = (roomSnap.data() ?? {}) as RoomLite
  const roomType = room.type ?? (roomId === 'global' ? 'global' : 'private')
  const enabledQuestionIds =
    roomType === 'private' && Array.isArray(room.enabledQuestionIds) && room.enabledQuestionIds.length > 0
      ? new Set(room.enabledQuestionIds)
      : null

  const predictionUserIds = [...new Set(predictions.map((p) => p.userId))]
  const finalizedUserIds = await loadFinalizedUserIds(db, roomId, predictionUserIds)
  const scoringPredictions = filterPredictionsForStandings(predictions, finalizedUserIds)

  const scores = computeScoresForRoom(
    scoringPredictions,
    matchesById,
    tournamentResultsByQuestionId,
    enabledQuestionIds,
  )

  const memberRawNameByUserId = new Map<string, string>()
  if (roomType === 'private') {
    const membersSnap = await db.collection('roomMembers').where('roomId', '==', roomId).get()
    membersSnap.forEach((d) => {
      const data = d.data() as RoomMemberLite
      if (typeof data.userId !== 'string' || data.userId.length === 0) return
      memberRawNameByUserId.set(data.userId, data.displayName?.trim() ?? '')
      if (!scores.has(data.userId)) {
        scores.set(data.userId, {
          points: 0,
          breakdown: {
            matchPoints: 0,
            tournamentPoints: 0,
            advancementPoints: 0,
            specialsPoints: 0,
            playerPickPoints: 0,
          },
          tieBreak: {
            exactScoreHits: 0,
            specialQuestionHits: 0,
            championHit: false,
          },
        })
      }
    })
  }

  const allUserIds = new Set([...scores.keys(), ...memberRawNameByUserId.keys()])
  const profiles = await loadUserProfiles(db, [...allUserIds])
  const displayNameByUserId = new Map<string, string>()
  for (const uid of allUserIds) {
    displayNameByUserId.set(
      uid,
      resolveDisplayName(uid, memberRawNameByUserId.get(uid), profiles.get(uid)),
    )
  }

  const ranked = assignRanks(scores)
  const existingStandingsSnap = await db.collection('standings').doc(roomId).collection('users').get()
  const previousRankByUserId = new Map<string, number>()
  existingStandingsSnap.forEach((d) => {
    const prev = d.data().rank
    if (typeof prev === 'number' && Number.isFinite(prev)) previousRankByUserId.set(d.id, prev)
  })
  const existingUserIds = new Set(existingStandingsSnap.docs.map((d) => d.id))
  const nextUserIds = new Set(ranked.keys())

  const writer = db.bulkWriter()
  for (const [uid, row] of ranked) {
    const ref = db.collection('standings').doc(roomId).collection('users').doc(uid)
    const prevRank = previousRankByUserId.get(uid)
    const rankDelta = typeof prevRank === 'number' ? prevRank - row.rank : 0
    writer.set(ref, {
      userId: uid,
      displayName: displayNameByUserId.get(uid) ?? uid,
      points: row.points,
      rank: row.rank,
      rankDelta,
      breakdown: row.breakdown,
      tieBreak: row.tieBreak,
      updatedAt: FieldValue.serverTimestamp(),
    })
  }
  for (const uid of existingUserIds) {
    if (!nextUserIds.has(uid)) {
      writer.delete(db.collection('standings').doc(roomId).collection('users').doc(uid))
    }
  }
  await writer.close()
}

export async function runRecalculateStandings(
  db: Firestore,
  options?: { roomIds?: string[] },
): Promise<RecalculateStandingsSummary[]> {
  const roomIds = options?.roomIds?.length ? options.roomIds : await getAllRoomIds(db)
  const results: RecalculateStandingsSummary[] = []

  for (const roomId of roomIds) {
    try {
      await recalculateStandingsForRoom(db, roomId)
      results.push({ roomId, ok: true })
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      results.push({ roomId, ok: false, error })
    }
  }

  return results
}

export async function logRecalculateStandingsSummary(
  db: Firestore,
  options?: { roomIds?: string[]; label?: string },
): Promise<void> {
  const label = options?.label ?? 'recalculate:standings'
  const results = await runRecalculateStandings(db, options)
  for (const row of results) {
    if (row.ok) {
      const snap = await db.collection('standings').doc(row.roomId).collection('users').get()
      const top = snap.docs
        .map((d) => d.data() as { userId?: string; points?: number; rank?: number; displayName?: string })
        .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
        .slice(0, 3)
        .map((r) => ({ name: r.displayName, points: r.points, rank: r.rank }))
      console.log(`[${label}] ${row.roomId}: ${snap.size} usuarios`, top)
    } else {
      console.error(`[${label}] ${row.roomId} ERROR:`, row.error)
    }
  }
}
