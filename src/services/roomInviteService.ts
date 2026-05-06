/**
 * Solicitudes de ingreso por código (Firestore).
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { RoomDoc, RoomMemberDoc } from '../types/predictions'
import { GLOBAL_ROOM_ID } from '../constants/rooms'
import { membershipId } from './roomsService'

export const ROOM_JOIN_REQUESTS = 'roomJoinRequests'

export type JoinRequestStatus = 'pending'

export interface RoomJoinRequestDoc {
  roomId: string
  userId: string
  displayName: string
  status: JoinRequestStatus
  createdAt: unknown
}

export function joinRequestDocId(roomId: string, userId: string): string {
  return `${roomId}_${userId}`
}

async function findRoomByInviteCode(inviteCode: string): Promise<{ id: string; data: RoomDoc } | null> {
  if (!db) return null
  const snap = await getDocs(
    query(collection(db, 'rooms'), where('inviteCode', '==', inviteCode.toUpperCase()), limit(1)),
  )
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, data: d.data() as RoomDoc }
}

/** Solicita ingreso por código (no crea membresía hasta que el admin acepte). */
export async function requestJoinByInviteCode(
  inviteCode: string,
  userId: string,
  displayName: string,
): Promise<{ kind: 'joined' | 'pending'; roomId: string }> {
  if (!db) throw new Error('Firestore no inicializado')
  const c = inviteCode.trim().toUpperCase()
  if (!c) throw new Error('Introduce el código.')
  const found = await findRoomByInviteCode(c)
  if (!found) throw new Error('Código no válido o sala no encontrada.')
  const { id: roomId, data: room } = found
  if (room.type === 'global') throw new Error('Usa la entrada de sala global.')
  if (roomId === GLOBAL_ROOM_ID) throw new Error('Usa la entrada de sala global.')

  const mid = membershipId(roomId, userId)
  const memberSnap = await getDoc(doc(db, 'roomMembers', mid))
  if (memberSnap.exists()) return { kind: 'joined', roomId }

  const membersSnap = await getDocs(query(collection(db, 'roomMembers'), where('roomId', '==', roomId)))
  if (membersSnap.size >= room.maxMembers) throw new Error('Sala llena.')

  const rid = joinRequestDocId(roomId, userId)
  await setDoc(doc(db, ROOM_JOIN_REQUESTS, rid), {
    roomId,
    userId,
    displayName: displayName.trim() || userId,
    status: 'pending',
    createdAt: serverTimestamp(),
  } satisfies Omit<RoomJoinRequestDoc, 'createdAt'> & { createdAt: unknown })

  return { kind: 'pending', roomId }
}

export async function listPendingJoinRequests(roomId: string): Promise<
  { id: string; userId: string; displayName: string; createdAt: unknown }[]
> {
  if (!db) throw new Error('Firestore no inicializado')
  const snap = await getDocs(
    query(collection(db, ROOM_JOIN_REQUESTS), where('roomId', '==', roomId), where('status', '==', 'pending')),
  )
  const rows: { id: string; userId: string; displayName: string; createdAt: unknown }[] = []
  snap.forEach((d) => {
    const row = d.data() as RoomJoinRequestDoc
    rows.push({
      id: d.id,
      userId: row.userId,
      displayName: row.displayName,
      createdAt: row.createdAt,
    })
  })
  rows.sort((a, b) => String(a.displayName).localeCompare(String(b.displayName), 'es'))
  return rows
}

export async function approveJoinRequest(roomId: string, targetUserId: string, displayName: string): Promise<void> {
  if (!db) throw new Error('Firestore no inicializado')
  const roomSnap = await getDoc(doc(db, 'rooms', roomId))
  if (!roomSnap.exists()) throw new Error('La sala no existe.')
  const room = roomSnap.data() as RoomDoc

  const mid = membershipId(roomId, targetUserId)
  const reqRef = doc(db, ROOM_JOIN_REQUESTS, joinRequestDocId(roomId, targetUserId))
  const memberRef = doc(db, 'roomMembers', mid)

  const existingMember = await getDoc(memberRef)
  if (!existingMember.exists()) {
    const membersSnap = await getDocs(query(collection(db, 'roomMembers'), where('roomId', '==', roomId)))
    if (membersSnap.size >= room.maxMembers) throw new Error('Sala llena.')
  }

  await runTransaction(db, async (tx) => {
    const reqSnap = await tx.get(reqRef)
    if (!reqSnap.exists()) throw new Error('La solicitud ya no existe.')
    const mSnap = await tx.get(memberRef)
    if (mSnap.exists()) {
      tx.delete(reqRef)
      return
    }
    tx.set(memberRef, {
      roomId,
      userId: targetUserId,
      displayName: displayName.trim() || targetUserId,
      joinedAt: serverTimestamp(),
    } satisfies Omit<RoomMemberDoc, 'joinedAt'> & { joinedAt: unknown })
    tx.delete(reqRef)
  })
}

export async function rejectJoinRequest(roomId: string, targetUserId: string): Promise<void> {
  if (!db) throw new Error('Firestore no inicializado')
  await deleteDoc(doc(db, ROOM_JOIN_REQUESTS, joinRequestDocId(roomId, targetUserId)))
}
