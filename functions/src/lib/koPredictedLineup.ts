/**
 * Resuelve equipos predichos en un slot KO según el cuadro propagado del usuario.
 */
import type { MatchPredictionPayload, PredictionDoc } from './types/predictions'
import { propagateKoWinners, resolveKoMatchTeams } from './bracketResolve'
import { assignThirdsToR32Slots } from './assignThirdsGreedy'
import { computeGroupStandings, orderedGroupIds, topEightThirds } from './groupStandings'

function predictionGoalsTeamA(payload: MatchPredictionPayload): number {
  return payload.goalsTeamA ?? payload.goalsHome ?? 0
}

function predictionGoalsTeamB(payload: MatchPredictionPayload): number {
  return payload.goalsTeamB ?? payload.goalsAway ?? 0
}

export function parseWc26KoMatchNum(matchId: string): number | null {
  const m = /^wc26-ko-(\d+)$/.exec(matchId)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

export function getPredictedKoLineupForMatch(
  predictionsForUser: PredictionDoc[],
  matchId: string,
): { predictedTeamAId: string | null; predictedTeamBId: string | null } {
  const num = parseWc26KoMatchNum(matchId)
  if (num == null) return { predictedTeamAId: null, predictedTeamBId: null }

  const groupPredByMatchId = new Map<string, MatchPredictionPayload>()
  const koPredByMatchId = new Map<string, MatchPredictionPayload>()
  for (const pr of predictionsForUser) {
    if (pr.scope !== 'match' || !pr.matchId) continue
    const p = pr.payload as MatchPredictionPayload
    if (typeof predictionGoalsTeamA(p) !== 'number' || typeof predictionGoalsTeamB(p) !== 'number') continue
    if (pr.matchId.startsWith('wc26-ko-')) koPredByMatchId.set(pr.matchId, p)
    else groupPredByMatchId.set(pr.matchId, p)
  }

  const tablesByGroup = new Map<string, ReturnType<typeof computeGroupStandings>>()
  for (const g of orderedGroupIds()) {
    tablesByGroup.set(g, computeGroupStandings(g, groupPredByMatchId))
  }
  const thirds = topEightThirds(groupPredByMatchId)
  const thirdByMatchNum = assignThirdsToR32Slots(thirds)
  const winnerByMatchNum = propagateKoWinners(koPredByMatchId, tablesByGroup, thirdByMatchNum)
  const { teamAId, teamBId } = resolveKoMatchTeams(num, tablesByGroup, thirdByMatchNum, winnerByMatchNum)
  return { predictedTeamAId: teamAId, predictedTeamBId: teamBId }
}
