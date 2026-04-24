import type { MatchPredictionPayload } from '../types/predictions'

/** Predicción usable para listados (bonus): marcador completo y, en KO, desempate si hay empate. */
export function isCompleteMatchPredictionForPicker(
  pred: MatchPredictionPayload | undefined,
  phase: 'group' | 'knockout',
): boolean {
  if (!pred) return false
  const { goalsHome, goalsAway } = pred
  if (typeof goalsHome !== 'number' || typeof goalsAway !== 'number') return false
  if (goalsHome < 0 || goalsAway < 0) return false
  if (phase === 'group') return true
  if (goalsHome !== goalsAway) return true
  return pred.wentToPenalties === true && pred.penaltiesWinnerHome !== undefined
}
