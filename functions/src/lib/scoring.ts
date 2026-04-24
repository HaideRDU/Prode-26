/**
 * Motor de puntuación (copia alineada con src/services/scoring.ts).
 */
import type {
  MatchDoc,
  MatchPredictionPayload,
  TournamentPredictionPayload,
} from './types/predictions'
import { BONUS_QUESTION_IDS, EXTRA_IDS } from './questionIds'

const GROUP_WINNER = 1
const GROUP_EXACT = 2
const KO_WINNER = 2
const KO_EXACT = 4

const POINTS_CHAMPION = 5
const POINTS_RUNNER_UP = 3
const POINTS_THIRD_PLACE = 2
const POINTS_FOURTH_PLACE = 1
const POINTS_TOP_SCORER = 4
const POINTS_BONUS_QUESTION = 3

function matchResultSign(goalsHome: number, goalsAway: number): -1 | 0 | 1 {
  if (goalsHome > goalsAway) return 1
  if (goalsHome < goalsAway) return -1
  return 0
}

function predSign(p: MatchPredictionPayload): -1 | 0 | 1 {
  return matchResultSign(p.goalsHome, p.goalsAway)
}

export function scoreMatchPrediction(
  match: Pick<MatchDoc, 'phase' | 'status' | 'goalsHome' | 'goalsAway'>,
  prediction: MatchPredictionPayload | null | undefined,
): number {
  if (match.status !== 'finished' || prediction == null) return 0
  if (match.goalsHome == null || match.goalsAway == null) return 0

  const actualH = match.goalsHome
  const actualA = match.goalsAway
  const exact = prediction.goalsHome === actualH && prediction.goalsAway === actualA
  const winnerOk = predSign(prediction) === matchResultSign(actualH, actualA)

  if (match.phase === 'group') {
    if (exact) return GROUP_EXACT
    if (winnerOk) return GROUP_WINNER
    return 0
  }
  if (exact) return KO_EXACT
  if (winnerOk) return KO_WINNER
  return 0
}

function normalizeTextAnswer(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
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
  if (questionId === EXTRA_IDS.topScorer) return POINTS_TOP_SCORER
  if ((BONUS_QUESTION_IDS as readonly string[]).includes(questionId)) {
    return POINTS_BONUS_QUESTION
  }
  return 0
}

export interface MatchScoreInput {
  matchId: string
  match: Pick<MatchDoc, 'phase' | 'status' | 'goalsHome' | 'goalsAway'>
  prediction: MatchPredictionPayload | null
}

export interface TournamentScoreInput {
  questionId: string
  officialAnswer: TournamentPredictionPayload | null
  prediction: TournamentPredictionPayload | null
}

export function totalPointsFromParts(
  matchParts: MatchScoreInput[],
  tournamentParts: TournamentScoreInput[],
): { total: number; matchPoints: number; tournamentPoints: number } {
  let matchPoints = 0
  for (const p of matchParts) {
    matchPoints += scoreMatchPrediction(p.match, p.prediction)
  }
  let tournamentPoints = 0
  for (const t of tournamentParts) {
    tournamentPoints += scoreTournamentPrediction(t.questionId, t.officialAnswer, t.prediction)
  }
  return {
    total: matchPoints + tournamentPoints,
    matchPoints,
    tournamentPoints,
  }
}
