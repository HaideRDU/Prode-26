/**
 * Copia de simulate-random-scoring-data.ts: llena resultados oficiales + predicciones
 * en cascada (grupos → KO), con Costa de Marfil (CIV) como campeón del torneo.
 *
 * Uso:
 *   npm run simulate:scoring:civ
 *   npm run simulate:scoring:civ -- --champion=CIV --user=<uid> --room=global
 */
import './seed-load-env.ts'
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { BONUS_QUESTION_IDS, EXTRA_IDS } from '../src/data/questionIds.ts'
import {
  getChampionAndRunnerUpFromPredictions,
  getThirdAndFourthFromPredictions,
} from '../src/domain/bracketResolve.ts'
import { WC26_KO_MATCHES } from '../src/data/wc2026/knockoutBracket.ts'
import type {
  MatchDoc,
  MatchPredictionPayload,
  PredictionDoc,
  TournamentPredictionPayload,
} from '../src/types/predictions.ts'
import { finishedMatchUpdate, koMatchTeamsUpdate } from './lib/matchFinishedUpdate.ts'
import { cascadeKoMatches } from './lib/wc26BracketCascade.ts'
import { formatPodiumLog, syncTournamentResultsFromMatches } from './lib/syncTournamentResultsFromMatches.ts'
import {
  buildGroupPredictionsForChampion,
  koPayloadWinner,
  randomGroupPayload,
  randomKnockoutPayload,
} from './lib/predictionChampion.ts'

const CHAMPION_ID = 'CIV'

const args = process.argv.slice(2)
const roomArg = args.find((x) => x.startsWith('--room='))?.slice('--room='.length).trim()
const userArg = args.find((x) => x.startsWith('--user='))?.slice('--user='.length).trim()
const championArg =
  args.find((x) => x.startsWith('--champion='))?.slice('--champion='.length).trim().toUpperCase() ||
  CHAMPION_ID
const dryRun = args.includes('--dry-run')

const roomId = roomArg || 'global'
const championId = championArg

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  process.env.VITE_FIREBASE_PROJECT_ID

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    ...(projectId ? { projectId } : {}),
  })
}

const db = getFirestore()

function predictionDocId(room: string, user: string, key: string): string {
  const safe = key.replace(/\//g, '_')
  return `${room}_${user}_${safe}`.slice(0, 700)
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pickRandom<T>(list: readonly T[]): T {
  return list[randInt(0, list.length - 1)]!
}

function koPayloadForChampion(homeId: string, awayId: string): MatchPredictionPayload {
  if (homeId === championId || awayId === championId) {
    return koPayloadWinner(homeId, awayId, championId)
  }
  return randomKnockoutPayload()
}

async function resolveUserId(targetRoomId: string): Promise<string> {
  if (userArg) return userArg
  const memberSnap = await db.collection('roomMembers').where('roomId', '==', targetRoomId).limit(1).get()
  if (!memberSnap.empty) {
    const uid = String(memberSnap.docs[0]!.data().userId ?? '').trim()
    if (uid) return uid
  }
  throw new Error(
    `No se encontró userId para room=${targetRoomId}. Pasa --user=<uid> o agrega un roomMember en esa sala.`,
  )
}

async function ensureRoomMember(targetRoomId: string, userId: string): Promise<void> {
  const id = `${targetRoomId}_${userId}`
  const ref = db.collection('roomMembers').doc(id)
  const snap = await ref.get()
  if (snap.exists) return
  await ref.set({
    roomId: targetRoomId,
    userId,
    displayName: userId,
    joinedAt: FieldValue.serverTimestamp(),
  })
}

async function loadAllTeamIds(): Promise<string[]> {
  const snap = await db.collection('teams').get()
  return snap.docs.map((d) => d.id)
}

async function loadRandomPlayerKeyByType(goalkeeperOnly: boolean): Promise<string | null> {
  const teams = await db.collection('teams').listDocuments()
  const pool: string[] = []
  for (const teamRef of teams) {
    const playersSnap = await teamRef.collection('players').limit(40).get()
    for (const doc of playersSnap.docs) {
      const data = doc.data() as { position?: string; paniniStickerCode?: string }
      const key = (data.paniniStickerCode?.trim() || doc.id).trim()
      if (!key) continue
      const pos = (data.position ?? '').toLowerCase()
      const isGk =
        pos.includes('gk') ||
        pos.includes('goalkeeper') ||
        pos.includes('keeper') ||
        pos.includes('portero') ||
        pos.includes('arquero')
      if (goalkeeperOnly && !isGk) continue
      pool.push(key)
    }
  }
  if (pool.length === 0) return null
  return pickRandom(pool)
}

function tournamentPayloadsFromBracket(
  teamIds: string[],
  topScorerPlayerId: string,
  gkPlayerId: string,
  groupPred: Map<string, MatchPredictionPayload>,
  koPred: Map<string, MatchPredictionPayload>,
): Array<{ questionId: string; payload: TournamentPredictionPayload }> {
  const { championId: bracketChampion, runnerUpId } = getChampionAndRunnerUpFromPredictions(groupPred, koPred)
  const { thirdId, fourthId } = getThirdAndFourthFromPredictions(groupPred, koPred)

  const champion = bracketChampion ?? championId
  let runnerUp = runnerUpId ?? pickRandom(teamIds.filter((t) => t !== champion))
  if (runnerUp === champion) runnerUp = pickRandom(teamIds)

  let third = thirdId ?? pickRandom(teamIds)
  while ((third === champion || third === runnerUp) && teamIds.length > 2) third = pickRandom(teamIds)

  let fourth = fourthId ?? pickRandom(teamIds)
  while ((fourth === champion || fourth === runnerUp || fourth === third) && teamIds.length > 3) {
    fourth = pickRandom(teamIds)
  }

  return [
    { questionId: EXTRA_IDS.champion, payload: { kind: 'team', teamId: champion } },
    { questionId: EXTRA_IDS.runnerUp, payload: { kind: 'team', teamId: runnerUp } },
    { questionId: EXTRA_IDS.thirdPlace, payload: { kind: 'team', teamId: third } },
    { questionId: EXTRA_IDS.fourthPlace, payload: { kind: 'team', teamId: fourth } },
    { questionId: EXTRA_IDS.topScorer, payload: { kind: 'player', playerId: topScorerPlayerId } },
    {
      questionId: EXTRA_IDS.bestGoalkeeperAverage,
      payload: { kind: 'player', playerId: gkPlayerId },
    },
    ...BONUS_QUESTION_IDS.map((id) => {
      if (id === 'q_special_biggest_win_scoreline') {
        return { questionId: id, payload: { kind: 'text', value: `${randInt(3, 7)}-${randInt(0, 2)}` } }
      }
      if (id === 'q_special_first_goal_colombia') {
        return { questionId: id, payload: { kind: 'text', value: 'Jugador Colombia' } }
      }
      return { questionId: id, payload: { kind: 'team', teamId: pickRandom(teamIds) } }
    }),
  ]
}

function assertChampionFromBracket(
  label: string,
  groupMap: Map<string, MatchPredictionPayload>,
  koMap: Map<string, MatchPredictionPayload>,
): void {
  const { championId: got } = getChampionAndRunnerUpFromPredictions(groupMap, koMap)
  if (got !== championId) {
    throw new Error(`${label}: se esperaba campeón ${championId}, obtuvo ${got ?? 'null'}`)
  }
}

async function main(): Promise<void> {
  const userId = await resolveUserId(roomId)
  await ensureRoomMember(roomId, userId)

  const matchSnap = await db.collection('matches').get()
  const matches = matchSnap.docs.map((d) => ({ id: d.id, ...(d.data() as MatchDoc) }))
  const groupMatches = matches.filter((m) => m.phase === 'group')

  const teamIds = await loadAllTeamIds()
  if (teamIds.length === 0) throw new Error('No hay teams en Firestore')
  if (!teamIds.includes(championId)) {
    throw new Error(`Campeón "${championId}" no existe en teams/`)
  }

  const topScorerPlayer = await loadRandomPlayerKeyByType(false)
  const gkPlayer = (await loadRandomPlayerKeyByType(true)) ?? topScorerPlayer
  if (!topScorerPlayer || !gkPlayer) {
    throw new Error('No hay jugadores en teams/*/players para armar predicciones especiales.')
  }

  const championGroupScores = buildGroupPredictionsForChampion(championId)

  const officialGroupScores = new Map<string, MatchPredictionPayload>()
  for (const m of groupMatches) {
    officialGroupScores.set(m.id, championGroupScores.get(m.id) ?? randomGroupPayload())
  }

  const userGroupPred = new Map(officialGroupScores)

  const { koScores: officialKoScores, resolvedCount: koOfficialPreview } = cascadeKoMatches(
    officialGroupScores,
    (slot) => koPayloadForChampion(slot.homeId, slot.awayId),
  )
  assertChampionFromBracket('Oficial (preview)', officialGroupScores, officialKoScores)

  const { koScores: userKoPred, resolvedCount: koPredCount } = cascadeKoMatches(userGroupPred, (slot) =>
    koPayloadForChampion(slot.homeId, slot.awayId),
  )
  assertChampionFromBracket('Predicciones', userGroupPred, userKoPred)

  const tournamentEntries = tournamentPayloadsFromBracket(
    teamIds,
    topScorerPlayer,
    gkPlayer,
    userGroupPred,
    userKoPred,
  )

  if (dryRun) {
    console.log('[simulate:scoring:civ] DRY RUN', {
      roomId,
      userId,
      championId,
      groupMatches: groupMatches.length,
      koSlotsTotal: WC26_KO_MATCHES.length,
      officialKoFinished: koOfficialPreview,
      userKoPredictions: koPredCount,
      tournamentPredictions: tournamentEntries.length,
    })
    return
  }

  const writer = db.bulkWriter()

  for (const m of groupMatches) {
    const payload = officialGroupScores.get(m.id)!
    writer.set(db.collection('matches').doc(m.id), finishedMatchUpdate(payload), { merge: true })
  }

  const { resolvedCount: koOfficialFinished } = cascadeKoMatches(officialGroupScores, (slot) => {
    const payload = koPayloadForChampion(slot.homeId, slot.awayId)
    writer.set(
      db.collection('matches').doc(slot.matchId),
      {
        ...koMatchTeamsUpdate(slot.homeId, slot.awayId),
        teamAId: slot.homeId,
        teamBId: slot.awayId,
        phase: 'knockout',
        round: slot.round,
        ...finishedMatchUpdate(payload),
      },
      { merge: true },
    )
    return payload
  })

  for (const [matchId, payload] of userGroupPred) {
    const data: PredictionDoc = {
      userId,
      roomId,
      scope: 'match',
      matchId,
      payload,
      updatedAt: FieldValue.serverTimestamp(),
    }
    writer.set(db.collection('predictions').doc(predictionDocId(roomId, userId, `m_${matchId}`)), data, {
      merge: true,
    })
  }

  for (const [matchId, payload] of userKoPred) {
    const data: PredictionDoc = {
      userId,
      roomId,
      scope: 'match',
      matchId,
      payload,
      updatedAt: FieldValue.serverTimestamp(),
    }
    writer.set(db.collection('predictions').doc(predictionDocId(roomId, userId, `m_${matchId}`)), data, {
      merge: true,
    })
  }

  for (const entry of tournamentEntries) {
    const data: PredictionDoc = {
      userId,
      roomId,
      scope: 'tournament',
      questionId: entry.questionId,
      payload: entry.payload,
      updatedAt: FieldValue.serverTimestamp(),
    }
    writer.set(db.collection('predictions').doc(predictionDocId(roomId, userId, `t_${entry.questionId}`)), data, {
      merge: true,
    })
  }

  await writer.close()

  const { podium, written: tournamentResultsWritten } = await syncTournamentResultsFromMatches(db)

  console.log('[simulate:scoring:civ] OK', {
    roomId,
    userId,
    championId,
    groupFinished: groupMatches.length,
    koOfficialFinished,
    groupPredictions: userGroupPred.size,
    koPredictions: userKoPred.size,
    tournamentPredictions: tournamentEntries.length,
    championExtra: tournamentEntries.find((t) => t.questionId === EXTRA_IDS.champion)?.payload,
    officialPodium: formatPodiumLog(podium),
    tournamentResultsWritten,
  })
}

main().catch((e) => {
  console.error('[simulate:scoring:civ] ERROR:', e)
  process.exit(1)
})
