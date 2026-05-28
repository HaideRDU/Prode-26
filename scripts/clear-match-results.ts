/**
 * Limpia resultados oficiales en `matches/` para volver a probar simulaciones.
 *
 * Uso:
 *   npm run clear:match-results -- --dry-run
 *   npm run clear:match-results -- --confirm
 *   npm run clear:match-results -- --confirm --phase=group
 *   npm run clear:match-results -- --confirm --tournament-results
 *   npm run clear:match-results -- --confirm --predictions --room=global
 *
 * Requiere credenciales Firebase (GOOGLE_APPLICATION_CREDENTIALS o gcloud ADC).
 */
import './seed-load-env.ts'
import { applicationDefault, getApp, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { EXTRA_IDS } from '../src/data/questionIds.ts'
import type { MatchDoc, TournamentResultDoc } from '../src/types/predictions.ts'
import {
  clearPatchForMatch,
  matchIdsForPhase,
  wasFinished,
  type ClearPhase,
} from './lib/clearMatchResults.ts'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const confirm = args.includes('--confirm')
const withTournamentResults = args.includes('--tournament-results')
const withPredictions = args.includes('--predictions')
const roomId = args.find((a) => a.startsWith('--room='))?.slice('--room='.length).trim() || 'global'
const phaseArg = args.find((a) => a.startsWith('--phase='))?.slice('--phase='.length) as ClearPhase | undefined
const phase: ClearPhase =
  phaseArg === 'group' || phaseArg === 'knockout' || phaseArg === 'all' ? phaseArg : 'all'

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  process.env.VITE_FIREBASE_PROJECT_ID

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    ...(projectId ? { projectId } : {}),
  })
}

const resolvedProject = getApp().options.projectId ?? projectId ?? '(ver JSON ADC)'
const db = getFirestore()

const PODIUM_EXTRA_IDS = [
  EXTRA_IDS.champion,
  EXTRA_IDS.runnerUp,
  EXTRA_IDS.thirdPlace,
  EXTRA_IDS.fourthPlace,
] as const

async function clearTournamentResults(dry: boolean): Promise<number> {
  let count = 0
  const writer = dry ? null : db.bulkWriter()
  for (const questionId of PODIUM_EXTRA_IDS) {
    const doc: TournamentResultDoc = {
      questionId,
      resolved: false,
      answer: null,
      updatedAt: FieldValue.serverTimestamp(),
    }
    if (dry) {
      count++
      continue
    }
    writer!.set(db.collection('tournamentResults').doc(questionId), doc, { merge: true })
    count++
  }
  if (writer) await writer.close()
  return count
}

async function clearMatchPredictions(dry: boolean, targetRoomId: string): Promise<number> {
  const snap = await db.collection('predictions').where('roomId', '==', targetRoomId).get()
  let count = 0
  const writer = dry ? null : db.bulkWriter()
  for (const doc of snap.docs) {
    const data = doc.data()
    if (data.scope !== 'match') continue
    count++
    if (!dry) writer!.delete(doc.ref)
  }
  if (writer) await writer.close()
  return count
}

async function main(): Promise<void> {
  if (!dryRun && !confirm) {
    console.error(
      '[clear:match-results] Indicá --dry-run (vista previa) o --confirm (escribir en Firestore).',
    )
    process.exit(1)
  }

  console.log('[clear:match-results] projectId:', resolvedProject)
  console.log('[clear:match-results] mode:', dryRun ? 'DRY RUN' : 'CONFIRM')
  console.log('[clear:match-results] phase:', phase)
  if (withTournamentResults) console.log('[clear:match-results] también: tournamentResults (podio)')
  if (withPredictions) console.log('[clear:match-results] también: predictions scope=match en room', roomId)

  const allowedIds = matchIdsForPhase(phase)
  const snap = await db.collection('matches').get()

  let scanned = 0
  let toReset = 0
  let alreadyClean = 0
  const samples: string[] = []

  const writer = dryRun ? null : db.bulkWriter()

  for (const doc of snap.docs) {
    if (allowedIds && !allowedIds.has(doc.id)) continue
    scanned++
    const data = doc.data() as MatchDoc
    const patch = clearPatchForMatch(doc.id, data)
    if (!patch) continue

    const needsReset = wasFinished(data) || data.goalsTeamA != null || data.goalsTeamB != null
    if (!needsReset && data.status === 'scheduled') {
      alreadyClean++
      continue
    }

    toReset++
    if (samples.length < 5) samples.push(doc.id)

    if (!dryRun) {
      writer!.set(doc.ref, patch, { merge: true })
    }
  }

  if (writer) await writer.close()

  let tournamentCleared = 0
  if (withTournamentResults) {
    tournamentCleared = await clearTournamentResults(dryRun)
  }

  let predictionsCleared = 0
  if (withPredictions) {
    predictionsCleared = await clearMatchPredictions(dryRun, roomId)
  }

  console.log('[clear:match-results] OK', {
    scanned,
    reset: toReset,
    alreadyClean,
    tournamentResultsCleared: withTournamentResults ? tournamentCleared : 0,
    predictionsCleared: withPredictions ? predictionsCleared : 0,
    sampleMatchIds: samples,
  })

  if (dryRun) {
    console.log(
      '[clear:match-results] Ejecutá con --confirm para aplicar. Luego podés correr simulate:scoring:* o cargar resultados a mano.',
    )
  } else {
    console.log(
      '[clear:match-results] Partidos en scheduled sin goles. KO sin equipos asignados (se rellenan al simular).',
    )
    if (!withTournamentResults) {
      console.log(
        '[clear:match-results] Tip: agregá --tournament-results si también querés limpiar extra_champion / subcampeón / 3º / 4º.',
      )
    }
  }
}

main().catch((e) => {
  console.error('[clear:match-results] ERROR:', e)
  process.exit(1)
})
