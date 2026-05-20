import { LANDING_BRACKET_FINAL_MATCH, TEAM_NAME_ES } from './landingDemoData'
import { parseBracketScore } from './parseBracketScore'

export type LandingBracketChampion = {
  teamId: string
  nameEs: string
}

export function getLandingBracketChampion(): LandingBracketChampion | null {
  const parsed = parseBracketScore(LANDING_BRACKET_FINAL_MATCH.score)
  if (parsed.winner === 'home') {
    return {
      teamId: LANDING_BRACKET_FINAL_MATCH.home,
      nameEs: TEAM_NAME_ES[LANDING_BRACKET_FINAL_MATCH.home] ?? LANDING_BRACKET_FINAL_MATCH.home,
    }
  }
  if (parsed.winner === 'away') {
    return {
      teamId: LANDING_BRACKET_FINAL_MATCH.away,
      nameEs: TEAM_NAME_ES[LANDING_BRACKET_FINAL_MATCH.away] ?? LANDING_BRACKET_FINAL_MATCH.away,
    }
  }
  return null
}
