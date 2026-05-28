import './seed-load-env.ts'
import { applicationDefault, getApp, getApps, initializeApp } from 'firebase-admin/app'
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
import { cascadeKoMatches } from './lib/wc26BracketCascade.ts'
import { formatPodiumLog, syncTournamentResultsFromMatches } from './lib/syncTournamentResultsFromMatches.ts'

const args = process.argv.slice(2)
const roomArg = args.find((x) => x.startsWith('--room='))?.slice('--room='.length).trim()
const userArg = args.find((x) => x.startsWith('--user='))?.slice('--user='.length).trim()
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

function randBool(): boolean {
  return Math.random() < 0.5
}

function pickRandom<T>(list: readonly T[]): T {
  return list[randInt(0, list.length - 1)]!
}

function randomGroupPayload(): MatchPredictionPayload {
  const goalsA = randInt(0, 4)
  const goalsB = randInt(0, 4)
  return {
    goalsHome: goalsA,
    goalsAway: goalsB,
    goalsTeamA: goalsA,
    goalsTeamB: goalsB,
  }
}

function randomKnockoutPayload(): MatchPredictionPayload {
  const goalsA = randInt(0, 4)
  const goalsB = randInt(0, 4)
  const draw = goalsA === goalsB
  return {
    goalsHome: goalsA,
    goalsAway: goalsB,
    goalsTeamA: goalsA,
    goalsTeamB: goalsB,
    wentToPenalties: draw,
    ...(draw
      ? {
          penaltiesWinnerHome: randBool(),
          penaltiesWinnerTeamA: randBool(),
        }
      : {}),
  }
}

function finishedMatchUpdate(payload: MatchPredictionPayload): Record<string, unknown> {
  return {
    status: 'finished',
    goalsHome: payload.goalsHome,
    goalsAway: payload.goalsAway,
    goalsTeamA: payload.goalsHome,
    goalsTeamB: payload.goalsAway,
    wentToPenalties: payload.wentToPenalties ?? null,
    penaltiesWinnerHome: payload.penaltiesWinnerHome ?? null,
    penaltiesWinnerTeamA: payload.penaltiesWinnerTeamA ?? null,
    finishedAt: FieldValue.serverTimestamp(),
  }
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
  const { championId, runnerUpId } = getChampionAndRunnerUpFromPredictions(groupPred, koPred)
  const { thirdId, fourthId } = getThirdAndFourthFromPredictions(groupPred, koPred)

  const champion = championId ?? pickRandom(teamIds)
  let runnerUp = runnerUpId ?? pickRandom(teamIds)
  while (runnerUp === champion && teamIds.length > 1) runnerUp = pickRandom(teamIds)

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
  await ensureRoomMember(roomId, userId)

  const matchSnap = await db.collection('matches').get()
  const matches = matchSnap.docs.map((d) => ({ id: d.id, ...(d.data() as MatchDoc) }))
  const groupMatches = matches.filter((m) => m.phase === 'group')

  const teamIds = await loadAllTeamIds()
  if (teamIds.length === 0) throw new Error('No hay teams en Firestore')

  const topScorerPlayer = await loadRandomPlayerKeyByType(false)
  const gkPlayer = (await loadRandomPlayerKeyByType(true)) ?? topScorerPlayer
  if (!topScorerPlayer || !gkPlayer) {
    throw new Error('No hay jugadores en teams/*/players para armar predicciones especiales.')
  }

  const userGroupPred = new Map<string, MatchPredictionPayload>()
  for (const m of groupMatches) {
    userGroupPred.set(m.id, randomGroupPayload())
  }

  const { koScores: userKoPred, resolvedCount: koPredCount } = cascadeKoMatches(userGroupPred, () =>
    randomKnockoutPayload(),
  )

  const tournamentEntries = tournamentPayloadsFromBracket(
    teamIds,
    topScorerPlayer,
    gkPlayer,
    userGroupPred,
    userKoPred,
  )

  if (dryRun) {
    const officialGroupPreview = new Map<string, MatchPredictionPayload>()
    for (const m of groupMatches) {
      officialGroupPreview.set(m.id, randomGroupPayload())
    }
    const { resolvedCount: koOfficialPreview } = cascadeKoMatches(officialGroupPreview, () =>
      randomKnockoutPayload(),
    )

    console.log('[simulate:scoring] DRY RUN', {
      roomId,
      userId,
      groupMatches: groupMatches.length,
      koSlotsTotal: WC26_KO_MATCHES.length,
      userKoPredictions: koPredCount,
      officialKoAfterAllGroups: koOfficialPreview,
      tournamentPredictions: tournamentEntries.length,
      note: 'Resultados oficiales KO y predicciones usan bracketResolve (misma cascada que la UI).',
    })
    return
  }

  const writer = db.bulkWriter()

  // 1) Resultados oficiales de grupos.
  const officialGroupScores = new Map<string, MatchPredictionPayload>()
  for (const m of groupMatches) {
    const payload = randomGroupPayload()
    officialGroupScores.set(m.id, payload)
    writer.set(
      db.collection('matches').doc(m.id),
      finishedMatchUpdate(payload),
      { merge: true },
    )
  }

  // 2) Cascada oficial KO: equipos + marcador según clasificación real y ganadores previos.
  const { resolvedCount: koOfficialFinished } = cascadeKoMatches(officialGroupScores, (slot) => {
    const payload = randomKnockoutPayload()
    writer.set(
      db.collection('matches').doc(slot.matchId),
      {
        teamHomeId: slot.homeId,
        teamAwayId: slot.awayId,
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

  // 3) Predicciones de grupos.
  for (const [matchId, payload] of userGroupPred) {
    const id = predictionDocId(roomId, userId, `m_${matchId}`)
    const data: PredictionDoc = {
      userId,
      roomId,
      scope: 'match',
      matchId,
      payload,
      updatedAt: FieldValue.serverTimestamp(),
    }
    writer.set(db.collection('predictions').doc(id), data, { merge: true })
  }

  // 4) Predicciones KO solo donde el cuadro del usuario ya define ambos equipos.
  for (const [matchId, payload] of userKoPred) {
    const id = predictionDocId(roomId, userId, `m_${matchId}`)
    const data: PredictionDoc = {
      userId,
      roomId,
      scope: 'match',
      matchId,
      payload,
      updatedAt: FieldValue.serverTimestamp(),
    }
    writer.set(db.collection('predictions').doc(id), data, { merge: true })
  }

  // 5) Extras de torneo derivados del cuadro predicho (campeón, podio, etc.).
  for (const entry of tournamentEntries) {
    const id = predictionDocId(roomId, userId, `t_${entry.questionId}`)
    const data: PredictionDoc = {
      userId,
      roomId,
      scope: 'tournament',
      questionId: entry.questionId,
      payload: entry.payload,
      updatedAt: FieldValue.serverTimestamp(),
    }
    writer.set(db.collection('predictions').doc(id), data, { merge: true })
  }

  await writer.close()

  const { podium, written: tournamentResultsWritten } = await syncTournamentResultsFromMatches(db)

  console.log('[simulate:scoring] OK', {
    roomId,
    userId,
    groupFinished: groupMatches.length,
    koOfficialFinished,
    groupPredictions: userGroupPred.size,
    koPredictions: userKoPred.size,
    tournamentPredictions: tournamentEntries.length,
    officialPodium: formatPodiumLog(podium),
    tournamentResultsWritten,
  })
  console.log(
    '[simulate:scoring] Los cruces KO se rellenan en cascada (grupos → R32 → … → final), igual que en predicciones.',
  )
  console.log(
    '[simulate:scoring] Recálculo de standings: Cloud Functions onMatchWrite / onPredictionWrite.',
  )
}

main().catch((e) => {
  console.error('[simulate:scoring] ERROR:', e)
  process.exit(1)
})
