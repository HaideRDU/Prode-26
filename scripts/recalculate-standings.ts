/**
 * Recalcula standings/{roomId}/users usando functions/src/recalculateRoom.ts
 * (misma lógica que onMatchWrite / onTournamentResultWrite).
 *
 * Uso:
 *   npm run recalculate:standings
 *   npm run recalculate:standings -- --room=global
 */
import './seed-load-env.ts'
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { logRecalculateStandingsSummary } from './lib/runRecalculateStandings.ts'

const args = process.argv.slice(2)
const roomArg = args.find((x) => x.startsWith('--room='))?.slice('--room='.length).trim()

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
  const roomIds = roomArg ? [roomArg] : undefined
  await logRecalculateStandingsSummary(db, { roomIds, label: 'recalculate:standings' })
}

main().catch((e) => {
  console.error('[recalculate:standings] ERROR:', e)
  process.exit(1)
})
