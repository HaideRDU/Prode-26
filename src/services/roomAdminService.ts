import { FirebaseError } from 'firebase/app'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore'
import { auth, db } from '../firebase'
import { ROOM_JOIN_REQUESTS } from './roomInviteService'
import type { RoomDoc } from '../types/predictions'

export type RoomMemberLite = {
  id: string
  userId: string
  displayName: string
}

const BATCH_CHUNK_SIZE = 450

function isLikelyNetworkError(err: unknown): boolean {
  const message = String((err as { message?: unknown })?.message ?? '').toLowerCase()
  return message.includes('failed to fetch') || message.includes('net::err_failed')
}

function normalizeRoomAdminError(err: unknown, fallback = 'No se pudo completar la acción de administración de sala.'): Error {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case 'unauthenticated':
        return new Error('Tu sesión expiró. Vuelve a iniciar sesión e intenta de nuevo.')
      case 'permission-denied':
        return new Error('Solo el líder de una sala privada puede realizar esta acción.')
      case 'failed-precondition':
        return new Error('No se puede completar esta acción por el estado actual de la sala.')
      case 'not-found':
        return new Error('No se encontró la sala o alguno de sus datos relacionados.')
      case 'unavailable':
        return new Error('Firestore no está disponible temporalmente. Intenta nuevamente.')
      case 'deadline-exceeded':
        return new Error('La operación tardó demasiado. Intenta nuevamente en unos segundos.')
      default:
        break
    }
  }

  if (isLikelyNetworkError(err)) {
    return new Error('No se pudo conectar con Firebase. Verifica tu conexión e intenta nuevamente.')
  }

  return err instanceof Error ? err : new Error(fallback)
}

async function assertPrivateRoomOwner(roomId: string): Promise<RoomDoc> {
  if (!db) throw new Error('Firestore no inicializado')
  const authUid = auth?.currentUser?.uid
  if (!authUid) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión e intenta de nuevo.')

  const roomRef = doc(db, 'rooms', roomId)
  const roomSnap = await getDoc(roomRef)
  if (!roomSnap.exists()) throw new Error('La sala no existe.')
  const room = roomSnap.data() as RoomDoc

  if (room.type !== 'private' || roomId === 'global') {
    throw new Error('La acción solo está permitida en salas privadas.')
  }
  if (room.createdBy !== authUid) {
    throw new Error('Solo el líder de la sala puede realizar esta acción.')
  }
  return room
}

async function deleteRefsInChunks(refs: DocumentReference[]): Promise<void> {
  if (!db || refs.length === 0) return
  for (let i = 0; i < refs.length; i += BATCH_CHUNK_SIZE) {
    const chunk = refs.slice(i, i + BATCH_CHUNK_SIZE)
    const batch = writeBatch(db)
    for (const ref of chunk) batch.delete(ref)
    await batch.commit()
  }
}

export async function listRoomMembers(roomId: string): Promise<RoomMemberLite[]> {
  if (!db) throw new Error('Firestore no inicializado')
  const snap = await getDocs(query(collection(db, 'roomMembers'), where('roomId', '==', roomId)))
  const out: RoomMemberLite[] = []
  snap.forEach((d) => {
    const row = d.data() as { userId?: string; displayName?: string }
    if (!row.userId) return
    out.push({
      id: d.id,
      userId: row.userId,
      displayName: row.displayName?.trim() || row.userId,
    })
  })
  out.sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'))
  return out
}

export async function removePrivateRoomMember(roomId: string, targetUserId: string): Promise<void> {
  if (!db) throw new Error('Firestore no inicializado')
  try {
    const room = await assertPrivateRoomOwner(roomId)
    if (targetUserId === room.createdBy) {
      throw new Error('No puedes eliminar al líder de la sala.')
    }

    const [membersSnap, predsSnap] = await Promise.all([
      getDocs(query(collection(db, 'roomMembers'), where('roomId', '==', roomId), where('userId', '==', targetUserId))),
      getDocs(query(collection(db, 'predictions'), where('roomId', '==', roomId), where('userId', '==', targetUserId))),
    ])

    const refs: DocumentReference[] = []
    membersSnap.forEach((d) => refs.push(d.ref))
    predsSnap.forEach((d) => refs.push(d.ref))
    refs.push(doc(db, 'standings', roomId, 'users', targetUserId))
    await deleteRefsInChunks(refs)
  } catch (err) {
    throw normalizeRoomAdminError(err, 'No se pudo eliminar el usuario.')
  }
}

export async function deletePrivateRoom(roomId: string): Promise<void> {
  if (!db) throw new Error('Firestore no inicializado')
  try {
    await assertPrivateRoomOwner(roomId)

    const [membersSnap, predsSnap, standingsSnap, joinReqSnap] = await Promise.all([
      getDocs(query(collection(db, 'roomMembers'), where('roomId', '==', roomId))),
      getDocs(query(collection(db, 'predictions'), where('roomId', '==', roomId))),
      getDocs(collection(db, 'standings', roomId, 'users')),
      getDocs(query(collection(db, ROOM_JOIN_REQUESTS), where('roomId', '==', roomId))),
    ])

    const refs: DocumentReference[] = []
    membersSnap.forEach((d) => refs.push(d.ref))
    predsSnap.forEach((d) => refs.push(d.ref))
    standingsSnap.forEach((d) => refs.push(d.ref))
    joinReqSnap.forEach((d) => refs.push(d.ref))
    refs.push(doc(db, 'rooms', roomId))
    await deleteRefsInChunks(refs)
  } catch (err) {
    throw normalizeRoomAdminError(err, 'No se pudo borrar la sala.')
  }
}
