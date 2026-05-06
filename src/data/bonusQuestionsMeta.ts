/**
 * Metadatos UI para extras y banco de preguntas (control + etiqueta ES).
 */
import { BONUS_QUESTION_IDS } from './questionIds'

export type BonusControl = 'team' | 'text' | 'match_ref' | 'range' | 'group' | 'boolean'

export interface QuestionMeta {
  id: string
  labelEs: string
  control: BonusControl
  rangeOptions?: readonly { rangeId: string; labelEs: string }[]
}

const BONUS_LABELS: Record<
  (typeof BONUS_QUESTION_IDS)[number],
  { labelEs: string; control: BonusControl }
> = {
  q_special_first_goal_colombia: {
    labelEs: '¿Quién marcará el primer gol de la Selección Colombia?',
    control: 'text',
  },
  q_special_biggest_win_scoreline: {
    labelEs: '¿Cuál será el marcador de la mayor goleada del torneo?',
    control: 'text',
  },
  q_special_top_scoring_team_groups: {
    labelEs: '¿Cuál selección será la más goleadora en la fase de grupos?',
    control: 'team',
  },
  q_special_first_red_team: {
    labelEs: '¿De qué equipo será el primer expulsado del Mundial?',
    control: 'team',
  },
  q_special_revelation_team: {
    labelEs: '¿Cuál será el equipo revelación (sin finales previas) que llegue más lejos?',
    control: 'team',
  },
}

const BONUS: QuestionMeta[] = BONUS_QUESTION_IDS.map((id) => {
  const row = BONUS_LABELS[id]
  return {
    id,
    labelEs: row.labelEs,
    control: row.control,
  }
})

export const ALL_QUESTION_METAS: QuestionMeta[] = BONUS

export const BONUS_BANK_METAS: QuestionMeta[] = BONUS
