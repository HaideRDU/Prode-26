import './seed-load-env.ts'
import { applicationDefault, initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID
if (!getApps().length) initializeApp({ credential: applicationDefault(), ...(projectId ? { projectId } : {}) })
const db = getFirestore()

for (const team of ['CAN', 'MAR', 'RSA', 'NED', 'JPN', 'BRA']) {
  const snap = await db.collection('teams').doc(team).collection('players').get()
  console.log(`\n=== ${team} (${snap.size} jugadores) ===`)
  snap.docs.forEach((d) => {
    const p = d.data()
    console.log(`  ${d.id} | ${p.name ?? '—'} | panini: ${p.paniniStickerCode ?? '—'}`)
  })
}
