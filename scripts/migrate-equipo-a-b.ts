import './seed-load-env.ts'
import { applicationDefault, getApp, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { toTeamOnlyPredictionPayload } from '../src/domain/matchFields.ts'
import { penaltiesWinnerFlagsFromPayload } from '../src/domain/matchPenalties.ts'
import type { MatchDoc, PredictionDoc, MatchPredictionPayload } from '../src/types/predictions.ts'

const LEGACY_DELETE = {
  goalsHome: FieldValue.delete(),
  goalsAway: FieldValue.delete(),
  penaltiesWinnerHome: FieldValue.delete(),
  penaltiesWinnerAway: FieldValue.delete(),
  teamHomeId: FieldValue.delete(),
  teamAwayId: FieldValue.delete(),
} as const

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  process.env.VITE_FIREBASE_PROJECT_ID

initializeApp({
  credential: applicationDefault(),
  ...(projectId ? { projectId } : {}),
})

const resolvedProject = getApp().options.projectId ?? projectId ?? '(ver JSON ADC)'
console.log('[migrate:equipo-a-b] Firebase Admin projectId:', resolvedProject)

const db = getFirestore()

type Counters = {
  scanned: number
  updated: number
}

function normalizeMatchDoc(data: MatchDoc): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {}
  const teamAId = data.teamAId ?? data.teamHomeId
  const teamBId = data.teamBId ?? data.teamAwayId
  const goalsTeamA = data.goalsTeamA ?? data.goalsHome ?? null
  const goalsTeamB = data.goalsTeamB ?? data.goalsAway ?? null
  const pens = penaltiesWinnerFlagsFromPayload(data)

  if (teamAId && data.teamAId !== teamAId) patch.teamAId = teamAId
  if (teamBId && data.teamBId !== teamBId) patch.teamBId = teamBId
  if (goalsTeamA !== null && data.goalsTeamA !== goalsTeamA) patch.goalsTeamA = goalsTeamA
  if (goalsTeamB !== null && data.goalsTeamB !== goalsTeamB) patch.goalsTeamB = goalsTeamB
  if (pens.wentToPenalties === true && pens.penaltiesWinnerTeamA !== null) {
    if (data.penaltiesWinnerTeamA !== pens.penaltiesWinnerTeamA) patch.penaltiesWinnerTeamA = pens.penaltiesWinnerTeamA
    if (data.penaltiesWinnerTeamB !== pens.penaltiesWinnerTeamB) patch.penaltiesWinnerTeamB = pens.penaltiesWinnerTeamB
  }

  const needsLegacyDelete =
    data.goalsHome !== undefined ||
    data.goalsAway !== undefined ||
    data.penaltiesWinnerHome !== undefined ||
    data.penaltiesWinnerAway !== undefined ||
    data.teamHomeId !== undefined ||
    data.teamAwayId !== undefined

  if (Object.keys(patch).length === 0 && !needsLegacyDelete) return null
  return { ...patch, ...(needsLegacyDelete ? LEGACY_DELETE : {}) }
}

function isMatchPayload(payload: unknown): payload is MatchPredictionPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    (('goalsTeamA' in payload && typeof (payload as MatchPredictionPayload).goalsTeamA === 'number') ||
      ('goalsHome' in payload && typeof (payload as MatchPredictionPayload).goalsHome === 'number')) &&
    (('goalsTeamB' in payload && typeof (payload as MatchPredictionPayload).goalsTeamB === 'number') ||
      ('goalsAway' in payload && typeof (payload as MatchPredictionPayload).goalsAway === 'number'))
  )
}

function normalizeMatchPayload(payload: MatchPredictionPayload): Record<string, unknown> | null {
  const next = toTeamOnlyPredictionPayload(payload)
  const changed =
    payload.goalsTeamA !== next.goalsTeamA ||
    payload.goalsTeamB !== next.goalsTeamB ||
    payload.penaltiesWinnerTeamA !== next.penaltiesWinnerTeamA ||
    payload.penaltiesWinnerTeamB !== next.penaltiesWinnerTeamB ||
    payload.goalsHome !== undefined ||
    payload.goalsAway !== undefined ||
    payload.penaltiesWinnerHome !== undefined ||
    payload.penaltiesWinnerAway !== undefined
  if (!changed) return null
  return {
    ...next,
    ...LEGACY_DELETE,
  }
}

async function migrateMatches(): Promise<Counters> {
  const snap = await db.collection('matches').get()
  let updated = 0
  for (const doc of snap.docs) {
    const patch = normalizeMatchDoc(doc.data() as MatchDoc)
    if (!patch) continue
    await doc.ref.set(patch, { merge: true })
    updated++
  }
  return { scanned: snap.size, updated }
}

async function migratePredictions(): Promise<Counters> {
  const snap = await db.collection('predictions').get()
  let updated = 0
  for (const doc of snap.docs) {
    const data = doc.data() as PredictionDoc
    if (data.scope !== 'match' || !isMatchPayload(data.payload)) continue
    const patch = normalizeMatchPayload(data.payload)
    if (!patch) continue
    await doc.ref.set({ payload: patch }, { merge: true })
    updated++
  }
  return { scanned: snap.size, updated }
}

async function main(): Promise<void> {
  const matches = await migrateMatches()
  const predictions = await migratePredictions()
  console.log('[migrate:equipo-a-b] OK', { matches, predictions })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
