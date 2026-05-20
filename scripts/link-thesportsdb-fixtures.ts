import './seed-load-env.ts'
import { getApp, initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { linkTsdbFixtures } from '../functions/lib/theSportsDb/linkFixtures.js'

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.VITE_FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT

initializeApp({
  credential: applicationDefault(),
  ...(projectId ? { projectId } : {}),
})

const db = getFirestore()
console.log('[link-tsdb] projectId:', getApp().options.projectId ?? projectId)
console.log('[link-tsdb] Usando TheSportsDB Free (clave pública 123) — sin secreto necesario')

linkTsdbFixtures(db)
  .then((r) => {
    console.log('[link-tsdb] OK:', r)
  })
  .catch((e) => {
    console.error('[link-tsdb] ERROR:', e)
    process.exit(1)
  })
