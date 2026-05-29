import { GROUP_STAGE_SCHEDULE } from '../data/wc2026/groupStageSchedule'
import { ALL_QUESTION_METAS } from '../data/bonusQuestionsMeta'
import { BONUS_QUESTION_IDS, EXTRA_IDS } from '../data/questionIds'
import { tournamentCatalogSortKey } from './matchCatalogOrder'
import { formatOfficialMatchScore, formatPredictionMatchScore } from './formatMatchScoreDisplay'
import { formatTournamentPayloadLabel } from './formatTournamentPayloadLabel'
import { getPredictedKoLineupForMatch, parseWc26KoMatchNum } from './koPredictedLineup'
import { matchTeamAId, matchTeamBId } from './matchFields'
import {
  type AdvancementRoundKey,
  extractGroupAndKoPredMaps,
  officialTeamsByAdvancementRound,
  predictedTeamsByAdvancementRound,
  scoreBracketAdvancement,
} from './bracketAdvancement'
import { DEFAULT_RULESET } from '../config/ruleset'
import type {
  MatchDoc,
  MatchPredictionPayload,
  PointsBreakdown,
  PredictionDoc,
  TournamentPredictionPayload,
  TournamentResultDoc,
} from '../types/predictions'
import {
  scoreMatchPredictionDetails,
  scorePlayerPerMatchPick,
  scoreTournamentPrediction,
  totalPointsFromParts,
  type MatchScoreInput,
  type PlayerPerMatchScoreInput,
  type TournamentScoreInput,
} from '../services/scoring'

const groupMatchNumber = new Map(GROUP_STAGE_SCHEDULE.map((r, i) => [r.matchId, i + 1]))

const EXTRA_QUESTION_LABELS: Record<string, string> = {
  [EXTRA_IDS.champion]: 'Campeón del torneo',
  [EXTRA_IDS.runnerUp]: 'Subcampeón',
  [EXTRA_IDS.thirdPlace]: 'Tercer puesto',
  [EXTRA_IDS.fourthPlace]: 'Cuarto puesto',
  [EXTRA_IDS.topScorer]: 'Goleador del torneo',
  [EXTRA_IDS.bestGoalkeeperAverage]: 'Mejor arquero',
}

const BONUS_LABEL_BY_ID = new Map(ALL_QUESTION_METAS.map((m) => [m.id, m.labelEs]))

export type PointsHistoryMatchRow = {
  matchNumber: number
  sortKey: number
  matchupLabel: string
  officialScore: string
  predictionScore: string
  playerLabel: string
  matchPoints: number
  playerBonusPoints: number
  total: number
}

export type PointsHistoryQuestionRow = {
  questionId: string
  questionLabel: string
  officialAnswer: string
  predictionAnswer: string
  points: number
}

export type PointsHistoryBracketRow = {
  teamId: string
  teamLabel: string
  roundLabel: string
  points: number
}

const ADVANCEMENT_ROUND_LABEL: Record<AdvancementRoundKey, string> = {
  toR32: 'Dieciseisavos de final',
  toR16: 'Octavos de final',
  toQf: 'Cuartos de final',
  toSf: 'Semifinales',
  toFinal: 'Final',
}

const ADVANCEMENT_ROUND_ORDER: AdvancementRoundKey[] = ['toR32', 'toR16', 'toQf', 'toSf', 'toFinal']

function buildBracketAdvancementRows(
  predictedByRound: Map<AdvancementRoundKey, Set<string>>,
  officialByRound: Map<AdvancementRoundKey, Set<string>>,
  teamLabel: (id: string) => string,
): PointsHistoryBracketRow[] {
  const rows: PointsHistoryBracketRow[] = []
  for (const key of ADVANCEMENT_ROUND_ORDER) {
    const pts = DEFAULT_RULESET.points.advancement[key]
    const pred = predictedByRound.get(key) ?? new Set()
    const off = officialByRound.get(key) ?? new Set()
    for (const teamId of pred) {
      if (!off.has(teamId)) continue
      rows.push({
        teamId,
        teamLabel: teamLabel(teamId),
        roundLabel: ADVANCEMENT_ROUND_LABEL[key],
        points: pts,
      })
    }
  }
  return rows.sort((a, b) => {
    const ra = ADVANCEMENT_ROUND_ORDER.findIndex((k) => ADVANCEMENT_ROUND_LABEL[k] === a.roundLabel)
    const rb = ADVANCEMENT_ROUND_ORDER.findIndex((k) => ADVANCEMENT_ROUND_LABEL[k] === b.roundLabel)
    if (ra !== rb) return ra - rb
    return a.teamLabel.localeCompare(b.teamLabel, 'es')
  })
}

export type PointsHistoryDisplayBreakdown = {
  matchAndPlayer: number
  bracket: number
  podium: number
  specials: number
}

export type PointsHistory = {
  /** Total oficial de clasificación (misma fuente que la tabla). */
  totalPoints: number
  breakdown: PointsBreakdown
  /** Desglose que suma exactamente a totalPoints. */
  display: PointsHistoryDisplayBreakdown
  matchRows: PointsHistoryMatchRow[]
  bracketRows: PointsHistoryBracketRow[]
  questionRows: PointsHistoryQuestionRow[]
  detailMatchSum: number
  detailBracketSum: number
  detailPodiumSum: number
  detailSpecialsSum: number
  /** true si el detalle por filas no coincide con el total de clasificación. */
  detailOutOfSync: boolean
}

const PODIUM_QUESTION_IDS = new Set<string>([
  EXTRA_IDS.champion,
  EXTRA_IDS.runnerUp,
  EXTRA_IDS.thirdPlace,
  EXTRA_IDS.fourthPlace,
])

const SPECIAL_QUESTION_IDS = new Set<string>([
  EXTRA_IDS.topScorer,
  EXTRA_IDS.bestGoalkeeperAverage,
  ...BONUS_QUESTION_IDS,
])

function buildDisplayBreakdown(
  totalPoints: number,
  breakdown: PointsBreakdown,
): PointsHistoryDisplayBreakdown {
  const match = breakdown.matchPoints ?? 0
  const player = breakdown.playerPickPoints ?? 0
  const tournament = breakdown.tournamentPoints ?? 0
  const specials = breakdown.specialsPoints ?? 0
  const podium = Math.max(0, tournament - specials)
  const bracket = Math.max(0, totalPoints - match - player - tournament)
  return {
    matchAndPlayer: match + player,
    bracket,
    podium,
    specials,
  }
}

function isMatchPayload(p: unknown): p is MatchPredictionPayload {
  return (
    typeof p === 'object' &&
    p !== null &&
    typeof (p as MatchPredictionPayload).goalsTeamA === 'number' &&
    typeof (p as MatchPredictionPayload).goalsTeamB === 'number'
  )
}

function isTournamentPayload(p: unknown): p is TournamentPredictionPayload {
  return typeof p === 'object' && p !== null && 'kind' in p
}

function isPlayerPickPayload(p: unknown): p is { kind: 'player_match_pick'; playerKey: string } {
  return (
    typeof p === 'object' &&
    p !== null &&
    (p as { kind?: string }).kind === 'player_match_pick' &&
    typeof (p as { playerKey?: string }).playerKey === 'string'
  )
}

function catalogMatchNumber(match: MatchDoc & { id: string }): number {
  const ko = parseWc26KoMatchNum(match.id)
  if (ko != null) return ko
  return groupMatchNumber.get(match.id) ?? 0
}

function questionLabel(questionId: string): string {
  return BONUS_LABEL_BY_ID.get(questionId) ?? EXTRA_QUESTION_LABELS[questionId] ?? questionId
}

function isQuestionEnabled(
  questionId: string,
  enabledQuestionIds: ReadonlySet<string> | null,
): boolean {
  if (!enabledQuestionIds) return true
  return enabledQuestionIds.has(questionId)
}

export function buildPointsHistory(args: {
  predictions: PredictionDoc[]
  matches: (MatchDoc & { id: string })[]
  tournamentResultsByQuestionId: Map<string, TournamentResultDoc>
  teamLabel: (id: string) => string
  enabledQuestionIds?: ReadonlySet<string> | null
  /** Total y desglose desde standings/{room}/users (fuente de verdad del ranking). */
  standingPoints?: number
  standingBreakdown?: PointsBreakdown
  /** Si false, no hay filas de detalle (predicción no finalizada / fuera del ranking). */
  countsForStandings?: boolean
}): PointsHistory {
  const { predictions, matches, tournamentResultsByQuestionId, teamLabel, enabledQuestionIds } = args
  const countsForStandings = args.countsForStandings !== false
  const emptyBreakdown: PointsBreakdown = {
    matchPoints: 0,
    tournamentPoints: 0,
    advancementPoints: 0,
    specialsPoints: 0,
    playerPickPoints: 0,
  }

  if (!countsForStandings) {
    const totalPoints = args.standingPoints ?? 0
    return {
      totalPoints,
      breakdown: args.standingBreakdown ?? emptyBreakdown,
      display: buildDisplayBreakdown(totalPoints, args.standingBreakdown ?? emptyBreakdown),
      matchRows: [],
      bracketRows: [],
      questionRows: [],
      detailMatchSum: 0,
      detailBracketSum: 0,
      detailPodiumSum: 0,
      detailSpecialsSum: 0,
      detailOutOfSync: false,
    }
  }
  const matchesById = new Map(matches.map((m) => [m.id, m]))

  const matchParts: MatchScoreInput[] = []
  const tournamentParts: TournamentScoreInput[] = []
  const playerPickParts: PlayerPerMatchScoreInput[] = []
  const playerKeyByMatchId = new Map<string, string>()

  for (const pr of predictions) {
    if (pr.scope === 'match' && pr.matchId && isMatchPayload(pr.payload)) {
      const m = matchesById.get(pr.matchId)
      if (!m) continue
      matchParts.push({ matchId: pr.matchId, match: m, prediction: pr.payload })
    } else if (pr.scope === 'tournament' && pr.questionId && isTournamentPayload(pr.payload)) {
      if (!isQuestionEnabled(pr.questionId, enabledQuestionIds ?? null)) continue
      const res = tournamentResultsByQuestionId.get(pr.questionId)
      tournamentParts.push({
        questionId: pr.questionId,
        officialAnswer: res?.resolved ? res.answer : null,
        prediction: pr.payload,
      })
    } else if (pr.scope === 'player_per_match' && pr.matchId && isPlayerPickPayload(pr.payload)) {
      const m = matchesById.get(pr.matchId)
      if (!m) continue
      playerKeyByMatchId.set(pr.matchId, pr.payload.playerKey)
      playerPickParts.push({
        matchId: pr.matchId,
        match: m,
        playerKey: pr.payload.playerKey,
      })
    }
  }

  const matchPartsWithLineup = matchParts.map((mp) => {
    if (mp.match.phase !== 'knockout') return mp
    const lineup = getPredictedKoLineupForMatch(predictions, mp.matchId)
    return { ...mp, predictedLineup: lineup }
  })

  const { groupPredByMatchId, koPredByMatchId } = extractGroupAndKoPredMaps(predictions)
  const predictedByRound = predictedTeamsByAdvancementRound(groupPredByMatchId, koPredByMatchId)
  const officialByRound = officialTeamsByAdvancementRound(matchesById)
  const bracketAdvancementPoints = scoreBracketAdvancement(predictedByRound, officialByRound)

  const computed = totalPointsFromParts(
    matchPartsWithLineup,
    tournamentParts,
    playerPickParts,
    bracketAdvancementPoints,
  )

  const breakdown: PointsBreakdown =
    args.standingBreakdown != null
      ? args.standingBreakdown
      : {
          matchPoints: computed.matchPoints,
          tournamentPoints: computed.tournamentPoints,
          advancementPoints: computed.advancementPoints,
          specialsPoints: computed.specialsPoints,
          playerPickPoints: computed.playerPickPoints,
        }

  const totalPoints = args.standingPoints ?? computed.total
  const display = buildDisplayBreakdown(totalPoints, breakdown)

  const matchRows: PointsHistoryMatchRow[] = []

  for (const mp of matchPartsWithLineup) {
    if (mp.match.status !== 'finished' || !mp.prediction) continue
    const fullMatch = matchesById.get(mp.matchId)
    if (!fullMatch) continue

    const details = scoreMatchPredictionDetails(mp.match, mp.prediction, mp.predictedLineup)
    const matchPoints = details.points
    const playerKey = playerKeyByMatchId.get(mp.matchId)
    const playerBonusPoints = scorePlayerPerMatchPick(mp.match, playerKey)
    const total = matchPoints + playerBonusPoints
    if (total <= 0) continue

    const teamA = matchTeamAId(fullMatch)
    const teamB = matchTeamBId(fullMatch)
    const matchupLabel =
      teamA && teamB ? `${teamLabel(teamA)} vs ${teamLabel(teamB)}` : mp.matchId

    matchRows.push({
      matchNumber: catalogMatchNumber(fullMatch),
      sortKey: tournamentCatalogSortKey(fullMatch),
      matchupLabel,
      officialScore: formatOfficialMatchScore(fullMatch),
      predictionScore: formatPredictionMatchScore(mp.prediction),
      playerLabel: playerKey?.trim() || '—',
      matchPoints,
      playerBonusPoints,
      total,
    })
  }

  matchRows.sort((a, b) => a.sortKey - b.sortKey)

  const questionRows: PointsHistoryQuestionRow[] = []
  const questionOrder = [...Object.values(EXTRA_IDS), ...BONUS_QUESTION_IDS]
  let detailPodiumSum = 0
  let detailSpecialsSum = 0

  for (const questionId of questionOrder) {
    if (!isQuestionEnabled(questionId, enabledQuestionIds ?? null)) continue
    const part = tournamentParts.find((t) => t.questionId === questionId)
    if (!part) continue
    const points = scoreTournamentPrediction(questionId, part.officialAnswer, part.prediction)
    if (points <= 0) continue
    if (PODIUM_QUESTION_IDS.has(questionId)) detailPodiumSum += points
    else if (SPECIAL_QUESTION_IDS.has(questionId)) detailSpecialsSum += points
    questionRows.push({
      questionId,
      questionLabel: questionLabel(questionId),
      officialAnswer: formatTournamentPayloadLabel(part.officialAnswer, teamLabel),
      predictionAnswer: formatTournamentPayloadLabel(part.prediction, teamLabel),
      points,
    })
  }

  const bracketRows = buildBracketAdvancementRows(predictedByRound, officialByRound, teamLabel)
  const detailMatchSum = matchRows.reduce((s, r) => s + r.total, 0)
  const detailBracketSum = bracketRows.reduce((s, r) => s + r.points, 0)

  const detailFromRows = detailMatchSum + detailPodiumSum + detailSpecialsSum + detailBracketSum
  const detailOutOfSync = Math.abs(detailFromRows - totalPoints) > 0

  return {
    totalPoints,
    breakdown,
    display,
    matchRows,
    bracketRows,
    questionRows,
    detailMatchSum,
    detailBracketSum,
    detailPodiumSum,
    detailSpecialsSum,
    detailOutOfSync,
  }
}
