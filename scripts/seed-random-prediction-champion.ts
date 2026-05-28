import './seed-load-env.ts'
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { BONUS_QUESTION_IDS, EXTRA_IDS } from '../src/data/questionIds.ts'
import {
  getChampionAndRunnerUpFromPredictions,
  getThirdAndFourthFromPredictions,
} from '../src/domain/bracketResolve.ts'
import type { MatchPredictionPayload, PredictionDoc, TournamentPredictionPayload } from '../src/types/predictions.ts'
import { cascadeKoMatches } from './lib/wc26BracketCascade.ts'
import {
  buildGroupPredictionsForChampion,
  koPayloadWinner,
  randomKnockoutPayload,
} from './lib/predictionChampion.ts'

const args = process.argv.slice(2)
const roomArg = args.find((x) => x.startsWith('--room='))?.slice('--room='.length).trim()
const userArg = args.find((x) => x.startsWith('--user='))?.slice('--user='.length).trim()
const championArg =
  args.find((x) => x.startsWith('--champion='))?.slice('--champion='.length).trim().toUpperCase() || 'CIV'

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

async function resolveUserId(targetRoomId: string): Promise<string> {
  if (userArg) return userArg
  const memberSnap = await db.collection('roomMembers').where('roomId', '==', targetRoomId).limit(1).get()
  if (!memberSnap.empty) {
    const uid = String(memberSnap.docs[0]!.data().userId ?? '').trim()
    if (uid) return uid
  }
  throw new Error(`No userId para room=${targetRoomId}. Usa --user=<uid>.`)
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

function tournamentEntries(
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

async function main(): Promise<void> {
  const userId = await resolveUserId(roomId)
  const teamIds = await loadAllTeamIds()
  if (!teamIds.includes(championId)) {
    throw new Error(`Equipo campeón "${championId}" no está en teams/.`)
  }

  const topScorerPlayer = await loadRandomPlayerKeyByType(false)
  const gkPlayer = (await loadRandomPlayerKeyByType(true)) ?? topScorerPlayer
  if (!topScorerPlayer || !gkPlayer) {
    throw new Error('Sin jugadores en rosters para extras.')
  }

  const userGroupPred = buildGroupPredictionsForChampion(championId)

  const { koScores: userKoPred } = cascadeKoMatches(userGroupPred, (slot) => {
    if (slot.homeId === championId || slot.awayId === championId) {
      return koPayloadWinner(slot.homeId, slot.awayId, championId)
    }
    return randomKnockoutPayload()
  })

  const { championId: verified } = getChampionAndRunnerUpFromPredictions(userGroupPred, userKoPred)
  if (verified !== championId) {
    throw new Error(
      `El cuadro no dejó a ${championId} como campeón (obtuvo ${verified ?? 'null'}). Revisá el bracket.`,
    )
  }

  const tournament = tournamentEntries(teamIds, topScorerPlayer, gkPlayer, userGroupPred, userKoPred)

  const writer = db.bulkWriter()

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

  for (const entry of tournament) {
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

  console.log('[seed:prediction-champion] OK', {
    roomId,
    userId,
    championId,
    groupPredictions: userGroupPred.size,
    koPredictions: userKoPred.size,
    tournamentPredictions: tournament.length,
    championExtra: tournament.find((t) => t.questionId === EXTRA_IDS.champion)?.payload,
  })
}

main().catch((e) => {
  console.error('[seed:prediction-champion] ERROR:', e)
  process.exit(1)
})
