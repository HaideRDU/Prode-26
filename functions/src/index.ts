/**
 * Cloud Functions: recalculación de clasificación al actualizar partidos o resultados de torneo.
 *
 * Desarrollo local sin desplegar: usar Firebase Emulator Suite (`firebase emulators:start`)
 * o desplegar solo functions. El cliente no puede escribir en `standings` (reglas Firestore).
 */
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import * as logger from 'firebase-functions/logger'
import { getAllRoomIds, getRoomIdsForMatch, recalculateStandingsForRoom } from './recalculateRoom'

initializeApp()
const db = getFirestore()
const GLOBAL_ROOM_ID = 'global'

export const onMatchWrite = onDocumentWritten('matches/{matchId}', async (event) => {
  const matchId = event.params.matchId as string
  try {
    const roomIds = await getRoomIdsForMatch(db, matchId)
    logger.info(`onMatchWrite: matchId=${matchId} rooms=${roomIds.join(',')}`)
    for (const roomId of roomIds) {
      await recalculateStandingsForRoom(db, roomId)
    }
  } catch (err) {
    logger.error('onMatchWrite failed', err)
    throw err
  }
})

export const onTournamentResultWrite = onDocumentWritten(
  'tournamentResults/{questionId}',
  async () => {
    try {
      const roomIds = await getAllRoomIds(db)
      for (const roomId of roomIds) {
        await recalculateStandingsForRoom(db, roomId)
      }
    } catch (err) {
      logger.error('onTournamentResultWrite failed', err)
      throw err
    }
  },
)

export const onPredictionWrite = onDocumentWritten('predictions/{predictionId}', async (event) => {
  const beforeRoomId = event.data?.before.exists ? (event.data.before.data()?.roomId as string | undefined) : undefined
  const afterRoomId = event.data?.after.exists ? (event.data.after.data()?.roomId as string | undefined) : undefined
  const roomIds = [...new Set([beforeRoomId, afterRoomId].filter((x): x is string => typeof x === 'string' && x.length > 0))]
  if (roomIds.length === 0) return

  try {
    logger.info(`onPredictionWrite: rooms=${roomIds.join(',')}`)
    for (const roomId of roomIds) {
      await recalculateStandingsForRoom(db, roomId)
    }
  } catch (err) {
    logger.error('onPredictionWrite failed', err)
    throw err
  }
})

export const onRoomMemberWrite = onDocumentWritten('roomMembers/{membershipId}', async (event) => {
  const beforeRoomId = event.data?.before.exists ? (event.data.before.data()?.roomId as string | undefined) : undefined
  const afterRoomId = event.data?.after.exists ? (event.data.after.data()?.roomId as string | undefined) : undefined
  const roomIds = [...new Set([beforeRoomId, afterRoomId].filter((x): x is string => typeof x === 'string' && x.length > 0))]
  if (roomIds.length === 0) return

  try {
    logger.info(`onRoomMemberWrite: rooms=${roomIds.join(',')}`)
    for (const roomId of roomIds) {
      await recalculateStandingsForRoom(db, roomId)
    }
  } catch (err) {
    logger.error('onRoomMemberWrite failed', err)
    throw err
  }
})

type PrivateRoomDoc = { createdBy?: string; type?: 'private' | 'global' }

function assertPrivateRoomOwner(authUid: string | undefined, roomId: string, room: PrivateRoomDoc): void {
  if (!authUid) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.')
  if (roomId === GLOBAL_ROOM_ID || room.type !== 'private') {
    throw new HttpsError('permission-denied', 'La acción solo está permitida en salas privadas.')
  }
  if (room.createdBy !== authUid) {
    throw new HttpsError('permission-denied', 'Solo el líder de la sala puede realizar esta acción.')
  }
}

export const managePrivateRoomMember = onCall(async (request) => {
  const authUid = request.auth?.uid
  const roomId = String(request.data?.roomId ?? '')
  const targetUserId = String(request.data?.targetUserId ?? '')
  if (!roomId || !targetUserId) throw new HttpsError('invalid-argument', 'Faltan roomId o targetUserId.')

  const roomRef = db.collection('rooms').doc(roomId)
  const roomSnap = await roomRef.get()
  if (!roomSnap.exists) throw new HttpsError('not-found', 'La sala no existe.')
  const room = roomSnap.data() as PrivateRoomDoc
  assertPrivateRoomOwner(authUid, roomId, room)
  if (targetUserId === room.createdBy) {
    throw new HttpsError('failed-precondition', 'No puedes eliminar al líder de la sala.')
  }

  const memberRef = db.collection('roomMembers').doc(`${roomId}_${targetUserId}`)
  await memberRef.delete()

  const predsSnap = await db
    .collection('predictions')
    .where('roomId', '==', roomId)
    .where('userId', '==', targetUserId)
    .get()
  const writer = db.bulkWriter()
  predsSnap.forEach((d) => writer.delete(d.ref))
  writer.delete(db.collection('standings').doc(roomId).collection('users').doc(targetUserId))
  await writer.close()
  await recalculateStandingsForRoom(db, roomId)
  return { ok: true }
})

export const deletePrivateRoom = onCall(async (request) => {
  const authUid = request.auth?.uid
  const roomId = String(request.data?.roomId ?? '')
  if (!roomId) throw new HttpsError('invalid-argument', 'Falta roomId.')
  const roomRef = db.collection('rooms').doc(roomId)
  const roomSnap = await roomRef.get()
  if (!roomSnap.exists) throw new HttpsError('not-found', 'La sala no existe.')
  const room = roomSnap.data() as PrivateRoomDoc
  assertPrivateRoomOwner(authUid, roomId, room)

  const [membersSnap, predsSnap, standingsSnap] = await Promise.all([
    db.collection('roomMembers').where('roomId', '==', roomId).get(),
    db.collection('predictions').where('roomId', '==', roomId).get(),
    db.collection('standings').doc(roomId).collection('users').get(),
  ])
  const writer = db.bulkWriter()
  membersSnap.forEach((d) => writer.delete(d.ref))
  predsSnap.forEach((d) => writer.delete(d.ref))
  standingsSnap.forEach((d) => writer.delete(d.ref))
  writer.delete(roomRef)
  await writer.close()
  return { ok: true }
})
