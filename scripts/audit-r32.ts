/**
 * Auditoría completa de partidos R32 (wc26-ko-73 a wc26-ko-88):
 *  - Completitud de goleadores vs marcador
 *  - Predicciones y puntos calculados vs almacenados en standings
 *
 * Uso: npx tsx scripts/audit-r32.ts
 */
import './seed-load-env.ts'
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import type {
  MatchDoc,
  MatchPredictionPayload,
  PlayerPerMatchPayload,
  PredictionDoc,
  TournamentResultDoc,
} from '../functions/lib/lib/types/predictions.js'
import {
  scoreMatchPredictionDetails,
  scorePlayerPerMatchPick,
} from '../functions/lib/lib/scoring.js'
import { getPredictedKoLineupForMatch } from '../functions/lib/lib/koPredictedLineup.js'
import { buildPlayerRosterIndex, resolvePickPlayer, teamIdsFromMatches } from '../functions/lib/lib/loadPlayerRosterIndex.js'
import { filterPredictionsForStandings, loadFinalizedUserIds } from '../functions/lib/lib/loadFinalizedUserIds.js'

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.VITE_FIREBASE_PROJECT_ID

if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), ...(projectId ? { projectId } : {}) })
}

const db = getFirestore()

const R32_IDS = Array.from({ length: 16 }, (_, i) => `wc26-ko-${73 + i}`)

function isMatchPayload(p: unknown): p is MatchPredictionPayload {
  return (
    typeof p === 'object' && p !== null &&
    (typeof (p as MatchPredictionPayload).goalsTeamA === 'number' ||
      typeof (p as MatchPredictionPayload).goalsHome === 'number')
  )
}

function isPlayerPick(p: unknown): p is PlayerPerMatchPayload {
  return typeof p === 'object' && p !== null && (p as PlayerPerMatchPayload).kind === 'player_match_pick'
}

function scorersGoalCount(scorers: MatchDoc['scorers']): number {
  return (scorers ?? []).filter((s) => !s.includesPenalties).reduce((n, s) => n + (s.goals > 0 ? s.goals : 1), 0)
}

function teamLabel(id: string, matchDoc: MatchDoc): string {
  if (!id) return '?'
  if (id === matchDoc.teamAId || id === matchDoc.teamHomeId) return `${id}(A)`
  if (id === matchDoc.teamBId || id === matchDoc.teamAwayId) return `${id}(B)`
  return id
}

async function main(): Promise<void> {
  console.log('══════════════════════════════════════════════════')
  console.log('  AUDITORÍA R32 — Goleadores + Predicciones')
  console.log('══════════════════════════════════════════════════\n')

  // ── Carga datos base ─────────────────────────────────────────────────────
  const matchesSnap = await db.collection('matches').get()
  const matchesById = new Map<string, MatchDoc>()
  matchesSnap.forEach((d) => matchesById.set(d.id, d.data() as MatchDoc))

  const playerRosterIndex = await buildPlayerRosterIndex(db, teamIdsFromMatches(matchesById.values()))

  const predsSnap = await db.collection('predictions').get()
  const allPreds: PredictionDoc[] = []
  predsSnap.forEach((d) => allPreds.push({ id: d.id, ...(d.data() as PredictionDoc) }))

  const trSnap = await db.collection('tournamentResults').get()
  const tournamentResultsByQuestionId = new Map<string, TournamentResultDoc>()
  trSnap.forEach((d) => tournamentResultsByQuestionId.set(d.id, { ...d.data() as TournamentResultDoc, questionId: d.id }))

  // ── Sección 1: Estado de goleadores por partido ──────────────────────────
  console.log('━━ SECCIÓN 1: GOLEADORES POR PARTIDO R32 ━━━━━━━━\n')

  let totalScorersIssues = 0

  for (const matchId of R32_IDS) {
    const match = matchesById.get(matchId)
    if (!match) {
      console.log(`${matchId}: ❌ NO EXISTE en Firestore`)
      totalScorersIssues++
      continue
    }

    const goalsA = match.goalsTeamA ?? match.goalsHome ?? null
    const goalsB = match.goalsTeamB ?? match.goalsAway ?? null
    const teamA = match.teamAId ?? match.teamHomeId ?? '?'
    const teamB = match.teamBId ?? match.teamAwayId ?? '?'

    if (match.status !== 'finished') {
      const scoreStr = goalsA !== null ? `${goalsA}-${goalsB}` : 'sin marcador'
      console.log(`${matchId} [${match.status?.toUpperCase() ?? 'SIN STATUS'}] ${teamA} vs ${teamB} ${scoreStr}`)
      continue
    }

    const expectedGoals = (goalsA ?? 0) + (goalsB ?? 0)
    const scorerCount = scorersGoalCount(match.scorers)
    const incomplete = scorerCount < expectedGoals
    const scorerStatus = incomplete ? `⚠️  INCOMPLETO (${scorerCount}/${expectedGoals})` : `✅ OK (${scorerCount}/${expectedGoals})`

    console.log(`\n${matchId} ✔ FINALIZADO  ${teamA} ${goalsA}-${goalsB} ${teamB}`)
    console.log(`  Goleadores: ${scorerStatus}`)

    if ((match.scorers?.length ?? 0) === 0) {
      console.log(`  ⚠️  Sin entradas de goleadores`)
      if (incomplete) totalScorersIssues++
      continue
    }

    for (const s of match.scorers ?? []) {
      const side = s.teamSide === 'teamA' ? teamA : s.teamSide === 'teamB' ? teamB : '?'
      const flags: string[] = []
      if (s.ownGoal) flags.push('OG')
      if (s.includesPenalties) flags.push('PEN')
      const flagStr = flags.length ? ` [${flags.join(',')}]` : ''
      const min = s.minute != null ? `${s.minute}'` : '--'
      const goals = s.goals > 1 ? ` x${s.goals}` : ''
      console.log(`    ${min} ${s.playerName ?? s.playerKey}${goals}  (${side})${flagStr}`)
    }

    if (incomplete) totalScorersIssues++
  }

  console.log(`\nTotal partidos con goleadores incompletos: ${totalScorersIssues === 0 ? '✅ NINGUNO' : `⚠️  ${totalScorersIssues}`}`)

  // ── Sección 2: Predicciones y puntos ─────────────────────────────────────
  console.log('\n\n━━ SECCIÓN 2: PREDICCIONES R32 Y PUNTOS ━━━━━━━━━\n')

  const finishedR32 = R32_IDS.filter((id) => matchesById.get(id)?.status === 'finished')
  if (finishedR32.length === 0) {
    console.log('Ningún partido R32 finalizado aún.')
    return
  }

  // Agrupar salas que tienen predicciones en R32
  const roomIds = new Set<string>()
  for (const p of allPreds) {
    if (p.matchId && R32_IDS.includes(p.matchId)) roomIds.add(p.roomId)
  }

  console.log(`Salas con predicciones en R32: ${[...roomIds].sort().join(', ')}\n`)

  let totalMismatches = 0

  for (const roomId of [...roomIds].sort()) {
    const roomPreds = allPreds.filter((p) => p.roomId === roomId)
    const roomSnap = await db.collection('rooms').doc(roomId).get()
    const room = roomSnap.data() ?? {}
    const roomName = (room as { name?: string }).name ?? roomId

    const predUserIds = [...new Set(roomPreds.map((p) => p.userId))]
    const finalizedUserIds = await loadFinalizedUserIds(db, roomId, predUserIds)
    const scoringPreds = filterPredictionsForStandings(roomPreds, finalizedUserIds)

    const standingsSnap = await db.collection('standings').doc(roomId).collection('users').get()
    const storedByUser = new Map<string, number>()
    standingsSnap.forEach((d) => storedByUser.set(d.id, (d.data() as { points?: number }).points ?? 0))

    // Calcular puntos de cada usuario SOLO en partidos R32 finalizados
    const userIds = [...new Set(scoringPreds.map((p) => p.userId))]

    console.log(`\n═══ Sala: ${roomName} (${roomId}) ═══`)
    console.log(`Usuarios con predicciones finalizadas: ${userIds.length}`)

    for (const matchId of finishedR32) {
      const match = matchesById.get(matchId)!
      const goalsA = match.goalsTeamA ?? match.goalsHome ?? null
      const goalsB = match.goalsTeamB ?? match.goalsAway ?? null
      const teamA = match.teamAId ?? '?'
      const teamB = match.teamBId ?? '?'

      const matchPreds = scoringPreds.filter((p) => p.matchId === matchId)
      if (matchPreds.length === 0) continue

      console.log(`\n  ── ${matchId}  ${teamA} ${goalsA}-${goalsB} ${teamB} ──`)
      console.log(`     Goleadores: ${(match.scorers ?? []).map((s) => `${s.playerName ?? s.playerKey}(${s.goals}g${s.ownGoal ? ' OG' : ''})`).join(', ') || '(ninguno)'}`)

      const byUser = new Map<string, { pred?: PredictionDoc; pick?: PredictionDoc }>()
      for (const p of scoringPreds.filter((p) => p.matchId === matchId || (p.scope === 'player_per_match' && p.matchId === matchId))) {
        const row = byUser.get(p.userId) ?? {}
        if (p.scope === 'match' && isMatchPayload(p.payload)) row.pred = p
        if (p.scope === 'player_per_match' && isPlayerPick(p.payload)) row.pick = p
        byUser.set(p.userId, row)
      }

      for (const uid of userIds) {
        const userAllPreds = scoringPreds.filter((p) => p.userId === uid)
        const predPick = byUser.get(uid)
        const predDoc = predPick?.pred
        const pickDoc = predPick?.pick

        // Cruce predicho para este match
        const lineup = getPredictedKoLineupForMatch(userAllPreds, matchId)
        const predPayload = predDoc && isMatchPayload(predDoc.payload) ? predDoc.payload : null

        let matchPts = 0
        let predStr = 'sin predicción'
        let lineupStr = `cruce: ${lineup.predictedTeamAId ?? '?'} vs ${lineup.predictedTeamBId ?? '?'}`

        if (predPayload) {
          const pa = predPayload.goalsTeamA ?? predPayload.goalsHome
          const pb = predPayload.goalsTeamB ?? predPayload.goalsAway
          const details = scoreMatchPredictionDetails(match, predPayload, lineup)
          matchPts = details.points
          predStr = `pred ${pa}-${pb} → ${matchPts}pts [G:${details.winnerOrDrawHit ? '✓' : '✗'} A:${details.goalsAHit ? '✓' : '✗'} B:${details.goalsBHit ? '✓' : '✗'}]`
        }

        let bonusPts = 0
        let bonusStr = 'sin jugador bonus'
        if (pickDoc && isPlayerPick(pickDoc.payload)) {
          const key = pickDoc.payload.playerKey
          const pickPlayer = resolvePickPlayer(key, playerRosterIndex)
          bonusPts = scorePlayerPerMatchPick(match, key, pickPlayer)
          bonusStr = `bonus ${pickPlayer?.name ?? key} → ${bonusPts}pts`
        }

        const subtotal = matchPts + bonusPts
        const issue = subtotal > 0 ? '' : ''
        console.log(`     ${uid}: ${lineupStr} | ${predStr} | ${bonusStr}${issue}`)
      }
    }

    // Verificar si el total almacenado está razonablemente alineado
    console.log('\n  Verificación totales almacenados vs. calculados (TODOS los partidos, no solo R32):')
    for (const uid of userIds) {
      const stored = storedByUser.get(uid) ?? 0
      const userR32Pts = finishedR32.reduce((sum, mid) => {
        const match = matchesById.get(mid)!
        const userAllPreds = scoringPreds.filter((p) => p.userId === uid)
        const predDoc = scoringPreds.find((p) => p.userId === uid && p.matchId === mid && p.scope === 'match')
        const pickDoc = scoringPreds.find((p) => p.userId === uid && p.matchId === mid && p.scope === 'player_per_match')
        const predPayload = predDoc && isMatchPayload(predDoc.payload) ? predDoc.payload : null
        const lineup = getPredictedKoLineupForMatch(userAllPreds, mid)
        const mPts = predPayload ? scoreMatchPredictionDetails(match, predPayload, lineup).points : 0
        const bPts = pickDoc && isPlayerPick(pickDoc.payload)
          ? scorePlayerPerMatchPick(match, pickDoc.payload.playerKey, resolvePickPlayer(pickDoc.payload.playerKey, playerRosterIndex))
          : 0
        return sum + mPts + bPts
      }, 0)
      console.log(`    ${uid}: stored=${stored}pts | R32 calc=${userR32Pts}pts`)
    }

    if (totalMismatches > 0) {
      console.log(`\n  ⚠️  ${totalMismatches} desfase(s) detectados`)
    }
  }

  console.log('\n\n══════════════════════════════════════════════════')
  console.log('  Auditoría completa.')
  console.log('══════════════════════════════════════════════════')
}

main().catch((e) => {
  console.error('[audit-r32] ERROR', e)
  process.exit(1)
})
