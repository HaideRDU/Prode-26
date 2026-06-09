import { ALL_QUESTION_METAS } from '../data/bonusQuestionsMeta'
import { BONUS_QUESTION_IDS, EXTRA_IDS } from '../data/questionIds'
import { sortByTournamentCatalog } from '../domain/matchCatalogOrder'
import { formatPredictionMatchScore } from '../domain/formatMatchScoreDisplay'
import { formatTournamentPayloadLabel } from '../domain/formatTournamentPayloadLabel'
import { matchTeamAId, matchTeamBId } from '../domain/matchFields'
import { parseWc26KoMatchNum } from '../domain/koPredictedLineup'
import { GROUP_STAGE_SCHEDULE } from '../data/wc2026/groupStageSchedule'
import { DEFAULT_RULESET, getGeneralPredictionsLockAt } from '../config/ruleset'
import { fetchTeamPlayers, playerDocToKey } from '../services/teamsService'
import type {
  MatchDoc,
  MatchPredictionPayload,
  PredictionDoc,
  PrivateRoomPodiumPrizes,
  RoomDoc,
  TournamentPredictionPayload,
} from '../types/predictions'
import type { StandingRow } from '../services/standingsService'

const groupMatchNumber = new Map(GROUP_STAGE_SCHEDULE.map((r, i) => [r.matchId, i + 1]))

export type RoomClosureParticipant = {
  userId: string
  displayName: string
  rank: number
  points: number
  extras: { label: string; value: string }[]
  bonusQuestions: { label: string; value: string }[]
  matchRows: { matchNum: number; matchup: string; prediction: string; playerBonus: string }[]
}

export type RoomClosureReport = {
  roomId: string
  roomName: string
  roomDescription?: string
  lockLabel: string
  lockIso: string
  generatedAtLabel: string
  participantsRegistered: number
  standingsCount: number
  podiumPrizes: PrivateRoomPodiumPrizes | null
  participants: RoomClosureParticipant[]
  contentHash: string
}

function isMatchPayload(p: unknown): p is MatchPredictionPayload {
  return (
    typeof p === 'object' &&
    p !== null &&
    typeof (p as MatchPredictionPayload).goalsTeamA === 'number' &&
    typeof (p as MatchPredictionPayload).goalsTeamB === 'number'
  )
}

function isPlayerPick(p: unknown): p is { kind: 'player_match_pick'; playerKey: string } {
  return (
    typeof p === 'object' &&
    p !== null &&
    (p as { kind?: string }).kind === 'player_match_pick' &&
    typeof (p as { playerKey?: string }).playerKey === 'string'
  )
}

function isTournamentPayload(p: unknown): p is TournamentPredictionPayload {
  return typeof p === 'object' && p !== null && 'kind' in p
}

function catalogMatchNumber(match: MatchDoc & { id: string }): number {
  const ko = parseWc26KoMatchNum(match.id)
  if (ko != null) return ko
  return groupMatchNumber.get(match.id) ?? 0
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function buildPlayerNameMap(
  predictions: PredictionDoc[],
  matches: (MatchDoc & { id: string })[],
): Promise<Map<string, string>> {
  const matchById = new Map(matches.map((m) => [m.id, m]))
  const teamIds = new Set<string>()
  for (const pr of predictions) {
    if (pr.scope !== 'player_per_match' || !pr.matchId || !isPlayerPick(pr.payload)) continue
    const m = matchById.get(pr.matchId)
    if (!m) continue
    const a = matchTeamAId(m)
    const b = matchTeamBId(m)
    if (a) teamIds.add(a)
    if (b) teamIds.add(b)
  }
  const map = new Map<string, string>()
  await Promise.all(
    [...teamIds].map(async (teamId) => {
      const players = await fetchTeamPlayers(teamId)
      for (const p of players) {
        const key = playerDocToKey(p)
        if (!map.has(key)) map.set(key, p.name)
      }
    }),
  )
  return map
}

function groupPredictionsByUser(predictions: PredictionDoc[]): Map<string, PredictionDoc[]> {
  const byUser = new Map<string, PredictionDoc[]>()
  for (const pr of predictions) {
    const list = byUser.get(pr.userId) ?? []
    list.push(pr)
    byUser.set(pr.userId, list)
  }
  return byUser
}

export async function buildRoomClosureReport(args: {
  room: RoomDoc
  roomId: string
  standings: StandingRow[]
  matches: (MatchDoc & { id: string })[]
  predictions: PredictionDoc[]
  participantsRegistered: number
  teamLabel: (id: string | null | undefined) => string
  enabledQuestionIds: Set<string> | null
}): Promise<RoomClosureReport> {
  const {
    room,
    roomId,
    standings,
    matches,
    predictions,
    participantsRegistered,
    teamLabel,
    enabledQuestionIds,
  } = args

  const lockAt = getGeneralPredictionsLockAt(DEFAULT_RULESET)
  const tz = DEFAULT_RULESET.timezone
  const dtOpts: Intl.DateTimeFormatOptions = {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: tz,
  }
  const lockLabel = lockAt.toLocaleString('es-CO', dtOpts)
  const generatedAtLabel = new Date().toLocaleString('es-CO', dtOpts)

  const playerNames = await buildPlayerNameMap(predictions, matches)
  const byUser = groupPredictionsByUser(predictions)
  const sortedMatches = sortByTournamentCatalog(matches)

  const bonusMetaById = new Map(ALL_QUESTION_METAS.map((m) => [m.id, m]))
  const extraLabels: Record<string, string> = {
    [EXTRA_IDS.champion]: 'Campeón',
    [EXTRA_IDS.runnerUp]: 'Subcampeón',
    [EXTRA_IDS.thirdPlace]: 'Tercer puesto',
    [EXTRA_IDS.fourthPlace]: 'Cuarto puesto',
    [EXTRA_IDS.topScorer]: 'Goleador del torneo',
    [EXTRA_IDS.bestGoalkeeperAverage]: 'Mejor arquero',
  }

  const participants: RoomClosureParticipant[] = standings.map((row) => {
    const userPreds = byUser.get(row.userId) ?? []
    const predByQuestion = new Map<string, TournamentPredictionPayload>()
    const matchPredById = new Map<string, MatchPredictionPayload>()
    const playerPickByMatch = new Map<string, string>()

    for (const pr of userPreds) {
      if (pr.scope === 'match' && pr.matchId && isMatchPayload(pr.payload)) {
        matchPredById.set(pr.matchId, pr.payload)
      } else if (pr.scope === 'tournament' && pr.questionId && isTournamentPayload(pr.payload)) {
        predByQuestion.set(pr.questionId, pr.payload)
      } else if (pr.scope === 'player_per_match' && pr.matchId && isPlayerPick(pr.payload)) {
        playerPickByMatch.set(pr.matchId, pr.payload.playerKey)
      }
    }

    const extras = Object.entries(extraLabels).map(([id, label]) => ({
      label,
      value: formatTournamentPayloadLabel(predByQuestion.get(id), teamLabel),
    }))

    const bonusQuestions: { label: string; value: string }[] = []
    for (const qid of BONUS_QUESTION_IDS) {
      if (enabledQuestionIds && !enabledQuestionIds.has(qid)) continue
      const meta = bonusMetaById.get(qid)
      bonusQuestions.push({
        label: meta?.labelEs ?? qid,
        value: formatTournamentPayloadLabel(predByQuestion.get(qid), teamLabel),
      })
    }

    const matchRows = sortedMatches.map((m) => {
      const teamA = matchTeamAId(m)
      const teamB = matchTeamBId(m)
      const matchup =
        teamA && teamB ? `${teamLabel(teamA)} vs ${teamLabel(teamB)}` : m.id
      const pred = matchPredById.get(m.id)
      const playerKey = playerPickByMatch.get(m.id)
      return {
        matchNum: catalogMatchNumber(m),
        matchup,
        prediction: pred ? formatPredictionMatchScore(pred) : '—',
        playerBonus: playerKey ? playerNames.get(playerKey) ?? playerKey : '—',
      }
    })

    return {
      userId: row.userId,
      displayName: row.displayName?.trim() || row.userId,
      rank: row.rank,
      points: row.points,
      extras,
      bonusQuestions,
      matchRows,
    }
  })

  const hashPayload = {
    roomId,
    lockIso: lockAt.toISOString(),
    participantsRegistered,
    predictions: predictions
      .map((p) => ({
        id: p.id,
        userId: p.userId,
        scope: p.scope,
        matchId: p.matchId,
        questionId: p.questionId,
        payload: p.payload,
      }))
      .sort((a, b) => (a.id ?? '').localeCompare(b.id ?? '')),
  }
  const contentHash = await sha256Hex(JSON.stringify(hashPayload))

  return {
    roomId,
    roomName: room.name,
    roomDescription: room.description,
    lockLabel,
    lockIso: lockAt.toISOString(),
    generatedAtLabel,
    participantsRegistered,
    standingsCount: standings.length,
    podiumPrizes: room.podiumPrizes ?? null,
    participants,
    contentHash,
  }
}
