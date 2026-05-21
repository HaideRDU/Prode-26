import type { Firestore } from 'firebase-admin/firestore'
import * as admin from 'firebase-admin'
import type { MatchDoc, PredictionDoc, TournamentResultDoc } from './lib/types/predictions'
import { assignRanks, computeScoresForRoom } from './lib/aggregateScores'

type RoomMemberLite = { userId: string; displayName?: string }
type RoomLite = { type?: 'private' | 'global'; enabledQuestionIds?: string[] }
type UserProfileLite = { username?: string; email?: string }

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

/** Recalcula y escribe standings/{roomId}/users/{userId} para una sala. */
export async function recalculateStandingsForRoom(db: Firestore, roomId: string): Promise<void> {
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
  const roomType = room.type ?? 'private'
  const enabledQuestionIds =
    roomType === 'private' && Array.isArray(room.enabledQuestionIds) && room.enabledQuestionIds.length > 0
      ? new Set(room.enabledQuestionIds)
      : null
  const scores = computeScoresForRoom(
    predictions,
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
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  }
  for (const uid of existingUserIds) {
    if (!nextUserIds.has(uid)) {
      const ref = db.collection('standings').doc(roomId).collection('users').doc(uid)
      writer.delete(ref)
    }
  }
  await writer.close()
}

export async function getRoomIdsForMatch(db: Firestore, matchId: string): Promise<string[]> {
  const snap = await db
    .collection('predictions')
    .where('matchId', '==', matchId)
    .where('scope', '==', 'match')
    .get()
  const set = new Set<string>()
  snap.forEach((d) => {
    const r = d.data().roomId
    if (typeof r === 'string') set.add(r)
  })
  return [...set]
}

export async function getAllRoomIds(db: Firestore): Promise<string[]> {
  const snap = await db.collection('rooms').get()
  return snap.docs.map((d) => d.id)
}
