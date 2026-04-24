/**
 * IDs estables para extras (puntos distintos) y preguntas de bonus (3 pts c/u).
 * Los textos largos pueden ir en UI o i18n; aquí solo identificadores.
 */

/** Extras con puntos específicos (no 3) */
export const EXTRA_IDS = {
  champion: 'extra_champion', // 5 pts
  runnerUp: 'extra_runner_up', // 3 pts
  thirdPlace: 'extra_third_place', // 2 pts
  fourthPlace: 'extra_fourth_place', // 1 pt
  topScorer: 'extra_top_scorer', // 4 pts
} as const

/** Preguntas tipo quiz: 3 puntos cada acierto */
export const BONUS_QUESTION_IDS = [
  'q_offense_most_goals_total',
  'q_offense_most_goals_group',
  'q_offense_most_goals_single_match',
  'q_offense_most_lopsided_score',
  'q_offense_over_5_goals',
  'q_offense_best_goal_average',
  'q_defense_least_conceded',
  'q_defense_most_conceded',
  'q_defense_most_clean_sheets',
  'q_stats_most_corners_match',
  'q_stats_most_fouls_match',
  'q_stats_most_penalties_match',
  'q_stats_penalties_total_range',
  'q_stats_total_goals_range',
  'q_discipline_most_yellows',
  'q_discipline_most_reds',
  'q_discipline_red_in_final',
  'q_discipline_first_yellow_player',
  'q_players_top_assists',
  'q_players_hat_trick',
  'q_players_first_goal',
  'q_events_goals_extra_time',
  'q_events_penalty_shootout_final',
  'q_team_surprise',
  'q_team_favorite_out_first',
  'q_team_last_in_group',
  'q_group_most_goals_total',
  'q_fun_own_goals',
  'q_fun_own_goals_count',
  'q_fun_most_repeated_scoreline',
] as const

export type BonusQuestionId = (typeof BONUS_QUESTION_IDS)[number]
