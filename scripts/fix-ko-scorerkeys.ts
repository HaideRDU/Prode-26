/**
 * Corrige playerKeys de goleadores en ko-73, ko-74 y ko-76,
 * y elimina campos legacy (goalsHome/Away, teamHomeId/AwayId).
 * También re-aplica el score correcto de ko-76 (1-1, penales MAR).
 *
 * Uso: npx tsx scripts/fix-ko-scorerkeys.ts
 */
import './seed-load-env.ts'
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import type { MatchDoc, MatchScorerEntry } from '../functions/lib/lib/types/predictions.js'

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.VITE_FIREBASE_PROJECT_ID

if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), ...(projectId ? { projectId } : {}) })
}

const db = getFirestore()

function deleteFields() {
  return {
    goalsHome: FieldValue.delete(),
    goalsAway: FieldValue.delete(),
    teamHomeId: FieldValue.delete(),
    teamAwayId: FieldValue.delete(),
    penaltiesWinnerHome: FieldValue.delete(),
    penaltiesWinnerAway: FieldValue.delete(),
  }
}

async function fixMatch(
  matchId: string,
  patchFn: (data: MatchDoc) => Record<string, unknown>,
): Promise<void> {
  const ref = db.collection('matches').doc(matchId)
  const snap = await ref.get()
  if (!snap.exists) { console.error(`${matchId} no existe`); return }
  const data = snap.data() as MatchDoc

  const gA = data.goalsTeamA ?? data.goalsHome
  const gB = data.goalsTeamB ?? data.goalsAway
  console.log(`\n${matchId}: ${data.teamAId} ${gA}-${gB} ${data.teamBId}  status=${data.status}`)
  console.log(`  scorers actuales:`, (data.scorers ?? []).map(s => `${s.playerKey}(${s.teamSide})`).join(', '))

  const patch = patchFn(data)
  await ref.set(patch, { merge: true })
  console.log(`  ✅ parcheado`)
}

async function main(): Promise<void> {

  // ── ko-73: RSA 0-1 CAN ────────────────────────────────────────────────────
  await fixMatch('wc26-ko-73', (data) => {
    const scorers: MatchScorerEntry[] = (data.scorers ?? []).map((s) => {
      if (s.playerKey === 'stephen-eustaquio') {
        return { ...s, playerKey: '3-stephen-eustaquio', playerName: 'Stephen Eustáquio' }
      }
      return s
    })
    return {
      scorers,
      goalsTeamA: 0,
      goalsTeamB: 1,
      ...deleteFields(),
    }
  })

  // ── ko-74: BRA 2-1 JPN ────────────────────────────────────────────────────
  await fixMatch('wc26-ko-74', (data) => {
    const scorers: MatchScorerEntry[] = (data.scorers ?? []).map((s) => {
      if (s.playerKey === 'casemiro') {
        return { ...s, playerKey: '3-casemiro', playerName: 'Casemiro' }
      }
      if (s.playerKey === 'gabriel-martinelli') {
        return { ...s, playerKey: '4-gabriel-martinelli', playerName: 'Gabriel Martinelli' }
      }
      return s
    })
    return {
      scorers,
      goalsTeamA: 2,
      goalsTeamB: 1,
      status: 'finished',
      wentToPenalties: false,
      penaltiesWinnerTeamA: null,
      penaltiesWinnerTeamB: null,
      ...deleteFields(),
    }
  })

  // ── ko-76: NED 1-1 MAR (penales: MAR 3-2) ────────────────────────────────
  await fixMatch('wc26-ko-76', (data) => {
    const scorers: MatchScorerEntry[] = (data.scorers ?? []).map((s) => {
      if (s.playerKey === 'issa-diop') {
        return { ...s, playerKey: '2-issa-diop', playerName: 'Issa Diop' }
      }
      return s
    })
    return {
      scorers,
      goalsTeamA: 1,   // NED
      goalsTeamB: 1,   // MAR  (el sync TSDB reporta mal 1-2)
      status: 'finished',
      wentToPenalties: true,
      penaltiesWinnerTeamA: false,
      penaltiesWinnerTeamB: true,   // MAR ganó 3-2
      ...deleteFields(),
    }
  })

  console.log('\n✅ Todas las correcciones aplicadas.')
  console.log('⚠️  Despliega las Cloud Functions para evitar que el sync revierta ko-76:')
  console.log('   npm run deploy:functions')
}

main().catch((e) => {
  console.error('[fix-ko-scorerkeys] ERROR', e)
  process.exit(1)
})
