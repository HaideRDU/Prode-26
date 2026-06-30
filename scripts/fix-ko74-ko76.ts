/**
 * Corrige dos partidos R32:
 *  - wc26-ko-74 (BRA 2-1 JPN): marca como finalizado, añade goles de Casemiro (56') y Martinelli (96')
 *  - wc26-ko-76 (NED 1-1 MAR): corrige score 1-2→1-1 y re-aplica datos de penales (MAR ganó 3-2)
 *
 * El sync TSDB sobreescribió los datos de ko-76 porque no tiene el strResult con "(3-2 pens)".
 * También se parchea matchUpdateChanged para proteger wentToPenalties confirmado.
 *
 * Uso: npx tsx scripts/fix-ko74-ko76.ts
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

async function main(): Promise<void> {
  // ── wc26-ko-74: BRA 2-1 JPN ─────────────────────────────────────────────
  {
    const matchId = 'wc26-ko-74'
    const ref = db.collection('matches').doc(matchId)
    const snap = await ref.get()
    if (!snap.exists) { console.error(`${matchId} no existe`); process.exit(1) }
    const data = snap.data() as MatchDoc

    const gA = data.goalsTeamA ?? data.goalsHome
    const gB = data.goalsTeamB ?? data.goalsAway
    const tA = data.teamAId ?? data.teamHomeId ?? '?'
    const tB = data.teamBId ?? data.teamAwayId ?? '?'
    console.log(`\n${matchId}: ${tA} ${gA}-${gB} ${tB}  status=${data.status}`)
    console.log(`  Scorers actuales (${(data.scorers ?? []).length}):`)
    for (const s of data.scorers ?? []) console.log(`    ${s.minute ?? '?'}' ${s.playerName}  (${s.teamSide})`)

    // Mantener scorer de Kaishu Sano (JPN, teamB, 29') que ya existe
    // Añadir Casemiro (BRA, teamA, 56') y Martinelli (BRA, teamA, 96')
    const existingKeys = new Set((data.scorers ?? []).map((s) => s.playerKey))

    const newScorers: MatchScorerEntry[] = [...(data.scorers ?? [])]

    if (!existingKeys.has('casemiro') && !existingKeys.has('BRA10')) {
      newScorers.push({
        playerKey: 'casemiro',
        playerName: 'Casemiro',
        goals: 1,
        minute: 56,
        teamSide: 'teamA',   // BRA es teamA
      })
      console.log('  ✅ Añadido: Casemiro (BRA) min 56')
    } else {
      console.log('  ✅ Casemiro ya existe — omitiendo')
    }

    if (!existingKeys.has('gabriel-martinelli') && !existingKeys.has('BRA13')) {
      newScorers.push({
        playerKey: 'gabriel-martinelli',
        playerName: 'Gabriel Martinelli',
        goals: 1,
        minute: 96,
        teamSide: 'teamA',   // BRA es teamA
      })
      console.log('  ✅ Añadido: Gabriel Martinelli (BRA) min 96')
    } else {
      console.log('  ✅ Martinelli ya existe — omitiendo')
    }

    await ref.set(
      {
        status: 'finished',
        goalsTeamA: 2,
        goalsTeamB: 1,
        goalsHome: FieldValue.delete(),
        goalsAway: FieldValue.delete(),
        wentToPenalties: false,
        penaltiesWinnerTeamA: null,
        penaltiesWinnerTeamB: null,
        finishedAt: FieldValue.serverTimestamp(),
        scorers: newScorers,
      },
      { merge: true },
    )
    console.log(`  ✅ ${matchId}: BRA 2-1 JPN — status=finished, scorers=${newScorers.length}`)
  }

  // ── wc26-ko-76: NED 1-1 MAR (MAR ganó 3-2 en penales) ──────────────────
  {
    const matchId = 'wc26-ko-76'
    const ref = db.collection('matches').doc(matchId)
    const snap = await ref.get()
    if (!snap.exists) { console.error(`${matchId} no existe`); process.exit(1) }
    const data = snap.data() as MatchDoc

    const gA = data.goalsTeamA ?? data.goalsHome
    const gB = data.goalsTeamB ?? data.goalsAway
    const tA = data.teamAId ?? data.teamHomeId ?? '?'
    const tB = data.teamBId ?? data.teamAwayId ?? '?'
    console.log(`\n${matchId}: ${tA} ${gA}-${gB} ${tB}  status=${data.status}`)
    console.log(`  wentToPenalties=${data.wentToPenalties}  penaltiesWinnerTeamB=${data.penaltiesWinnerTeamB}`)
    console.log(`  Scorers (${(data.scorers ?? []).length}):`)
    for (const s of data.scorers ?? []) console.log(`    ${s.minute ?? '?'}' ${s.playerName}  (${s.teamSide})`)

    // Corregir score 1-2 → 1-1 y re-aplicar datos de penales
    await ref.set(
      {
        goalsTeamA: 1,   // NED
        goalsTeamB: 1,   // MAR (era 2 por error del sync TSDB)
        goalsHome: FieldValue.delete(),
        goalsAway: FieldValue.delete(),
        wentToPenalties: true,
        penaltiesWinnerTeamA: false,
        penaltiesWinnerTeamB: true,   // MAR (teamB) ganó 3-2 en penales
      },
      { merge: true },
    )
    console.log(`  ✅ ${matchId}: NED 1-1 MAR  wentToPenalties=true  penaltiesWinnerTeamB=true`)
  }

  console.log('\n✅ Correcciones aplicadas. Ejecutando recalculate-standings...')
}

main().catch((e) => {
  console.error('[fix-ko74-ko76] ERROR', e)
  process.exit(1)
})
