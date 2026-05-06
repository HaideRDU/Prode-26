/**
 * IDs estables para predicciones de torneo.
 * Los textos viven en bonusQuestionsMeta; aquí solo identificadores.
 */

/** Extras con puntos específicos (no 3) */
export const EXTRA_IDS = {
  champion: 'extra_champion', // 5 pts
  runnerUp: 'extra_runner_up', // 3 pts
  thirdPlace: 'extra_third_place', // 2 pts
  fourthPlace: 'extra_fourth_place', // 1 pt
  topScorer: 'extra_top_scorer',
  bestGoalkeeperAverage: 'special_best_goalkeeper_average',
} as const

/** 5 preguntas especiales del reglamento WC2026 */
export const BONUS_QUESTION_IDS = [
  'q_special_first_goal_colombia',
  'q_special_biggest_win_scoreline',
  'q_special_top_scoring_team_groups',
  'q_special_first_red_team',
  'q_special_revelation_team',
] as const

export type BonusQuestionId = (typeof BONUS_QUESTION_IDS)[number]
