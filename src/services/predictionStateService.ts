import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

const USERS = 'users'
const PREDICTION_STATE = 'predictionState'

export interface PredictionStateDoc {
  groupStageLocked?: boolean
  predictionFinalized?: boolean
  predictionFinalizedAt?: unknown
  updatedAt?: unknown
}

export async function getGroupStageLocked(userId: string, roomId: string): Promise<boolean> {
  if (!db) return false
  const ref = doc(db, USERS, userId, PREDICTION_STATE, roomId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return false
  const d = snap.data() as PredictionStateDoc
  return d.groupStageLocked === true
}

export async function setGroupStageLocked(
  userId: string,
  roomId: string,
  locked: boolean,
): Promise<void> {
  if (!db) throw new Error('Firestore no inicializado')
  const ref = doc(db, USERS, userId, PREDICTION_STATE, roomId)
  await setDoc(
    ref,
    {
      groupStageLocked: locked,
      updatedAt: serverTimestamp(),
    } satisfies PredictionStateDoc,
    { merge: true },
  )
}

export async function getPredictionFinalized(userId: string, roomId: string): Promise<boolean> {
  if (!db) return false
  const ref = doc(db, USERS, userId, PREDICTION_STATE, roomId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return false
  const d = snap.data() as PredictionStateDoc
  return d.predictionFinalized === true
}

export async function setPredictionFinalized(
  userId: string,
  roomId: string,
  finalized: boolean,
): Promise<void> {
  if (!db) throw new Error('Firestore no inicializado')
  const ref = doc(db, USERS, userId, PREDICTION_STATE, roomId)
  await setDoc(
    ref,
    {
      predictionFinalized: finalized,
      predictionFinalizedAt: finalized ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    } satisfies PredictionStateDoc,
    { merge: true },
  )
}
