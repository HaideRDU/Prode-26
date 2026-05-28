import './seed-load-env.ts'
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import type { MatchDoc } from '../src/types/predictions.ts'
import {
  derivePodiumFromMatches,
  formatPodiumLog,
  syncTournamentResultsFromMatches,
} from './lib/syncTournamentResultsFromMatches.ts'

const dryRun = process.argv.includes('--dry-run')

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

const db = getFirestore()

async function main(): Promise<void> {
  if (dryRun) {
    const snap = await db.collection('matches').get()
    const matches = snap.docs.map((d) => ({ id: d.id, ...(d.data() as MatchDoc) }))
    const podium = derivePodiumFromMatches(matches)
    console.log('[sync:tournament-results] DRY RUN', formatPodiumLog(podium))
    return
  }

  const { podium, written } = await syncTournamentResultsFromMatches(db)
  console.log('[sync:tournament-results] OK', {
    podium: formatPodiumLog(podium),
    written,
    note: 'onTournamentResultWrite recalcula standings de todas las salas.',
  })
}

main().catch((e) => {
  console.error('[sync:tournament-results] ERROR:', e)
  process.exit(1)
})
