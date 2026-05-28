import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'
import { GLOBAL_ROOM_ID } from '../constants/rooms'
import {
  ROOM_DESCRIPTION_MAX_CHARS,
  ROOM_NAME_MAX_CHARS,
  ROOM_PRIZE_MAX_CHARS,
} from '../constants/roomFieldLimits'
import { DEFAULT_RULESET } from '../config/ruleset'
import type { PrivateRoomPodiumPrizes, RoomDoc, RoomMaxMembers, RoomMemberDoc } from '../types/predictions'

function clipLen(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max)
}

function normalizePodiumPrizesForWrite(input?: PrivateRoomPodiumPrizes | null): PrivateRoomPodiumPrizes | undefined {
  if (!input) return undefined
  const first = clipLen(input.first?.trim() ?? '', ROOM_PRIZE_MAX_CHARS)
  const second = clipLen(input.second?.trim() ?? '', ROOM_PRIZE_MAX_CHARS)
  const third = clipLen(input.third?.trim() ?? '', ROOM_PRIZE_MAX_CHARS)
  if (!first && !second && !third) return undefined
  return { first, second, third }
}

const ROOMS = 'rooms'
const ROOM_MEMBERS = 'roomMembers'

function membershipId(roomId: string, userId: string): string {
  return `${roomId}_${userId}`
}

function randomInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

export async function getRoom(roomId: string): Promise<RoomDoc | null> {
  if (!db) return null
  const snap = await getDoc(doc(db, ROOMS, roomId))
  if (!snap.exists()) return null
  return snap.data() as RoomDoc
}

export async function createRoom(
  name: string,
  description: string,
  maxMembers: RoomMaxMembers,
  userId: string,
  displayName: string,
  enabledQuestionIds?: string[],
  podiumPrizes?: PrivateRoomPodiumPrizes | null,
): Promise<{ roomId: string; inviteCode: string }> {
  if (!db) throw new Error('Firestore no inicializado')
  const nameClipped = clipLen(name.trim(), ROOM_NAME_MAX_CHARS)
  if (!nameClipped) throw new Error('Indica un nombre de sala.')
  const descriptionClipped = clipLen(description.trim(), ROOM_DESCRIPTION_MAX_CHARS)
  const inviteCode = randomInviteCode()
  const roomRef = doc(collection(db, ROOMS))
  const roomId = roomRef.id
  const prizesWritten = normalizePodiumPrizesForWrite(podiumPrizes ?? undefined)
  const room: RoomDoc = {
    name: nameClipped,
    description: descriptionClipped,
    inviteCode,
    maxMembers,
    createdBy: userId,
    createdAt: serverTimestamp(),
    type: 'private',
    rulesetId: DEFAULT_RULESET.id,
    ...(enabledQuestionIds && enabledQuestionIds.length > 0
      ? { enabledQuestionIds: [...new Set(enabledQuestionIds)] }
      : {}),
    ...(prizesWritten ? { podiumPrizes: prizesWritten } : {}),
  }
  await setDoc(roomRef, room)
  await setDoc(doc(db, ROOM_MEMBERS, membershipId(roomId, userId)), {
    roomId,
    userId,
    displayName,
    joinedAt: serverTimestamp(),
  } satisfies RoomMemberDoc)
  return { roomId, inviteCode }
}

export async function updatePrivateRoomPodiumPrizes(
  roomId: string,
  prizes: PrivateRoomPodiumPrizes,
): Promise<void> {
  if (!db) throw new Error('Firestore no inicializado')
  const normalized = normalizePodiumPrizesForWrite(prizes)
  if (!normalized) {
    await updateDoc(doc(db, ROOMS, roomId), { podiumPrizes: { first: '', second: '', third: '' } })
    return
  }
  await updateDoc(doc(db, ROOMS, roomId), { podiumPrizes: normalized })
}

export async function updatePrivateRoomDetails(
  roomId: string,
  payload: { name: string; description: string },
): Promise<void> {
  if (!db) throw new Error('Firestore no inicializado')
  const name = clipLen(payload.name.trim(), ROOM_NAME_MAX_CHARS)
  if (!name) throw new Error('El nombre de la sala no puede estar vacío.')
  const description = clipLen(payload.description.trim(), ROOM_DESCRIPTION_MAX_CHARS)
  await updateDoc(doc(db, ROOMS, roomId), {
    name,
    description,
  })
}

export async function joinRoomByCode(
  inviteCode: string,
  userId: string,
  displayName: string,
): Promise<string> {
  if (!db) throw new Error('Firestore no inicializado')
  const q = query(collection(db, ROOMS), where('inviteCode', '==', inviteCode.toUpperCase()), limit(1))
  const snap = await getDocs(q)
  if (snap.empty) throw new Error('Código no válido o sala no encontrada.')
  const roomDoc = snap.docs[0]
  const roomId = roomDoc.id
  const room = roomDoc.data() as RoomDoc
  if (room.type === 'global') throw new Error('Usa la entrada de sala global.')
  const membersQ = query(collection(db, ROOM_MEMBERS), where('roomId', '==', roomId))
  const membersSnap = await getDocs(membersQ)
  if (membersSnap.size >= room.maxMembers) throw new Error('Sala llena.')
  const mid = membershipId(roomId, userId)
  const existing = await getDoc(doc(db, ROOM_MEMBERS, mid))
  if (existing.exists()) return roomId
  await setDoc(doc(db, ROOM_MEMBERS, mid), {
    roomId,
    userId,
    displayName,
    joinedAt: serverTimestamp(),
  } satisfies RoomMemberDoc)
  return roomId
}

/** Asegura que el usuario figure en la sala global (room doc debe existir en consola o seed). */
export async function ensureGlobalRoomMembership(userId: string, displayName: string): Promise<void> {
  if (!db) return
  const room = await getRoom(GLOBAL_ROOM_ID)
  if (!room) {
    console.warn(
      `[rooms] No existe el documento rooms/${GLOBAL_ROOM_ID}. Créalo en Firebase con type: global.`,
    )
    return
  }
  const mid = membershipId(GLOBAL_ROOM_ID, userId)
  const existing = await getDoc(doc(db, ROOM_MEMBERS, mid))
  if (existing.exists()) return
  await setDoc(doc(db, ROOM_MEMBERS, mid), {
    roomId: GLOBAL_ROOM_ID,
    userId,
    displayName,
    joinedAt: serverTimestamp(),
  } satisfies RoomMemberDoc)
}

export function roomMembersCollectionRef() {
  if (!db) return null
  return collection(db, ROOM_MEMBERS)
}

export { membershipId, ROOMS, ROOM_MEMBERS }
