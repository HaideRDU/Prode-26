/**
 * Audita puntos de predicciones en partidos de un día (torneo America/Bogota).
 * Uso: npm run build:functions && npx tsx scripts/audit-match-points.ts 2026-06-25
 */
import './seed-load-env.ts'
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { computeScoresForRoom } from '../functions/lib/lib/aggregateScores.js'
import { buildPlayerRosterIndex, resolvePickPlayer, teamIdsFromMatches } from '../functions/lib/lib/loadPlayerRosterIndex.js'
import { filterPredictionsForStandings, loadFinalizedUserIds } from '../functions/lib/lib/loadFinalizedUserIds.js'
import {
  scoreMatchPredictionDetails,
  scorePlayerPerMatchPick,
} from '../functions/lib/lib/scoring.js'
import type {
  MatchDoc,
  MatchPredictionPayload,
  PlayerPerMatchPayload,
  PredictionDoc,
  TournamentResultDoc,
} from '../functions/lib/lib/types/predictions.js'

const day = process.argv[2] ?? '2026-06-25'

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.VITE_FIREBASE_PROJECT_ID

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    ...(projectId ? { projectId } : {}),
  })
}

const db = getFirestore()

function tournamentDay(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms))
}

function kickoffMs(scheduledAt: unknown): number | null {
  if (scheduledAt && typeof scheduledAt === 'object' && 'toDate' in scheduledAt) {
    return (scheduledAt as { toDate(): Date }).toDate().getTime()
  }
  const ms = Date.parse(String(scheduledAt ?? ''))
  return Number.isFinite(ms) ? ms : null
}

function isMatchPayload(p: unknown): p is MatchPredictionPayload {
  return (
    typeof p === 'object' &&
    p !== null &&
    (('goalsTeamA' in p && typeof (p as MatchPredictionPayload).goalsTeamA === 'number') ||
      ('goalsHome' in p && typeof (p as MatchPredictionPayload).goalsHome === 'number'))
  )
}

function isPlayerPick(p: unknown): p is PlayerPerMatchPayload {
  return (
    typeof p === 'object' &&
    p !== null &&
    (p as PlayerPerMatchPayload).kind === 'player_match_pick'
  )
}

async function main(): Promise<void> {
  const matchesSnap = await db.collection('matches').get()
  const matchesById = new Map<string, MatchDoc>()
  const dayMatchIds = new Set<string>()

  matchesSnap.forEach((d) => {
    const data = d.data() as MatchDoc
    matchesById.set(d.id, data)
    const k = kickoffMs(data.scheduledAt)
    if (k != null && tournamentDay(k) === day) dayMatchIds.add(d.id)
  })

  console.log(`[audit] Día torneo ${day}: ${dayMatchIds.size} partidos`)
  console.log([...dayMatchIds].sort().join(', '))

  const predsSnap = await db.collection('predictions').get()
  const allPreds: PredictionDoc[] = []
  predsSnap.forEach((d) => allPreds.push({ id: d.id, ...(d.data() as PredictionDoc) }))

  const trSnap = await db.collection('tournamentResults').get()
  const tournamentResultsByQuestionId = new Map<string, TournamentResultDoc>()
  trSnap.forEach((d) => {
    const data = d.data() as TournamentResultDoc
    tournamentResultsByQuestionId.set(d.id, { ...data, questionId: d.id })
  })

  const playerRosterIndex = await buildPlayerRosterIndex(
    db,
    teamIdsFromMatches(matchesById.values()),
  )

  const roomIds = new Set<string>()
  for (const p of allPreds) {
    if (p.matchId && dayMatchIds.has(p.matchId)) roomIds.add(p.roomId)
  }

  console.log(`\n[audit] Salas con predicciones en esos partidos: ${roomIds.size}`)

  for (const roomId of [...roomIds].sort()) {
    const roomPreds = allPreds.filter((p) => p.roomId === roomId)
    const roomSnap = await db.collection('rooms').doc(roomId).get()
    const room = roomSnap.data() ?? {}
    const roomType = (room as { type?: string }).type ?? (roomId === 'global' ? 'global' : 'private')
    const enabledRaw = (room as { enabledQuestionIds?: string[] }).enabledQuestionIds
    const enabledQuestionIds =
      roomType === 'private' && Array.isArray(enabledRaw) && enabledRaw.length > 0
        ? new Set(enabledRaw)
        : null

    const predictionUserIds = [...new Set(roomPreds.map((p) => p.userId))]
    const finalizedUserIds = await loadFinalizedUserIds(db, roomId, predictionUserIds)
    const scoringPreds = filterPredictionsForStandings(roomPreds, finalizedUserIds)

    const computed = computeScoresForRoom(
      scoringPreds,
      matchesById,
      tournamentResultsByQuestionId,
      enabledQuestionIds,
      playerRosterIndex,
    )

    const standingsSnap = await db.collection('standings').doc(roomId).collection('users').get()
    const stored = new Map<string, { points: number; breakdown: Record<string, number> }>()
    standingsSnap.forEach((d) => {
      const data = d.data() as {
        points?: number
        breakdown?: Record<string, number>
      }
      stored.set(d.id, {
        points: data.points ?? 0,
        breakdown: data.breakdown ?? {},
      })
    })

    const mismatches: string[] = []
    for (const [uid, calc] of computed) {
      const s = stored.get(uid)
      if (!s) {
        if (calc.points !== 0) mismatches.push(`${uid}: sin doc standings (calc=${calc.points})`)
        continue
      }
      if (s.points !== calc.points) {
        mismatches.push(
          `${uid}: total stored=${s.points} calc=${calc.points} (match=${calc.breakdown.matchPoints} player=${calc.breakdown.playerPickPoints})`,
        )
      }
    }

    console.log(`\n=== Sala ${roomId} ===`)
    if (mismatches.length === 0) {
      console.log('Standings OK: totales coinciden con recálculo.')
    } else {
      console.log('DESFASES en standings:')
      mismatches.forEach((m) => console.log('  -', m))
    }

    console.log('\nDetalle partidos del día:')
    for (const matchId of [...dayMatchIds].sort()) {
      const match = matchesById.get(matchId)!
      const matchPreds = roomPreds.filter((p) => p.matchId === matchId)
      if (matchPreds.length === 0) continue

      const scoreA = match.goalsTeamA ?? match.goalsHome
      const scoreB = match.goalsTeamB ?? match.goalsAway
      console.log(
        `\n  ${matchId} ${match.teamAId}-${match.teamBId} resultado ${scoreA}-${scoreB} status=${match.status}`,
      )

      const byUser = new Map<string, { match?: PredictionDoc; pick?: PredictionDoc }>()
      for (const p of matchPreds) {
        const row = byUser.get(p.userId) ?? {}
        if (isMatchPayload(p.payload)) row.match = p
        if (isPlayerPick(p.payload)) row.pick = p
        byUser.set(p.userId, row)
      }

      for (const [uid, row] of byUser) {
        if (!finalizedUserIds.has(uid) && roomType === 'private') {
          console.log(`    ${uid}: excluido (no finalizado)`)
          continue
        }
        let matchPts = 0
        let matchDetail = 'sin predicción marcador'
        if (row.match && isMatchPayload(row.match.payload)) {
          const det = scoreMatchPredictionDetails(match, row.match.payload)
          matchPts = det.points
          const pred = row.match.payload
          const pa = pred.goalsTeamA ?? pred.goalsHome
          const pb = pred.goalsTeamB ?? pred.goalsAway
          matchDetail = `pred ${pa}-${pb} → ${matchPts} pts (ganador:${det.winnerOrDrawHit ? '✓' : '✗'} A:${det.exactScoreHit || pa === scoreA ? '?' : ''})`
          matchDetail = `pred ${pa}-${pb} → ${matchPts} pts [ganador:${det.winnerOrDrawHit ? '✓' : '✗'} golesA:${pa === scoreA ? '✓' : '✗'} golesB:${pb === scoreB ? '✓' : '✗'}]`
        }

        let pickPts = 0
        let pickDetail = 'sin bonus jugador'
        if (row.pick && isPlayerPick(row.pick.payload)) {
          const key = String(row.pick.payload.playerKey ?? '').trim()
          if (key) {
            const pickPlayer = resolvePickPlayer(key, playerRosterIndex)
            pickPts = scorePlayerPerMatchPick(match, key, pickPlayer)
            pickDetail = `jugador ${key} → ${pickPts} pts`
          } else {
            pickDetail = 'jugador (clave inválida)'
          }
        }

        console.log(`    ${uid}: ${matchDetail} | ${pickDetail} | subtotal ${matchPts + pickPts}`)
      }
    }
  }
}

main().catch((e) => {
  console.error('[audit] ERROR', e)
  process.exit(1)
})
