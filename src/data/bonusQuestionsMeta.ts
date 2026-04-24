/**
 * Metadatos UI para extras y banco de preguntas (control + etiqueta ES).
 */
import { BONUS_QUESTION_IDS, EXTRA_IDS } from './questionIds'
import { RANGE_OPTIONS_BY_QUESTION_ID } from './bonusRangeOptions'

export type BonusControl = 'team' | 'text' | 'match_ref' | 'range' | 'group' | 'boolean'

export interface QuestionMeta {
  id: string
  labelEs: string
  control: BonusControl
  rangeOptions?: readonly { rangeId: string; labelEs: string }[]
}

const EXTRAS: QuestionMeta[] = [
  { id: EXTRA_IDS.topScorer, labelEs: 'Máximo goleador (nombre o apodo)', control: 'text' },
]

const BONUS_LABELS: Record<
  (typeof BONUS_QUESTION_IDS)[number],
  { labelEs: string; control: BonusControl }
> = {
  q_offense_most_goals_total: { labelEs: 'Selección con más goles en total', control: 'team' },
  q_offense_most_goals_group: { labelEs: 'Selección con más goles (solo fase de grupos)', control: 'team' },
  q_offense_most_goals_single_match: { labelEs: 'Partido con más goles', control: 'match_ref' },
  q_offense_most_lopsided_score: {
    labelEs: 'Mayor goleada: marcador predicho (local y visita)',
    control: 'text',
  },
  q_offense_over_5_goals: { labelEs: '¿Partido con más de 5 goles? (sí/no)', control: 'boolean' },
  q_offense_best_goal_average: { labelEs: 'Mejor promedio de gol (selección)', control: 'team' },
  q_defense_least_conceded: {
    labelEs:
      'Selección con menos goles encajados (defensa); puede haber empate entre varias — elegí una',
    control: 'team',
  },
  q_defense_most_conceded: {
    labelEs:
      'Selección con más goles encajados (defensa); puede haber empate entre varias — elegí una',
    control: 'team',
  },
  q_defense_most_clean_sheets: { labelEs: 'Más porterías a cero (selección)', control: 'team' },
  q_stats_most_corners_match: { labelEs: 'Partido con más córners (entre tus predicciones)', control: 'match_ref' },
  q_stats_most_fouls_match: { labelEs: 'Partido con más faltas (entre tus predicciones)', control: 'match_ref' },
  q_stats_most_penalties_match: {
    labelEs: 'Partido con más penaltis señalados (entre tus predicciones)',
    control: 'match_ref',
  },
  q_stats_penalties_total_range: {
    labelEs: 'Total de penaltis señalados en el torneo (elegí una franja)',
    control: 'range',
  },
  q_stats_total_goals_range: {
    labelEs: 'Total de goles del torneo (elegí una franja; estimación por partidos)',
    control: 'range',
  },
  q_discipline_most_yellows: { labelEs: 'Selección con más tarjetas amarillas', control: 'team' },
  q_discipline_most_reds: { labelEs: 'Selección con más tarjetas rojas', control: 'team' },
  q_discipline_red_in_final: { labelEs: '¿Expulsión en la final?', control: 'boolean' },
  q_discipline_first_yellow_player: { labelEs: 'Primer jugador amonestado', control: 'text' },
  q_players_top_assists: { labelEs: 'Máximo asistente (jugador)', control: 'text' },
  q_players_hat_trick: { labelEs: 'Primer hat-trick (solo jugador)', control: 'text' },
  q_players_first_goal: { labelEs: 'Autor del primer gol del torneo', control: 'text' },
  q_events_goals_extra_time: { labelEs: 'Goles en prórroga (total torneo, franja)', control: 'text' },
  q_events_penalty_shootout_final: { labelEs: '¿Final a penales? (sí/no)', control: 'boolean' },
  q_team_surprise: { labelEs: 'Selección sorpresa (fuera del podio esperado)', control: 'team' },
  q_team_favorite_out_first: { labelEs: 'Favorito que caerá antes', control: 'team' },
  q_team_last_in_group: {
    labelEs:
      'Selección peor clasificada en su grupo (menos puntos; varios equipos pueden empatar abajo)',
    control: 'team',
  },
  q_group_most_goals_total: { labelEs: 'Grupo con más goles en total', control: 'group' },
  q_fun_own_goals: { labelEs: '¿Habrá autogol? (sí/no)', control: 'boolean' },
  q_fun_own_goals_count: { labelEs: 'Número de autogoles', control: 'text' },
  q_fun_most_repeated_scoreline: {
    labelEs: 'Marcador más repetido en los partidos (ej. 1-0, 2-1)',
    control: 'text',
  },
}

const BONUS: QuestionMeta[] = BONUS_QUESTION_IDS.map((id) => {
  const row = BONUS_LABELS[id]
  const rangeOptions = RANGE_OPTIONS_BY_QUESTION_ID[id]
  return {
    id,
    labelEs: row.labelEs,
    control: row.control,
    ...(rangeOptions ? { rangeOptions } : {}),
  }
})

export const ALL_QUESTION_METAS: QuestionMeta[] = [...EXTRAS, ...BONUS]

export const BONUS_BANK_METAS: QuestionMeta[] = BONUS
