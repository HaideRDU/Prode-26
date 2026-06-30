/**
 * Corrige goleadores faltantes en partidos R32 ya finalizados:
 *  - wc26-ko-73 (RSA 0-1 CAN): Stephen Eustaquio min 92 (CAN = teamB)
 *  - wc26-ko-76 (NED 1-1 MAR): Issa Diop min 91 (MAR = teamB) + penales MAR ganó 3-2
 *
 * Uso: npx tsx scripts/fix-r32-scorers.ts
 */
import './seed-load-env.ts'
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
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
  // ── wc26-ko-73: RSA 0-1 CAN ─────────────────────────────────────────────
  {
    const matchId = 'wc26-ko-73'
    const ref = db.collection('matches').doc(matchId)
    const snap = await ref.get()
    if (!snap.exists) { console.error(`${matchId} no existe`); process.exit(1) }
    const data = snap.data() as MatchDoc

    const goalsA = data.goalsTeamA ?? data.goalsHome
    const goalsB = data.goalsTeamB ?? data.goalsAway
    const teamA = data.teamAId ?? data.teamHomeId ?? '?'
    const teamB = data.teamBId ?? data.teamAwayId ?? '?'
    console.log(`${matchId}: ${teamA} ${goalsA}-${goalsB} ${teamB}  status=${data.status}`)
    console.log(`  Scorers actuales: ${JSON.stringify(data.scorers ?? [])}`)

    // Verificar que no esté ya cargado
    const yaExiste = (data.scorers ?? []).some(
      (s) => s.teamSide === 'teamB' && !s.ownGoal && !s.includesPenalties,
    )
    if (yaExiste) {
      console.log(`  ✅ Ya tiene gol de teamB — omitiendo`)
    } else {
      const newScorer: MatchScorerEntry = {
        playerKey: 'stephen-eustaquio',
        playerName: 'Stephen Eustaquio',
        goals: 1,
        minute: 92,
        teamSide: 'teamB',   // CAN es teamB (away)
      }
      const updated = [...(data.scorers ?? []), newScorer]
      await ref.set({ scorers: updated }, { merge: true })
      console.log(`  ✅ Añadido: Stephen Eustaquio (CAN) min 92`)
    }
  }

  // ── wc26-ko-76: NED 1-1 MAR (MAR ganó 3-2 en penales) ──────────────────
  {
    const matchId = 'wc26-ko-76'
    const ref = db.collection('matches').doc(matchId)
    const snap = await ref.get()
    if (!snap.exists) { console.error(`${matchId} no existe`); process.exit(1) }
    const data = snap.data() as MatchDoc

    const goalsA = data.goalsTeamA ?? data.goalsHome
    const goalsB = data.goalsTeamB ?? data.goalsAway
    const teamA = data.teamAId ?? data.teamHomeId ?? '?'
    const teamB = data.teamBId ?? data.teamAwayId ?? '?'
    console.log(`\n${matchId}: ${teamA} ${goalsA}-${goalsB} ${teamB}  status=${data.status}`)
    console.log(`  wentToPenalties=${data.wentToPenalties}  penaltiesWinnerTeamB=${data.penaltiesWinnerTeamB}`)
    console.log(`  Scorers actuales: ${JSON.stringify(data.scorers ?? [])}`)

    // Añadir Issa Diop si falta
    const yaExisteIssaDiop = (data.scorers ?? []).some(
      (s) => s.teamSide === 'teamB' && !s.ownGoal && !s.includesPenalties,
    )

    const patch: Record<string, unknown> = {}

    if (!yaExisteIssaDiop) {
      const issaDiop: MatchScorerEntry = {
        playerKey: 'issa-diop',
        playerName: 'Issa Diop',
        goals: 1,
        minute: 91,
        teamSide: 'teamB',   // MAR es teamB (away)
      }
      patch.scorers = [...(data.scorers ?? []), issaDiop]
      console.log(`  ✅ Añadido: Issa Diop (MAR) min 91`)
    } else {
      console.log(`  ✅ Ya tiene gol de teamB (Issa Diop) — scorers OK`)
    }

    // Añadir datos de penales si faltan
    if (!data.wentToPenalties) {
      patch.wentToPenalties = true
      patch.penaltiesWinnerTeamB = true   // MAR (teamB) ganó 3-2
      patch.penaltiesWinnerTeamA = false
      console.log(`  ✅ Añadido: wentToPenalties=true, penaltiesWinnerTeamB=true (MAR ganó 3-2)`)
    } else {
      console.log(`  ✅ Penales ya registrados`)
    }

    if (Object.keys(patch).length > 0) {
      await ref.set(patch, { merge: true })
    }
  }

  console.log('\n✅ Correcciones aplicadas. Ejecuta recalculate-standings.ts para actualizar puntos.')
}

main().catch((e) => {
  console.error('[fix-r32-scorers] ERROR', e)
  process.exit(1)
})
