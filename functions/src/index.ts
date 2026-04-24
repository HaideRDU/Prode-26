/**
 * Cloud Functions: recalculación de clasificación al actualizar partidos o resultados de torneo.
 *
 * Desarrollo local sin desplegar: usar Firebase Emulator Suite (`firebase emulators:start`)
 * o desplegar solo functions. El cliente no puede escribir en `standings` (reglas Firestore).
 */
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import * as logger from 'firebase-functions/logger'
import { getAllRoomIds, getRoomIdsForMatch, recalculateStandingsForRoom } from './recalculateRoom'

initializeApp()
const db = getFirestore()

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
