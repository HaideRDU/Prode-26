import {
  LANDING_BRACKET_FINAL_MATCH,
  LANDING_BRACKET_THIRD_MATCH,
  TEAM_NAME_ES,
} from './landingDemoData'
import { parseBracketScore } from './parseBracketScore'

export type LandingPodiumSlot = {
  place: 1 | 2 | 3
  teamId: string | null
  nameEs: string
}

function teamLabel(teamId: string): string {
  return TEAM_NAME_ES[teamId] ?? teamId
}

function winnerTeamId(match: { home: string; away: string; score: string }): string | null {
  const parsed = parseBracketScore(match.score)
  if (parsed.winner === 'home') return match.home
  if (parsed.winner === 'away') return match.away
  return null
}

/** Orden visual del podio: 2.º · 1.º · 3.er */
export function getLandingPodiumSlots(): LandingPodiumSlot[] {
  const championId = winnerTeamId(LANDING_BRACKET_FINAL_MATCH)
  const runnerUpId =
    championId === LANDING_BRACKET_FINAL_MATCH.home
      ? LANDING_BRACKET_FINAL_MATCH.away
      : championId === LANDING_BRACKET_FINAL_MATCH.away
        ? LANDING_BRACKET_FINAL_MATCH.home
        : null

  const thirdId = winnerTeamId(LANDING_BRACKET_THIRD_MATCH)

  const champion: LandingPodiumSlot = {
    place: 1,
    teamId: championId,
    nameEs: championId ? teamLabel(championId) : 'Por definir',
  }

  const runnerUp: LandingPodiumSlot = {
    place: 2,
    teamId: runnerUpId,
    nameEs: runnerUpId ? teamLabel(runnerUpId) : 'Por definir',
  }

  const third: LandingPodiumSlot = {
    place: 3,
    teamId: thirdId,
    nameEs: thirdId != null ? teamLabel(thirdId) : 'Por definir',
  }

  return [runnerUp, champion, third]
}
