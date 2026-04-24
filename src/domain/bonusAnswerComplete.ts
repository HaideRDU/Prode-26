import type { QuestionMeta } from '../data/bonusQuestionsMeta'
import type { TournamentPredictionPayload } from '../types/predictions'

function rangeIdValid(meta: QuestionMeta, rangeId: string): boolean {
  const opts = meta.rangeOptions
  if (!opts?.length) return rangeId.trim().length > 0
  return opts.some((o) => o.rangeId === rangeId)
}

/** Respuesta válida para habilitar guardado global (extras obligatorios). */
export function isBonusPayloadComplete(
  meta: QuestionMeta,
  p: TournamentPredictionPayload | undefined,
): boolean {
  if (!p) return false
  switch (meta.control) {
    case 'team':
      return p.kind === 'team' && p.teamId.trim().length > 0
    case 'text':
      return p.kind === 'text' && p.value.trim().length > 0
    case 'match_ref':
      return p.kind === 'match_ref' && p.matchId.trim().length > 0
    case 'range':
      return p.kind === 'range' && rangeIdValid(meta, p.rangeId)
    case 'group':
      return p.kind === 'group' && p.groupId.trim().length > 0
    case 'boolean':
      return p.kind === 'boolean'
    default:
      return false
  }
}
