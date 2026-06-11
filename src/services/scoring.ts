/**
 * Motor de puntuación alineado al reglamento oficial WC2026 (puntos additive por acierto).
 */
import type {
  MatchDoc,
  MatchPredictionPayload,
  TournamentPredictionPayload,
} from '../types/predictions'
import { BONUS_QUESTION_IDS, EXTRA_IDS } from '../data/questionIds'
import {
  matchGoalsTeamA,
  matchGoalsTeamB,
  matchTeamAId,
  matchTeamBId,
  predictionGoalsTeamA,
  predictionGoalsTeamB,
} from '../domain/matchFields'
import { penaltiesWinnerIsTeamAFromPayload } from '../domain/matchPenalties'
import {
  DEFAULT_RULESET,
  maxMatchPoints,
  type KnockoutRoundId,
  type MatchPointsRow,
} from '../config/ruleset'
import { type PlayerRef, scorerMatchesPick } from '../utils/playerKeyMatch'

const GROUP_ROW = DEFAULT_RULESET.points.matchByPhase.group

export const GROUP_EXACT_SCORE_POINTS = maxMatchPoints(GROUP_ROW)
export const GROUP_ONE_SCORE_POINTS = GROUP_ROW.goalsTeamA
export const GROUP_WINNER_POINTS = GROUP_ROW.winnerOrDraw
export const KO_WINNER_POINTS = DEFAULT_RULESET.points.matchByPhase.knockout.r32.winnerOrDraw
export const KO_ONE_SCORE_POINTS = DEFAULT_RULESET.points.matchByPhase.knockout.r32.goalsTeamA
export const KO_PENALTY_BONUS_POINTS = 0
export const POINTS_CHAMPION = DEFAULT_RULESET.points.advancement.champion
export const POINTS_RUNNER_UP = DEFAULT_RULESET.points.advancement.runnerUp
export const POINTS_THIRD_PLACE = DEFAULT_RULESET.points.advancement.thirdPlace
export const POINTS_FOURTH_PLACE = 0
export const POINTS_TOP_SCORER = DEFAULT_RULESET.points.specials.topScorer
export const POINTS_BONUS_QUESTION = DEFAULT_RULESET.points.specials.bonusQuestion
export const POINTS_BEST_GOALKEEPER_AVERAGE = DEFAULT_RULESET.points.specials.bestGoalkeeperAverage

export const KO_EXACT_SCORE_BY_ROUND = Object.fromEntries(
  (Object.keys(DEFAULT_RULESET.points.matchByPhase.knockout) as KnockoutRoundId[]).map((rid) => [
    rid,
    maxMatchPoints(DEFAULT_RULESET.points.matchByPhase.knockout[rid]),
  ]),
) as Record<KnockoutRoundId, number>

export const ADVANCEMENT_POINTS = DEFAULT_RULESET.points.advancement
export const MATCH_POINTS_BY_PHASE = DEFAULT_RULESET.points.matchByPhase
export const PLAYER_GOALS_PER_GOAL_BY_ROUND = DEFAULT_RULESET.points.playerPerMatch.goalsPerGoalByRound

export const SPECIAL_IDS = {
  topScorer: EXTRA_IDS.topScorer,
  bestGoalkeeperAverage: EXTRA_IDS.bestGoalkeeperAverage,
} as const

type MatchForScore = Pick<
  MatchDoc,
  | 'phase'
  | 'status'
  | 'wentToPenalties'
  | 'round'
  | 'teamAId'
  | 'teamBId'
  | 'goalsTeamA'
  | 'goalsTeamB'
  | 'penaltiesWinnerTeamA'
  | 'penaltiesWinnerTeamB'
  | 'goalsHome'
  | 'goalsAway'
  | 'teamHomeId'
  | 'teamAwayId'
  | 'penaltiesWinnerHome'
  | 'penaltiesWinnerAway'
>

export interface PredictedKoLineup {
  predictedTeamAId: string | null
  predictedTeamBId: string | null
}

function koPairMatchesOfficial(
  predTeamAId: string,
  predTeamBId: string,
  actualTeamAId: string,
  actualTeamBId: string,
): boolean {
  return (
    (predTeamAId === actualTeamAId && predTeamBId === actualTeamBId) ||
    (predTeamAId === actualTeamBId && predTeamBId === actualTeamAId)
  )
}

function matchResultSign(goalsA: number, goalsB: number): -1 | 0 | 1 {
  if (goalsA > goalsB) return 1
  if (goalsA < goalsB) return -1
  return 0
}

function winnerTeamId(
  goalsA: number,
  goalsB: number,
  teamA: string,
  teamB: string,
): string | 'draw' {
  const r = matchResultSign(goalsA, goalsB)
  if (r === 0) return 'draw'
  return r === 1 ? teamA : teamB
}

/** Ganador predicho en KO (incluye penales si hubo empate en el marcador). */
function koPredictedWinnerTeamId(
  prediction: MatchPredictionPayload,
  predSlotAId: string,
  predSlotBId: string,
): string | 'draw' {
  const gh = predictionGoalsTeamA(prediction)
  const ga = predictionGoalsTeamB(prediction)
  if (gh > ga) return predSlotAId
  if (gh < ga) return predSlotBId
  const winnerIsTeamA = penaltiesWinnerIsTeamAFromPayload(prediction)
  if (winnerIsTeamA === true) return predSlotAId
  if (winnerIsTeamA === false) return predSlotBId
  return 'draw'
}

/** Ganador oficial en KO (incluye penales tras empate en el marcador). */
function koActualWinnerTeamId(
  match: MatchForScore,
  actualSlotAId: string,
  actualSlotBId: string,
): string | 'draw' {
  const ga = matchGoalsTeamA(match)
  const gb = matchGoalsTeamB(match)
  if (ga == null || gb == null) return 'draw'
  if (ga > gb) return actualSlotAId
  if (ga < gb) return actualSlotBId
  const winnerIsTeamA = penaltiesWinnerIsTeamAFromPayload(match)
  if (winnerIsTeamA === true) return actualSlotAId
  if (winnerIsTeamA === false) return actualSlotBId
  return 'draw'
}

function normalizeKoRoundId(round: string | undefined): KnockoutRoundId {
  switch (round) {
    case 'r32':
    case 'round32':
    case 'round_of_32':
    case '1/16':
      return 'r32'
    case 'r16':
    case 'round16':
    case 'round_of_16':
    case 'octavos':
      return 'r16'
    case 'qf':
    case 'quarter':
    case 'quarters':
    case 'cuartos':
      return 'qf'
    case 'sf':
    case 'semi':
    case 'semis':
    case 'semifinal':
      return 'sf'
    case 'third':
    case 'third_place':
    case 'tercer':
      return 'third'
    case 'final':
      return 'final'
    default:
      return 'r32'
  }
}

function scoreAdditiveMatch(
  row: MatchPointsRow,
  predTeamA: number,
  predTeamB: number,
  actualA: number,
  actualB: number,
  predSlotAId: string,
  predSlotBId: string,
  actualSlotAId: string,
  actualSlotBId: string,
  koContext?: { prediction: MatchPredictionPayload; match: MatchForScore },
): MatchScoreDetails {
  let points = 0
  let winnerOrDrawHit = false
  let goalsAHit = false
  let goalsBHit = false

  const predWinner = koContext
    ? koPredictedWinnerTeamId(koContext.prediction, predSlotAId, predSlotBId)
    : winnerTeamId(predTeamA, predTeamB, predSlotAId, predSlotBId)
  const actualWinner = koContext
    ? koActualWinnerTeamId(koContext.match, actualSlotAId, actualSlotBId)
    : winnerTeamId(actualA, actualB, actualSlotAId, actualSlotBId)
  if (predWinner === actualWinner) {
    points += row.winnerOrDraw
    winnerOrDrawHit = true
  }

  const predSign = matchResultSign(predTeamA, predTeamB)
  const actualSign = matchResultSign(actualA, actualB)
  // KO: sin goles parciales si predijiste empate/penales y el partido definió ganador en 90'.
  // Sí permite goles si el ganador coincide aunque local/visitante estén invertidos en el marcador.
  const allowGoalLines =
    !koContext ||
    predSign === actualSign ||
    (predSign !== 0 &&
      actualSign !== 0 &&
      predWinner !== 'draw' &&
      predWinner === actualWinner)

  const actualGoalsForPredA =
    predSlotAId === actualSlotAId ? actualA : predSlotAId === actualSlotBId ? actualB : null
  const actualGoalsForPredB =
    predSlotBId === actualSlotAId ? actualA : predSlotBId === actualSlotBId ? actualB : null

  if (allowGoalLines && actualGoalsForPredA !== null && predTeamA === actualGoalsForPredA) {
    points += row.goalsTeamA
    goalsAHit = true
  }
  if (allowGoalLines && actualGoalsForPredB !== null && predTeamB === actualGoalsForPredB) {
    points += row.goalsTeamB
    goalsBHit = true
  }

  const exact = goalsAHit && goalsBHit && winnerOrDrawHit
  const oneScoreHit = (goalsAHit || goalsBHit) && !exact

  return {
    points,
    exactScoreHit: exact,
    oneScoreHit,
    winnerOrDrawHit,
    goalsAHit,
    goalsBHit,
  }
}

/** Rivales distintos al cruce oficial: solo puntos por acertar el ganador (por ID de selección). */
function scoreKnockoutWrongOpponents(
  prediction: MatchPredictionPayload,
  match: MatchForScore,
  actualTeamAId: string,
  actualTeamBId: string,
  predTeamAId: string,
  predTeamBId: string,
  _actualA: number,
  _actualB: number,
  row: MatchPointsRow,
): MatchScoreDetails {
  const empty: MatchScoreDetails = {
    points: 0,
    exactScoreHit: false,
    oneScoreHit: false,
    winnerOrDrawHit: false,
    goalsAHit: false,
    goalsBHit: false,
  }
  const predWinner = koPredictedWinnerTeamId(prediction, predTeamAId, predTeamBId)
  const actualWinner = koActualWinnerTeamId(match, actualTeamAId, actualTeamBId)
  if (predWinner === 'draw' || predWinner !== actualWinner) return empty
  return {
    points: row.winnerOrDraw,
    exactScoreHit: false,
    oneScoreHit: false,
    winnerOrDrawHit: true,
    goalsAHit: false,
    goalsBHit: false,
  }
}

export interface MatchScoreDetails {
  points: number
  exactScoreHit: boolean
  oneScoreHit: boolean
  winnerOrDrawHit: boolean
  goalsAHit: boolean
  goalsBHit: boolean
}

export function scoreMatchPredictionDetails(
  match: MatchForScore,
  prediction: MatchPredictionPayload | null | undefined,
  predictedLineup?: PredictedKoLineup | null,
): MatchScoreDetails {
  const empty: MatchScoreDetails = {
    points: 0,
    exactScoreHit: false,
    oneScoreHit: false,
    winnerOrDrawHit: false,
    goalsAHit: false,
    goalsBHit: false,
  }
  if (match.status !== 'finished' || prediction == null) return empty
  const actualTeamA = matchGoalsTeamA(match)
  const actualTeamB = matchGoalsTeamB(match)
  if (actualTeamA == null || actualTeamB == null) return empty

  const predTeamA = predictionGoalsTeamA(prediction)
  const predTeamB = predictionGoalsTeamB(prediction)
  const ahId = matchTeamAId(match)
  const aaId = matchTeamBId(match)

  if (match.phase === 'group') {
    if (!ahId || !aaId) return empty
    return scoreAdditiveMatch(
      GROUP_ROW,
      predTeamA,
      predTeamB,
      actualTeamA,
      actualTeamB,
      ahId,
      aaId,
      ahId,
      aaId,
    )
  }

  const phId = predictedLineup?.predictedTeamAId ?? ahId
  const paId = predictedLineup?.predictedTeamBId ?? aaId
  const roundId = normalizeKoRoundId(match.round)
  const row = DEFAULT_RULESET.points.matchByPhase.knockout[roundId]

  if (
    match.phase === 'knockout' &&
    ahId &&
    aaId &&
    phId &&
    paId &&
    !koPairMatchesOfficial(phId, paId, ahId, aaId)
  ) {
    return scoreKnockoutWrongOpponents(
      prediction,
      match,
      ahId,
      aaId,
      phId,
      paId,
      actualTeamA,
      actualTeamB,
      row,
    )
  }

  if (!ahId || !aaId || !phId || !paId) return empty

  return scoreAdditiveMatch(
    row,
    predTeamA,
    predTeamB,
    actualTeamA,
    actualTeamB,
    phId,
    paId,
    ahId,
    aaId,
    { prediction, match },
  )
}

export function scoreMatchPrediction(
  match: MatchForScore,
  prediction: MatchPredictionPayload | null | undefined,
  predictedLineup?: PredictedKoLineup | null,
): number {
  return scoreMatchPredictionDetails(match, prediction, predictedLineup).points
}

/** Texto breve para tooltip: desglose de puntos del partido (no incluye extras de campeón). */
export function matchPointsBreakdownLabel(
  match: MatchForScore,
  details: MatchScoreDetails,
): string {
  if (details.points === 0) return 'Sin puntos de partido'
  const roundId = normalizeKoRoundId(match.round)
  const row =
    match.phase === 'group'
      ? GROUP_ROW
      : DEFAULT_RULESET.points.matchByPhase.knockout[roundId]
  const parts: string[] = []
  if (details.winnerOrDrawHit) parts.push(`ganador +${row.winnerOrDraw}`)
  if (details.goalsAHit) parts.push(`gol A +${row.goalsTeamA}`)
  if (details.goalsBHit) parts.push(`gol B +${row.goalsTeamB}`)
  return `${parts.join(', ')} (total partido ${details.points}; campeón +22 va en ESPECIALES)`
}

function payloadsEqual(
  a: TournamentPredictionPayload | null,
  b: TournamentPredictionPayload | null,
): boolean {
  if (a == null || b == null) return false
  if (a.kind !== b.kind) return false
  switch (a.kind) {
    case 'team':
      return b.kind === 'team' && a.teamId === b.teamId
    case 'player':
      return b.kind === 'player' && a.playerId === b.playerId
    case 'boolean':
      return b.kind === 'boolean' && a.value === b.value
    case 'range':
      return b.kind === 'range' && a.rangeId === b.rangeId
    case 'group':
      return b.kind === 'group' && a.groupId === b.groupId
    case 'match_ref':
      return b.kind === 'match_ref' && a.matchId === b.matchId
    case 'text':
      return (
        b.kind === 'text' &&
        a.value.trim().toLowerCase().replace(/\s+/g, ' ') ===
          b.value.trim().toLowerCase().replace(/\s+/g, ' ')
      )
    default:
      return false
  }
}

export function scoreTournamentPrediction(
  questionId: string,
  officialAnswer: TournamentPredictionPayload | null,
  prediction: TournamentPredictionPayload | null | undefined,
): number {
  if (officialAnswer == null || prediction == null) return 0
  if (!payloadsEqual(officialAnswer, prediction)) return 0

  if (questionId === EXTRA_IDS.champion) return POINTS_CHAMPION
  if (questionId === EXTRA_IDS.runnerUp) return POINTS_RUNNER_UP
  if (questionId === EXTRA_IDS.thirdPlace) return POINTS_THIRD_PLACE
  if (questionId === EXTRA_IDS.fourthPlace) return POINTS_FOURTH_PLACE
  if (questionId === SPECIAL_IDS.topScorer) return POINTS_TOP_SCORER
  if (questionId === SPECIAL_IDS.bestGoalkeeperAverage) return POINTS_BEST_GOALKEEPER_AVERAGE
  if ((BONUS_QUESTION_IDS as readonly string[]).includes(questionId)) {
    return POINTS_BONUS_QUESTION
  }
  return 0
}

export interface MatchScoreInput {
  matchId: string
  match: MatchForScore
  prediction: MatchPredictionPayload | null
  predictedLineup?: PredictedKoLineup | null
}

export interface TournamentScoreInput {
  questionId: string
  officialAnswer: TournamentPredictionPayload | null
  prediction: TournamentPredictionPayload | null
}

export interface PlayerPerMatchScoreInput {
  matchId: string
  match: Pick<MatchDoc, 'status' | 'scorers' | 'phase' | 'round'>
  playerKey: string | null
}

export interface TotalScoreSummary {
  total: number
  matchPoints: number
  tournamentPoints: number
  advancementPoints: number
  bracketAdvancementPoints: number
  specialsPoints: number
  playerPickPoints: number
  tieBreak: {
    exactScoreHits: number
    specialQuestionHits: number
    championHit: boolean
  }
}

function goalsPerGoalForMatch(match: Pick<MatchDoc, 'phase' | 'round'>): number {
  if (match.phase === 'group') {
    return DEFAULT_RULESET.points.playerPerMatch.goalsPerGoalByRound.group
  }
  const roundId = normalizeKoRoundId(match.round)
  return DEFAULT_RULESET.points.playerPerMatch.goalsPerGoalByRound[roundId]
}

export function scorePlayerPerMatchPick(
  match: Pick<MatchDoc, 'status' | 'scorers' | 'phase' | 'round'>,
  playerKey: string | null | undefined,
  pickPlayer?: PlayerRef | null,
): number {
  if (!playerKey || (match.status !== 'finished' && match.status !== 'live')) return 0
  const scorers = match.scorers
  if (!scorers?.length) return 0
  const pick: PlayerRef = pickPlayer ?? { playerKey }
  const ptsPerGoal = goalsPerGoalForMatch(match)
  let total = 0
  for (const s of scorers) {
    if (s.includesPenalties) continue
    if (!scorerMatchesPick(pick, s)) continue
    if (typeof s.goals !== 'number' || s.goals <= 0) continue
    total += s.goals * ptsPerGoal
  }
  return total
}

function isPodiumAdvancementQuestion(questionId: string): boolean {
  return (
    questionId === EXTRA_IDS.champion ||
    questionId === EXTRA_IDS.runnerUp ||
    questionId === EXTRA_IDS.thirdPlace ||
    questionId === EXTRA_IDS.fourthPlace
  )
}

function isSpecialQuestion(questionId: string): boolean {
  return (
    questionId === SPECIAL_IDS.topScorer ||
    questionId === SPECIAL_IDS.bestGoalkeeperAverage ||
    (BONUS_QUESTION_IDS as readonly string[]).includes(questionId)
  )
}

export function totalPointsFromParts(
  matchParts: MatchScoreInput[],
  tournamentParts: TournamentScoreInput[],
  playerPickParts: PlayerPerMatchScoreInput[] = [],
  bracketAdvancementPoints = 0,
): TotalScoreSummary {
  let matchPoints = 0
  let exactScoreHits = 0
  for (const p of matchParts) {
    const details = scoreMatchPredictionDetails(p.match, p.prediction, p.predictedLineup)
    matchPoints += details.points
    if (details.exactScoreHit) exactScoreHits += 1
  }
  let tournamentPoints = 0
  let podiumAdvancementPoints = 0
  let specialsPoints = 0
  let specialQuestionHits = 0
  let championHit = false
  for (const t of tournamentParts) {
    const points = scoreTournamentPrediction(t.questionId, t.officialAnswer, t.prediction)
    tournamentPoints += points
    if (isPodiumAdvancementQuestion(t.questionId)) podiumAdvancementPoints += points
    if (isSpecialQuestion(t.questionId)) specialsPoints += points
    if (points > 0 && (BONUS_QUESTION_IDS as readonly string[]).includes(t.questionId)) {
      specialQuestionHits += 1
    }
    if (points > 0 && t.questionId === EXTRA_IDS.champion) {
      championHit = true
    }
  }
  let playerPickPoints = 0
  for (const p of playerPickParts) {
    playerPickPoints += scorePlayerPerMatchPick(p.match, p.playerKey)
  }
  const advancementPoints = podiumAdvancementPoints + bracketAdvancementPoints
  return {
    total: matchPoints + tournamentPoints + playerPickPoints + bracketAdvancementPoints,
    matchPoints,
    tournamentPoints,
    advancementPoints,
    bracketAdvancementPoints,
    specialsPoints,
    playerPickPoints,
    tieBreak: {
      exactScoreHits,
      specialQuestionHits,
      championHit,
    },
  }
}
