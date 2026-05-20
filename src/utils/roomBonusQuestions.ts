import { BONUS_QUESTION_IDS } from '../data/questionIds'
import type { RoomDoc } from '../types/predictions'

const BONUS_ID_SET = new Set<string>(BONUS_QUESTION_IDS)

/** True si la sala puntúa al menos una pregunta del banco de especiales. */
export function roomHasBonusQuestions(room: RoomDoc | null | undefined, isGlobalRoom: boolean): boolean {
  if (isGlobalRoom) return true
  if (!room || room.type === 'global') return true
  const ids = room.enabledQuestionIds
  if (!Array.isArray(ids)) return true
  return ids.some((id) => BONUS_ID_SET.has(id))
}
