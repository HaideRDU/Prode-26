/**
 * Franjas cerradas para preguntas tipo `kind: 'range'` (coinciden con resultado oficial en Firestore).
 * En la metodología actual de 5 preguntas no se usan rangos, pero se mantiene el contrato por compatibilidad.
 */

export const RANGE_OPTIONS_TOTAL_GOALS = [
  { rangeId: 'tg_pm_lt_1', labelEs: 'Menos de 104 goles en total (menos de 1 por partido de media)' },
  { rangeId: 'tg_pm_1_1_5', labelEs: 'Entre 104 y 156 goles (entre 1 y 1,5 por partido)' },
  { rangeId: 'tg_pm_1_5_2', labelEs: 'Entre 156 y 208 goles (entre 1,5 y 2 por partido)' },
  { rangeId: 'tg_pm_2_2_5', labelEs: 'Entre 208 y 260 goles (entre 2 y 2,5 por partido)' },
  { rangeId: 'tg_pm_2_5_3', labelEs: 'Entre 260 y 312 goles (entre 2,5 y 3 por partido)' },
  { rangeId: 'tg_pm_gt_3', labelEs: 'Más de 312 goles (más de 3 por partido de media)' },
] as const

export const RANGE_OPTIONS_PENALTIES_TOTAL = [
  { rangeId: 'pk_lt_20', labelEs: 'Menos de 20 penaltis señalados en el torneo' },
  { rangeId: 'pk_20_35', labelEs: 'Entre 20 y 35 penaltis' },
  { rangeId: 'pk_35_50', labelEs: 'Entre 35 y 50 penaltis' },
  { rangeId: 'pk_50_70', labelEs: 'Entre 50 y 70 penaltis' },
  { rangeId: 'pk_gt_70', labelEs: 'Más de 70 penaltis señalados' },
] as const

export const RANGE_OPTIONS_BY_QUESTION_ID: Partial<Record<string, readonly { rangeId: string; labelEs: string }[]>> =
  {}
