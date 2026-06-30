import './seed-load-env.ts'
import { applicationDefault, initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import type { MatchDoc } from '../functions/lib/lib/types/predictions.js'

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID
if (!getApps().length) initializeApp({ credential: applicationDefault(), ...(projectId ? { projectId } : {}) })
const db = getFirestore()

for (const id of ['wc26-ko-74', 'wc26-ko-75', 'wc26-ko-76']) {
  const snap = await db.collection('matches').doc(id).get()
  const d = snap.data() as MatchDoc
  if (!d) { console.log(id, 'NO EXISTE'); continue }
  const gA = d.goalsTeamA ?? d.goalsHome
  const gB = d.goalsTeamB ?? d.goalsAway
  console.log(`\n${id}`)
  console.log(`  status: ${d.status}  |  ${d.teamAId} ${gA}-${gB} ${d.teamBId}`)
  console.log(`  wentToPenalties: ${d.wentToPenalties}  penaltiesWinnerTeamA: ${d.penaltiesWinnerTeamA}  penaltiesWinnerTeamB: ${d.penaltiesWinnerTeamB}`)
  console.log(`  scorers (${(d.scorers??[]).length}):`)
  for (const s of d.scorers ?? []) {
    console.log(`    ${s.minute ?? '?'}' ${s.playerName ?? s.playerKey} (${s.teamSide}) goals=${s.goals}${s.ownGoal?' OG':''}${s.includesPenalties?' PEN':''}`)
  }
}
