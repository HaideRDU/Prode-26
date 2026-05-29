import type { MatchDoc, MatchPredictionPayload } from '../types/predictions'
import { formatScorePair } from './parseScoreText'
import { matchGoalsTeamA, matchGoalsTeamB, predictionGoalsTeamA, predictionGoalsTeamB } from './matchFields'
import { penaltiesWinnerIsTeamAFromPayload } from './matchPenalties'

function pensSuffix(winnerIsTeamA: boolean | null): string {
  if (winnerIsTeamA === null) return ''
  return winnerIsTeamA ? ' (pen. A)' : ' (pen. B)'
}

export function formatOfficialMatchScore(match: MatchDoc): string {
  const ga = matchGoalsTeamA(match)
  const gb = matchGoalsTeamB(match)
  if (ga == null || gb == null) return '—'
  const base = formatScorePair(ga, gb)
  if (ga !== gb) return base
  const pens = penaltiesWinnerIsTeamAFromPayload(match)
  return base + pensSuffix(pens)
}

export function formatPredictionMatchScore(prediction: MatchPredictionPayload): string {
  const ga = predictionGoalsTeamA(prediction)
  const gb = predictionGoalsTeamB(prediction)
  const base = formatScorePair(ga, gb)
  if (ga !== gb) return base
  const pens = penaltiesWinnerIsTeamAFromPayload(prediction)
  return base + pensSuffix(pens)
}
