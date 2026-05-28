import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../firebase'
import { assertGeneralPredictionsOpen, assertPlayerPickOpen } from './predictionWriteGuard'
import type {
  MatchPredictionPayload,
  PlayerPerMatchPayload,
  PredictionDoc,
  TournamentPredictionPayload,
} from '../types/predictions'

const PREDICTIONS = 'predictions'

function predictionDocId(roomId: string, userId: string, key: string): string {
  const safe = key.replace(/\//g, '_')
  return `${roomId}_${userId}_${safe}`.slice(0, 700)
}

export function subscribePredictionsForRoom(
  roomId: string,
  userId: string,
  onData: (rows: PredictionDoc[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe | null {
  if (!db) {
    onData([])
    return null
  }
  const q = query(
    collection(db, PREDICTIONS),
    where('roomId', '==', roomId),
    where('userId', '==', userId),
  )
  return onSnapshot(
    q,
    (snap) => {
      const list: PredictionDoc[] = []
      snap.forEach((d) => {
        list.push({ ...(d.data() as PredictionDoc), id: d.id })
      })
      onData(list)
    },
    (err) => onError?.(err instanceof Error ? err : new Error(String(err))),
  )
}

export async function saveMatchPrediction(
  roomId: string,
  userId: string,
  matchId: string,
  payload: MatchPredictionPayload,
): Promise<void> {
  if (!db) throw new Error('Firestore no inicializado')
  assertGeneralPredictionsOpen()
  const id = predictionDocId(roomId, userId, `m_${matchId}`)
  const ref = doc(db, PREDICTIONS, id)
  const goalsTeamA = payload.goalsTeamA ?? payload.goalsHome
  const goalsTeamB = payload.goalsTeamB ?? payload.goalsAway
  const penaltiesWinnerTeamA = payload.penaltiesWinnerTeamA ?? payload.penaltiesWinnerHome
  const data: PredictionDoc = {
    userId,
    roomId,
    scope: 'match',
    matchId,
    payload: {
      ...payload,
      goalsHome: goalsTeamA,
      goalsAway: goalsTeamB,
      goalsTeamA,
      goalsTeamB,
      ...(typeof penaltiesWinnerTeamA === 'boolean'
        ? {
            penaltiesWinnerHome: penaltiesWinnerTeamA,
            penaltiesWinnerTeamA,
          }
        : {}),
    },
    updatedAt: serverTimestamp(),
  }
  await setDoc(ref, data, { merge: true })
}

/** Guarda todos los marcadores de fase de grupos en una sola transacción por lotes (máx. 500 ops). */
export async function saveGroupPredictionsBatch(
  roomId: string,
  userId: string,
  entries: { matchId: string; payload: MatchPredictionPayload }[],
): Promise<void> {
  if (!db) throw new Error('Firestore no inicializado')
  if (entries.length === 0) return
  assertGeneralPredictionsOpen()
  const batch = writeBatch(db)
  for (const { matchId, payload } of entries) {
    const goalsTeamA = payload.goalsTeamA ?? payload.goalsHome
    const goalsTeamB = payload.goalsTeamB ?? payload.goalsAway
    const penaltiesWinnerTeamA = payload.penaltiesWinnerTeamA ?? payload.penaltiesWinnerHome
    const id = predictionDocId(roomId, userId, `m_${matchId}`)
    const ref = doc(db, PREDICTIONS, id)
    const data: PredictionDoc = {
      userId,
      roomId,
      scope: 'match',
      matchId,
      payload: {
        ...payload,
        goalsHome: goalsTeamA,
        goalsAway: goalsTeamB,
        goalsTeamA,
        goalsTeamB,
        ...(typeof penaltiesWinnerTeamA === 'boolean'
          ? {
              penaltiesWinnerHome: penaltiesWinnerTeamA,
              penaltiesWinnerTeamA,
            }
          : {}),
      },
      updatedAt: serverTimestamp(),
    }
    batch.set(ref, data, { merge: true })
  }
  await batch.commit()
}

/** Guarda todas las predicciones KO en un solo lote (máx. 500 ops). */
export async function saveKoPredictionsBatch(
  roomId: string,
  userId: string,
  entries: { matchId: string; payload: MatchPredictionPayload }[],
): Promise<void> {
  if (!db) throw new Error('Firestore no inicializado')
  if (entries.length === 0) return
  assertGeneralPredictionsOpen()
  const batch = writeBatch(db)
  for (const { matchId, payload } of entries) {
    const goalsTeamA = payload.goalsTeamA ?? payload.goalsHome
    const goalsTeamB = payload.goalsTeamB ?? payload.goalsAway
    const penaltiesWinnerTeamA = payload.penaltiesWinnerTeamA ?? payload.penaltiesWinnerHome
    const id = predictionDocId(roomId, userId, `m_${matchId}`)
    const ref = doc(db, PREDICTIONS, id)
    const data: PredictionDoc = {
      userId,
      roomId,
      scope: 'match',
      matchId,
      payload: {
        ...payload,
        goalsHome: goalsTeamA,
        goalsAway: goalsTeamB,
        goalsTeamA,
        goalsTeamB,
        ...(typeof penaltiesWinnerTeamA === 'boolean'
          ? {
              penaltiesWinnerHome: penaltiesWinnerTeamA,
              penaltiesWinnerTeamA,
            }
          : {}),
      },
      updatedAt: serverTimestamp(),
    }
    batch.set(ref, data, { merge: true })
  }
  await batch.commit()
}

export async function saveTournamentPrediction(
  roomId: string,
  userId: string,
  questionId: string,
  payload: TournamentPredictionPayload,
): Promise<void> {
  if (!db) throw new Error('Firestore no inicializado')
  assertGeneralPredictionsOpen()
  const id = predictionDocId(roomId, userId, `t_${questionId}`)
  const ref = doc(db, PREDICTIONS, id)
  const data: PredictionDoc = {
    userId,
    roomId,
    scope: 'tournament',
    questionId,
    payload,
    updatedAt: serverTimestamp(),
  }
  await setDoc(ref, data, { merge: true })
}

/** Guarda varias respuestas de torneo en un único batch (máx. 500 ops). */
export async function saveTournamentPredictionsBatch(
  roomId: string,
  userId: string,
  entries: { questionId: string; payload: TournamentPredictionPayload }[],
): Promise<void> {
  if (!db) throw new Error('Firestore no inicializado')
  if (entries.length === 0) return
  assertGeneralPredictionsOpen()
  const batch = writeBatch(db)
  for (const { questionId, payload } of entries) {
    const id = predictionDocId(roomId, userId, `t_${questionId}`)
    const ref = doc(db, PREDICTIONS, id)
    const data: PredictionDoc = {
      userId,
      roomId,
      scope: 'tournament',
      questionId,
      payload,
      updatedAt: serverTimestamp(),
    }
    batch.set(ref, data, { merge: true })
  }
  await batch.commit()
}

/** Persiste jugador por partido (scope player_per_match) para puntaje e historial por sala/usuario. */
export async function savePlayerPerMatchPrediction(
  roomId: string,
  userId: string,
  matchId: string,
  playerKey: string,
  scheduledAt: unknown,
): Promise<void> {
  if (!db) throw new Error('Firestore no inicializado')
  assertPlayerPickOpen(scheduledAt)
  const id = predictionDocId(roomId, userId, `p_${matchId}`)
  const ref = doc(db, PREDICTIONS, id)
  const payload: PlayerPerMatchPayload = { kind: 'player_match_pick', playerKey }
  const data: PredictionDoc = {
    userId,
    roomId,
    scope: 'player_per_match',
    matchId,
    payload,
    updatedAt: serverTimestamp(),
  }
  await setDoc(ref, data, { merge: true })
}
