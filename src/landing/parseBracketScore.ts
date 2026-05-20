export type BracketScoreParsed = {
  homeGoals: string
  awayGoals: string
  winner: 'home' | 'away' | 'draw' | null
}

/** Convierte "2-1", "1-1" o "—" del demo del bracket. */
export function parseBracketScore(score: string): BracketScoreParsed {
  const raw = score.trim()
  if (!raw || raw === '—' || raw === '-' || raw === '–') {
    return { homeGoals: '—', awayGoals: '—', winner: null }
  }

  const m = raw.match(/^(\d+)\s*[-–]\s*(\d+)$/)
  if (!m) {
    return { homeGoals: raw, awayGoals: '', winner: null }
  }

  const home = Number(m[1])
  const away = Number(m[2])
  let winner: BracketScoreParsed['winner'] = null
  if (home > away) winner = 'home'
  else if (away > home) winner = 'away'
  else winner = 'draw'

  return { homeGoals: String(home), awayGoals: String(away), winner }
}
