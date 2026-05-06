/**
 * Motor de puntuación (funciones puras) alineado al reglamento WC2026 v1.
 */
import type {
  MatchDoc,
  MatchPredictionPayload,
  TournamentPredictionPayload,
} from '../types/predictions'
import { BONUS_QUESTION_IDS, EXTRA_IDS } from '../data/questionIds'
import { DEFAULT_RULESET, type KnockoutRoundId } from '../config/ruleset'

/** Puntos exportados para UI informativa */
export const GROUP_EXACT_SCORE_POINTS = DEFAULT_RULESET.points.group.exactScore
export const GROUP_ONE_SCORE_POINTS = DEFAULT_RULESET.points.group.oneScoreHit
export const GROUP_WINNER_POINTS = DEFAULT_RULESET.points.group.winnerOrDrawHit
export const KO_WINNER_POINTS = DEFAULT_RULESET.points.knockout.winnerHitWhenNotExact
export const KO_ONE_SCORE_POINTS = DEFAULT_RULESET.points.knockout.oneScoreHitWhenNotExact
export const KO_PENALTY_BONUS_POINTS = 0
export const POINTS_CHAMPION = DEFAULT_RULESET.points.advancement.champion
export const POINTS_RUNNER_UP = DEFAULT_RULESET.points.advancement.runnerUp
export const POINTS_THIRD_PLACE = DEFAULT_RULESET.points.advancement.thirdPlace
export const POINTS_FOURTH_PLACE = 0
export const POINTS_TOP_SCORER = DEFAULT_RULESET.points.specials.topScorer
export const POINTS_BONUS_QUESTION = DEFAULT_RULESET.points.specials.bonusQuestion
export const POINTS_BEST_GOALKEEPER_AVERAGE = DEFAULT_RULESET.points.specials.bestGoalkeeperAverage

export const SPECIAL_IDS = {
  topScorer: EXTRA_IDS.topScorer,
  bestGoalkeeperAverage: EXTRA_IDS.bestGoalkeeperAverage,
} as const

type MatchForScore = Pick<
  MatchDoc,
  | 'phase'
  | 'status'
  | 'goalsHome'
  | 'goalsAway'
  | 'wentToPenalties'
  | 'penaltiesWinnerHome'
  | 'round'
>

function matchResultSign(goalsHome: number, goalsAway: number): -1 | 0 | 1 {
  if (goalsHome > goalsAway) return 1
  if (goalsHome < goalsAway) return -1
  return 0
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

function oneSideGoalsHit(
  actualHome: number,
  actualAway: number,
  predHome: number,
  predAway: number,
): boolean {
  return actualHome === predHome || actualAway === predAway
}

function normalizeTextAnswer(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

export interface MatchScoreDetails {
  points: number
  exactScoreHit: boolean
  oneScoreHit: boolean
  winnerOrDrawHit: boolean
}

export function scoreMatchPredictionDetails(
  match: MatchForScore,
  prediction: MatchPredictionPayload | null | undefined,
): MatchScoreDetails {
  if (match.status !== 'finished' || prediction == null) {
    return { points: 0, exactScoreHit: false, oneScoreHit: false, winnerOrDrawHit: false }
  }
  if (match.goalsHome == null || match.goalsAway == null) {
    return { points: 0, exactScoreHit: false, oneScoreHit: false, winnerOrDrawHit: false }
  }

  const actualH = match.goalsHome
  const actualA = match.goalsAway
  const actualResult = matchResultSign(actualH, actualA)
  const predResult = matchResultSign(prediction.goalsHome, prediction.goalsAway)
  const exact = prediction.goalsHome === actualH && prediction.goalsAway === actualA
  const oneScoreHit = oneSideGoalsHit(actualH, actualA, prediction.goalsHome, prediction.goalsAway)
  const winnerOrDrawHit = predResult === actualResult

  if (match.phase === 'group') {
    if (exact) {
      return {
        points: GROUP_EXACT_SCORE_POINTS,
        exactScoreHit: true,
        oneScoreHit: false,
        winnerOrDrawHit: false,
      }
    }
    let points = 0
    if (oneScoreHit) points += GROUP_ONE_SCORE_POINTS
    if (winnerOrDrawHit) points += GROUP_WINNER_POINTS
    return {
      points,
      exactScoreHit: false,
      oneScoreHit,
      winnerOrDrawHit,
    }
  }

  if (exact) {
    const roundId = normalizeKoRoundId(match.round)
    return {
      points: DEFAULT_RULESET.points.knockout.exactScoreByRound[roundId],
      exactScoreHit: true,
      oneScoreHit: false,
      winnerOrDrawHit: false,
    }
  }
  let points = 0
  if (oneScoreHit) points += KO_ONE_SCORE_POINTS
  if (winnerOrDrawHit) points += KO_WINNER_POINTS
  return {
    points,
    exactScoreHit: false,
    oneScoreHit,
    winnerOrDrawHit,
  }
}

/** Puntos por un partido ya terminado y una predicción de marcador */
export function scoreMatchPrediction(
  match: MatchForScore,
  prediction: MatchPredictionPayload | null | undefined,
): number {
  return scoreMatchPredictionDetails(match, prediction).points
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
      return b.kind === 'text' && normalizeTextAnswer(a.value) === normalizeTextAnswer(b.value)
    default:
      return false
  }
}

/** Puntos para una predicción de torneo vs resultado oficial */
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
}

export interface TournamentScoreInput {
  questionId: string
  officialAnswer: TournamentPredictionPayload | null
  prediction: TournamentPredictionPayload | null
}

export interface TotalScoreSummary {
  total: number
  matchPoints: number
  tournamentPoints: number
  advancementPoints: number
  specialsPoints: number
  tieBreak: {
    exactScoreHits: number
    specialQuestionHits: number
    championHit: boolean
  }
}

function isAdvancementQuestion(questionId: string): boolean {
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

/** Suma puntos de partidos + preguntas de torneo */
export function totalPointsFromParts(
  matchParts: MatchScoreInput[],
  tournamentParts: TournamentScoreInput[],
): TotalScoreSummary {
  let matchPoints = 0
  let exactScoreHits = 0
  for (const p of matchParts) {
    const details = scoreMatchPredictionDetails(p.match, p.prediction)
    matchPoints += details.points
    if (details.exactScoreHit) exactScoreHits += 1
  }
  let tournamentPoints = 0
  let advancementPoints = 0
  let specialsPoints = 0
  let specialQuestionHits = 0
  let championHit = false
  for (const t of tournamentParts) {
    const points = scoreTournamentPrediction(t.questionId, t.officialAnswer, t.prediction)
    tournamentPoints += points
    if (isAdvancementQuestion(t.questionId)) advancementPoints += points
    if (isSpecialQuestion(t.questionId)) specialsPoints += points
    if (points > 0 && (BONUS_QUESTION_IDS as readonly string[]).includes(t.questionId)) {
      specialQuestionHits += 1
    }
    if (points > 0 && t.questionId === EXTRA_IDS.champion) {
      championHit = true
    }
  }
  return {
    total: matchPoints + tournamentPoints,
    matchPoints,
    tournamentPoints,
    advancementPoints,
    specialsPoints,
    tieBreak: {
      exactScoreHits,
      specialQuestionHits,
      championHit,
    },
  }
}
