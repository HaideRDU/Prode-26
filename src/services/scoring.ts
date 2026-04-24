/**
 * Motor de puntuación (funciones puras).
 * Fase grupos: ganador correcto +1; marcador exacto +2 (si es exacto, solo cuenta el mayor de los dos).
 * Eliminatorias: ganador +2; marcador exacto +4; bonus penales +3 si acierta empate, tanda y ganador.
 * Extras: campeón 5, subcampeón 3, goleador 4.
 * Preguntas bonus: 3 pts cada acierto.
 */
import type {
  MatchDoc,
  MatchPredictionPayload,
  TournamentPredictionPayload,
} from '../types/predictions'
import { BONUS_QUESTION_IDS, EXTRA_IDS } from '../data/questionIds'

/** Puntos por partido (fase de grupos) — exportados para UI informativa */
export const GROUP_WINNER_POINTS = 1
export const GROUP_EXACT_SCORE_POINTS = 2
/** Puntos por partido (eliminatorias) */
export const KO_WINNER_POINTS = 2
export const KO_EXACT_SCORE_POINTS = 4
export const KO_PENALTY_BONUS_POINTS = 3
/** Extras (podio / goleador) y banco de preguntas */
export const POINTS_CHAMPION = 5
export const POINTS_RUNNER_UP = 3
export const POINTS_THIRD_PLACE = 2
export const POINTS_FOURTH_PLACE = 1
export const POINTS_TOP_SCORER = 4
export const POINTS_BONUS_QUESTION = 3

const GROUP_WINNER = GROUP_WINNER_POINTS
const GROUP_EXACT = GROUP_EXACT_SCORE_POINTS
const KO_WINNER = KO_WINNER_POINTS
const KO_EXACT = KO_EXACT_SCORE_POINTS
const KO_PENALTY_BONUS = KO_PENALTY_BONUS_POINTS

type MatchForScore = Pick<
  MatchDoc,
  | 'phase'
  | 'status'
  | 'goalsHome'
  | 'goalsAway'
  | 'wentToPenalties'
  | 'penaltiesWinnerHome'
>

/** Resultado del partido: -1 visita, 0 empate, 1 local (en KO con empate en goles, penales deciden) */
function matchResultSign(goalsHome: number, goalsAway: number): -1 | 0 | 1 {
  if (goalsHome > goalsAway) return 1
  if (goalsHome < goalsAway) return -1
  return 0
}

function actualWinnerSign(match: MatchForScore): -1 | 0 | 1 {
  if (match.goalsHome == null || match.goalsAway == null) return 0
  const g = matchResultSign(match.goalsHome, match.goalsAway)
  if (g !== 0) return g
  if (
    match.phase === 'knockout' &&
    match.wentToPenalties &&
    match.penaltiesWinnerHome != null
  ) {
    return match.penaltiesWinnerHome ? 1 : -1
  }
  return 0
}

function predWinnerSign(pred: MatchPredictionPayload): -1 | 0 | 1 {
  const g = matchResultSign(pred.goalsHome, pred.goalsAway)
  if (g !== 0) return g
  if (pred.wentToPenalties && pred.penaltiesWinnerHome !== undefined) {
    return pred.penaltiesWinnerHome ? 1 : -1
  }
  return 0
}

function normalizeTextAnswer(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Puntos por un partido ya terminado y una predicción de marcador */
export function scoreMatchPrediction(
  match: MatchForScore,
  prediction: MatchPredictionPayload | null | undefined,
): number {
  if (match.status !== 'finished' || prediction == null) return 0
  if (match.goalsHome == null || match.goalsAway == null) return 0

  const actualH = match.goalsHome
  const actualA = match.goalsAway
  const exact = prediction.goalsHome === actualH && prediction.goalsAway === actualA
  const winnerOk = predWinnerSign(prediction) === actualWinnerSign(match)

  if (match.phase === 'group') {
    if (exact) return GROUP_EXACT
    if (winnerOk) return GROUP_WINNER
    return 0
  }

  let pts = 0
  if (exact) pts = KO_EXACT
  else if (winnerOk) pts = KO_WINNER
  else return 0

  const offPens = Boolean(match.wentToPenalties)
  const predPens = Boolean(prediction.wentToPenalties)
  if (
    exact &&
    offPens &&
    predPens &&
    match.penaltiesWinnerHome != null &&
    prediction.penaltiesWinnerHome !== undefined &&
    match.penaltiesWinnerHome === prediction.penaltiesWinnerHome
  ) {
    pts += KO_PENALTY_BONUS
  }
  return pts
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
  if (questionId === EXTRA_IDS.topScorer) return POINTS_TOP_SCORER
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

/** Suma puntos de partidos + preguntas de torneo */
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
