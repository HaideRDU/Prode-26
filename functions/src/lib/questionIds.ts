/** Copia alineada con src/data/questionIds.ts */

export const EXTRA_IDS = {
  champion: 'extra_champion',
  runnerUp: 'extra_runner_up',
  thirdPlace: 'extra_third_place',
  fourthPlace: 'extra_fourth_place',
  topScorer: 'extra_top_scorer',
  bestGoalkeeperAverage: 'special_best_goalkeeper_average',
} as const

export const BONUS_QUESTION_IDS = [
  'q_special_first_goal_colombia',
  'q_special_biggest_win_scoreline',
  'q_special_top_scoring_team_groups',
  'q_special_first_red_team',
  'q_special_revelation_team',
] as const

export type BonusQuestionId = (typeof BONUS_QUESTION_IDS)[number]
