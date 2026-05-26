import './seed-load-env.ts'
import { applicationDefault, getApp, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import type { MatchDoc, PredictionDoc, MatchPredictionPayload } from '../src/types/predictions.ts'

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

function normalizeMatchDoc(data: MatchDoc): Partial<MatchDoc> | null {
  const patch: Partial<MatchDoc> = {}
  const teamAId = data.teamAId ?? data.teamHomeId
  const teamBId = data.teamBId ?? data.teamAwayId
  const goalsTeamA = data.goalsTeamA ?? data.goalsHome ?? null
  const goalsTeamB = data.goalsTeamB ?? data.goalsAway ?? null
  const penaltiesWinnerTeamA = data.penaltiesWinnerTeamA ?? data.penaltiesWinnerHome ?? null

  if (data.teamAId !== teamAId) patch.teamAId = teamAId
  if (data.teamBId !== teamBId) patch.teamBId = teamBId
  if (data.goalsTeamA !== goalsTeamA) patch.goalsTeamA = goalsTeamA
  if (data.goalsTeamB !== goalsTeamB) patch.goalsTeamB = goalsTeamB
  if (data.penaltiesWinnerTeamA !== penaltiesWinnerTeamA) patch.penaltiesWinnerTeamA = penaltiesWinnerTeamA

  return Object.keys(patch).length > 0 ? patch : null
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

function normalizeMatchPayload(payload: MatchPredictionPayload): MatchPredictionPayload | null {
  const goalsTeamA = payload.goalsTeamA ?? payload.goalsHome
  const goalsTeamB = payload.goalsTeamB ?? payload.goalsAway
  const penaltiesWinnerTeamA = payload.penaltiesWinnerTeamA ?? payload.penaltiesWinnerHome

  const next: MatchPredictionPayload = {
    ...payload,
    goalsHome: goalsTeamA,
    goalsAway: goalsTeamB,
    goalsTeamA,
    goalsTeamB,
    penaltiesWinnerHome: penaltiesWinnerTeamA,
    penaltiesWinnerTeamA,
  }
  const changed =
    payload.goalsTeamA !== next.goalsTeamA ||
    payload.goalsTeamB !== next.goalsTeamB ||
    payload.goalsHome !== next.goalsHome ||
    payload.goalsAway !== next.goalsAway ||
    payload.penaltiesWinnerTeamA !== next.penaltiesWinnerTeamA
  return changed ? next : null
}

async function migrateMatches(): Promise<Counters> {
  const snap = await db.collection('matches').get()
  const writer = db.bulkWriter()
  let updated = 0
  for (const doc of snap.docs) {
    const data = doc.data() as MatchDoc
    const patch = normalizeMatchDoc(data)
    if (!patch) continue
    writer.set(doc.ref, patch, { merge: true })
    updated += 1
  }
  await writer.close()
  return { scanned: snap.size, updated }
}

async function migratePredictions(): Promise<Counters> {
  const snap = await db.collection('predictions').where('scope', '==', 'match').get()
  const writer = db.bulkWriter()
  let updated = 0
  for (const doc of snap.docs) {
    const data = doc.data() as PredictionDoc
    if (!isMatchPayload(data.payload)) continue
    const nextPayload = normalizeMatchPayload(data.payload)
    if (!nextPayload) continue
    writer.set(doc.ref, { payload: nextPayload }, { merge: true })
    updated += 1
  }
  await writer.close()
  return { scanned: snap.size, updated }
}

async function main(): Promise<void> {
  const [matches, predictions] = await Promise.all([migrateMatches(), migratePredictions()])
  console.log(
    `[migrate:equipo-a-b] matches scanned=${matches.scanned} updated=${matches.updated} | predictions scanned=${predictions.scanned} updated=${predictions.updated}`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
