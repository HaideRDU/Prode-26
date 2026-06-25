import './seed-load-env.ts'
import { getApp, initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { syncMatchesFromFifa } from '../functions/lib/fifa/syncMatches.js'

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.VITE_FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT

initializeApp({
  credential: applicationDefault(),
  ...(projectId ? { projectId } : {}),
})

const db = getFirestore()
console.log('[sync-fifa-live] projectId:', getApp().options.projectId ?? projectId)

syncMatchesFromFifa(db)
  .then((r) => {
    console.log('[sync-fifa-live] OK:', r)
  })
  .catch((e) => {
    console.error('[sync-fifa-live] ERROR:', e)
    process.exit(1)
  })
