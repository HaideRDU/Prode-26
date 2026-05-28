/**
 * Llena resultados oficiales (matches) + predicciones en cascada.
 * Final 0–0; campeón gana en penales (por defecto JPN / sub KOR).
 *
 * Uso:
 *   npm run simulate:scoring:jpn-kor
 *   npm run simulate:scoring:kor-jpn
 *   tsx scripts/simulate-random-scoring-data-jpn-kor.ts --champion=KOR --runner-up=JPN
 */
import './seed-load-env.ts'
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { BONUS_QUESTION_IDS, EXTRA_IDS } from '../src/data/questionIds.ts'
import {
  getChampionAndRunnerUpFromPredictions,
  getThirdAndFourthFromPredictions,
} from '../src/domain/bracketResolve.ts'
import { WC26_KO_MATCHES, koMatchDocId } from '../src/data/wc2026/knockoutBracket.ts'
import type {
  MatchDoc,
  MatchPredictionPayload,
  PredictionDoc,
  TournamentPredictionPayload,
} from '../src/types/predictions.ts'
import { cascadeKoMatches } from './lib/wc26BracketCascade.ts'
import { formatPodiumLog, syncTournamentResultsFromMatches } from './lib/syncTournamentResultsFromMatches.ts'
import { finishedMatchUpdate, koMatchTeamsUpdate } from './lib/matchFinishedUpdate.ts'
import {
  buildGroupPredictionsForFavorites,
  koPayloadForPodiumSlot,
  randomGroupPayload,
} from './lib/predictionChampion.ts'

const args = process.argv.slice(2)
const roomArg = args.find((x) => x.startsWith('--room='))?.slice('--room='.length).trim()
const userArg = args.find((x) => x.startsWith('--user='))?.slice('--user='.length).trim()
const championId =
  args.find((x) => x.startsWith('--champion='))?.slice('--champion='.length).trim().toUpperCase() || 'JPN'
const runnerUpId =
  args.find((x) => x.startsWith('--runner-up='))?.slice('--runner-up='.length).trim().toUpperCase() || 'KOR'
const dryRun = args.includes('--dry-run')

const roomId = roomArg || 'global'

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

function koPayload(slot: { matchNum: number; homeId: string; awayId: string }): MatchPredictionPayload {
  return koPayloadForPodiumSlot({
    matchNum: slot.matchNum,
    homeId: slot.homeId,
    awayId: slot.awayId,
    championId,
    runnerUpId,
  })
}

async function resolveUserId(targetRoomId: string): Promise<string> {
  if (userArg) return userArg
  const memberSnap = await db.collection('roomMembers').where('roomId', '==', targetRoomId).limit(1).get()
  if (!memberSnap.empty) {
    const uid = String(memberSnap.docs[0]!.data().userId ?? '').trim()
    if (uid) return uid
  }
  throw new Error(`No userId para room=${targetRoomId}. Usa --user=<uid>.`)
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

function tournamentPayloads(
  teamIds: string[],
  topScorerPlayerId: string,
  gkPlayerId: string,
  groupPred: Map<string, MatchPredictionPayload>,
  koPred: Map<string, MatchPredictionPayload>,
): Array<{ questionId: string; payload: TournamentPredictionPayload }> {
  const { thirdId, fourthId } = getThirdAndFourthFromPredictions(groupPred, koPred)

  let third = thirdId ?? pickRandom(teamIds)
  while ((third === championId || third === runnerUpId) && teamIds.length > 2) third = pickRandom(teamIds)

  let fourth = fourthId ?? pickRandom(teamIds)
  while ((fourth === championId || fourth === runnerUpId || fourth === third) && teamIds.length > 3) {
    fourth = pickRandom(teamIds)
  }

  return [
    { questionId: EXTRA_IDS.champion, payload: { kind: 'team', teamId: championId } },
    { questionId: EXTRA_IDS.runnerUp, payload: { kind: 'team', teamId: runnerUpId } },
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

async function main(): Promise<void> {
  const userId = await resolveUserId(roomId)
  await ensureRoomMember(roomId, userId)

  const matchSnap = await db.collection('matches').get()
  const matches = matchSnap.docs.map((d) => ({ id: d.id, ...(d.data() as MatchDoc) }))
  const groupMatches = matches.filter((m) => m.phase === 'group')

  const teamIds = await loadAllTeamIds()
  if (!teamIds.includes(championId) || !teamIds.includes(runnerUpId)) {
    throw new Error(`Equipos ${championId} y ${runnerUpId} deben existir en teams/`)
  }
  if (championId === runnerUpId) throw new Error('Campeón y subcampeón deben ser distintos.')

  const topScorerPlayer = await loadRandomPlayerKeyByType(false)
  const gkPlayer = (await loadRandomPlayerKeyByType(true)) ?? topScorerPlayer
  if (!topScorerPlayer || !gkPlayer) throw new Error('Sin jugadores en rosters.')

  const favoriteGroupScores = buildGroupPredictionsForFavorites([championId, runnerUpId])

  const officialGroupScores = new Map<string, MatchPredictionPayload>()
  for (const m of groupMatches) {
    officialGroupScores.set(m.id, favoriteGroupScores.get(m.id) ?? randomGroupPayload())
  }

  const userGroupPred = new Map(officialGroupScores)

  const { koScores: officialKoPreview, resolvedCount: koOfficialPreview } = cascadeKoMatches(
    officialGroupScores,
    koPayload,
  )

  const { championId: offChamp, runnerUpId: offRu } = getChampionAndRunnerUpFromPredictions(
    officialGroupScores,
    officialKoPreview,
  )
  if (offChamp !== championId || offRu !== runnerUpId) {
    throw new Error(
      `El cuadro oficial no cerró ${championId}–${runnerUpId} (obtuvo ${offChamp ?? '?'} / ${offRu ?? '?'}). Revisá grupos aleatorios.`,
    )
  }

  const { koScores: userKoPred } = cascadeKoMatches(userGroupPred, koPayload)

  const tournamentEntries = tournamentPayloads(
    teamIds,
    topScorerPlayer,
    gkPlayer,
    userGroupPred,
    userKoPred,
  )

  const finalPred = userKoPred.get(koMatchDocId(104))

  if (dryRun) {
    console.log('[simulate:scoring:jpn-kor] DRY RUN', {
      roomId,
      userId,
      officialKoFinished: koOfficialPreview,
      finalPrediction: finalPred,
    })
    return
  }

  const writer = db.bulkWriter()

  for (const m of groupMatches) {
    const payload = officialGroupScores.get(m.id)!
    writer.set(db.collection('matches').doc(m.id), finishedMatchUpdate(payload), { merge: true })
  }

  const { resolvedCount: koOfficialFinished } = cascadeKoMatches(officialGroupScores, (slot) => {
    const payload = koPayload(slot)
    writer.set(
      db.collection('matches').doc(slot.matchId),
      {
        ...koMatchTeamsUpdate(slot.homeId, slot.awayId),
        phase: 'knockout',
        round: slot.round,
        ...finishedMatchUpdate(payload),
      },
      { merge: true },
    )
    return payload
  })

  for (const [matchId, payload] of userGroupPred) {
    writer.set(
      db.collection('predictions').doc(predictionDocId(roomId, userId, `m_${matchId}`)),
      {
        userId,
        roomId,
        scope: 'match',
        matchId,
        payload,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
  }

  for (const [matchId, payload] of userKoPred) {
    writer.set(
      db.collection('predictions').doc(predictionDocId(roomId, userId, `m_${matchId}`)),
      {
        userId,
        roomId,
        scope: 'match',
        matchId,
        payload,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
  }

  for (const entry of tournamentEntries) {
    writer.set(
      db.collection('predictions').doc(predictionDocId(roomId, userId, `t_${entry.questionId}`)),
      {
        userId,
        roomId,
        scope: 'tournament',
        questionId: entry.questionId,
        payload: entry.payload,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
  }

  await writer.close()

  const { podium, written: tournamentResultsWritten } = await syncTournamentResultsFromMatches(db)

  console.log('[simulate:scoring:podium] OK', {
    roomId,
    userId,
    championId,
    runnerUpId,
    groupFinished: groupMatches.length,
    koOfficialFinished,
    groupPredictions: userGroupPred.size,
    koPredictions: userKoPred.size,
    tournamentPredictions: tournamentEntries.length,
    finalPrediction: finalPred,
    officialPodium: formatPodiumLog(podium),
    tournamentResultsWritten,
  })
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e)
  console.error('[simulate:scoring:jpn-kor] ERROR:', e)
  if (msg.includes('default credentials') || msg.includes('Could not load')) {
    console.error(`
[simulate:scoring:jpn-kor] Sin credenciales de Firebase Admin. En tu máquina:
  1) Coloca en .env: GOOGLE_APPLICATION_CREDENTIALS=/ruta/al-service-account.json
  2) O ejecuta: gcloud auth application-default login
  3) Verifica: npm run verify:firebase-project
`)
  }
  process.exit(1)
})
