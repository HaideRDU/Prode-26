/**
 * Corrige wc26-ko-75 (GER 1-1 PAR → PAR ganó 4-3 en penales).
 * Uso: npx tsx scripts/fix-ko75.ts
 */
import './seed-load-env.ts'
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import type { MatchDoc } from '../functions/lib/lib/types/predictions.js'

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.VITE_FIREBASE_PROJECT_ID

if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), ...(projectId ? { projectId } : {}) })
}

const db = getFirestore()

async function main(): Promise<void> {
  const matchId = 'wc26-ko-75'
  const ref = db.collection('matches').doc(matchId)
  const snap = await ref.get()
  if (!snap.exists) { console.error(`${matchId} no existe`); process.exit(1) }
  const data = snap.data() as MatchDoc

  const gA = data.goalsTeamA ?? data.goalsHome
  const gB = data.goalsTeamB ?? data.goalsAway
  console.log(`${matchId}: ${data.teamAId} ${gA}-${gB} ${data.teamBId}  status=${data.status}`)
  console.log(`  wentToPenalties=${data.wentToPenalties}`)
  console.log(`  scorers (${(data.scorers ?? []).length}):`)
  for (const s of data.scorers ?? []) {
    console.log(`    ${s.minute ?? '?'}' ${s.playerName} (${s.teamSide}) key=${s.playerKey}`)
  }

  // GER=teamA, PAR=teamB. PAR ganó 4-3 en penales. Score 1-1 en 90'+ET.
  await ref.set(
    {
      status: 'finished',
      goalsTeamA: 1,
      goalsTeamB: 1,
      goalsHome: FieldValue.delete(),
      goalsAway: FieldValue.delete(),
      teamHomeId: FieldValue.delete(),
      teamAwayId: FieldValue.delete(),
      penaltiesWinnerHome: FieldValue.delete(),
      penaltiesWinnerAway: FieldValue.delete(),
      wentToPenalties: true,
      penaltiesWinnerTeamA: false,   // GER perdió
      penaltiesWinnerTeamB: true,    // PAR ganó 4-3
      finishedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
  console.log('\n✅ wc26-ko-75: GER 1-1 PAR  wentToPenalties=true  penaltiesWinnerTeamB=true (PAR ganó 4-3)')
}

main().catch((e) => {
  console.error('[fix-ko75] ERROR', e)
  process.exit(1)
})
