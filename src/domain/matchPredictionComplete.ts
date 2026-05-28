import { penaltiesWinnerIsTeamAFromPayload } from './matchPenalties'
import type { MatchPredictionPayload } from '../types/predictions'

/** Predicción usable para listados (bonus): marcador completo y, en KO, desempate si hay empate. */
export function isCompleteMatchPredictionForPicker(
  pred: MatchPredictionPayload | undefined,
  phase: 'group' | 'knockout',
): boolean {
  if (!pred) return false
  const { goalsTeamA, goalsTeamB } = pred
  if (typeof goalsTeamA !== 'number' || typeof goalsTeamB !== 'number') return false
  if (goalsTeamA < 0 || goalsTeamB < 0) return false
  if (phase === 'group') return true
  if (goalsTeamA !== goalsTeamB) return true
  return pred.wentToPenalties === true && penaltiesWinnerIsTeamAFromPayload(pred) !== null
}
