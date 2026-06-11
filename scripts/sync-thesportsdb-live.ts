import './seed-load-env.ts'
import { getApp, initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { syncMatchesFromTsdb } from '../functions/lib/theSportsDb/syncMatches.js'

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.VITE_FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT

initializeApp({
  credential: applicationDefault(),
  ...(projectId ? { projectId } : {}),
})

const db = getFirestore()
console.log('[sync-tsdb-live] projectId:', getApp().options.projectId ?? projectId)
console.log('[sync-tsdb-live] Usando TheSportsDB Free (clave pública 123)')

const apiSportsKey = process.env.APISPORTS_KEY?.trim()

syncMatchesFromTsdb(db, undefined, apiSportsKey)
  .then((r) => {
    console.log('[sync-tsdb-live] OK:', r)
  })
  .catch((e) => {
    console.error('[sync-tsdb-live] ERROR:', e)
    process.exit(1)
  })
