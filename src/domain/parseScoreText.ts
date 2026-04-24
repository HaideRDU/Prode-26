const MAX_GOALS = 20

/** Un solo campo de goles (inputs numéricos): vacío → null; entero 0…MAX_GOALS. */
export function parseGoalField(raw: string): number | null {
  const t = raw.trim()
  if (t === '') return null
  const n = Number(t)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > MAX_GOALS) return null
  return n
}

/**
 * Interpreta marcador tipo "2-1", "2 - 1", "  0-0 ".
 * @returns null si vacío o inválido
 */
export function parseScoreText(raw: string): { goalsHome: number; goalsAway: number } | null {
  const t = raw.trim()
  if (!t) return null
  const m = t.match(/^(\d+)\s*-\s*(\d+)$/)
  if (!m) return null
  const goalsHome = Number(m[1])
  const goalsAway = Number(m[2])
  if (!Number.isInteger(goalsHome) || !Number.isInteger(goalsAway)) return null
  if (goalsHome < 0 || goalsAway < 0 || goalsHome > MAX_GOALS || goalsAway > MAX_GOALS) return null
  return { goalsHome, goalsAway }
}

export function formatScorePair(goalsHome: number, goalsAway: number): string {
  return `${goalsHome}-${goalsAway}`
}
