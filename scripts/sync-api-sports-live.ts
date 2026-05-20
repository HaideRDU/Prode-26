import './seed-load-env.ts'
import { getApp, initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { syncLiveMatches } from '../functions/lib/apiSports/syncMatches.js'

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.VITE_FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT

const apiKey = process.env.APISPORTS_KEY?.trim()
if (!apiKey) {
  console.error('Define APISPORTS_KEY en .env (no la subas a git).')
  process.exit(1)
}

initializeApp({
  credential: applicationDefault(),
  ...(projectId ? { projectId } : {}),
})

const db = getFirestore()
console.log('[sync-api-sports-live] projectId:', getApp().options.projectId ?? projectId)

syncLiveMatches(db, apiKey)
  .then((r) => {
    console.log('OK:', r)
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
