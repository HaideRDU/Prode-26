import { GROUP_STAGE_SCHEDULE } from '../../src/data/wc2026/groupStageSchedule.ts'
import { penaltiesWinnerFlagsForTeamA } from '../../src/domain/matchPenalties.ts'
import type { MatchPredictionPayload } from '../../src/types/predictions.ts'

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randBool(): boolean {
  return Math.random() < 0.5
}

export function randomGroupPayload(): MatchPredictionPayload {
  const goalsTeamA = randInt(0, 4)
  const goalsTeamB = randInt(0, 4)
  return { goalsTeamA, goalsTeamB }
}

/** Marcador de grupo donde gana el equipo indicado (slot A o B en el fixture). */
export function groupPayloadWinner(
  teamAId: string,
  teamBId: string,
  winnerId: string,
): MatchPredictionPayload {
  const teamAWins = winnerId === teamAId
  if (teamAWins && winnerId !== teamBId) {
    const goalsTeamA = randInt(2, 4)
    const goalsTeamB = randInt(0, 1)
    return { goalsTeamA, goalsTeamB }
  }
  if (!teamAWins && winnerId === teamBId) {
    const goalsTeamA = randInt(0, 1)
    const goalsTeamB = randInt(2, 4)
    return { goalsTeamA, goalsTeamB }
  }
  return randomGroupPayload()
}

export function randomKnockoutPayload(): MatchPredictionPayload {
  const goalsTeamA = randInt(0, 4)
  const goalsTeamB = randInt(0, 4)
  const draw = goalsTeamA === goalsTeamB
  return {
    goalsTeamA,
    goalsTeamB,
    wentToPenalties: draw,
    ...(draw ? penaltiesWinnerFlagsForTeamA(randBool()) : {}),
  }
}

/** Marcador KO con ganador fijo (sin empate). */
export function koPayloadWinner(teamAId: string, teamBId: string, winnerId: string): MatchPredictionPayload {
  if (winnerId === teamAId) {
    const goalsTeamA = randInt(1, 3)
    const goalsTeamB = randInt(0, goalsTeamA - 1)
    return { goalsTeamA, goalsTeamB, wentToPenalties: false }
  }
  if (winnerId === teamBId) {
    const goalsTeamB = randInt(1, 3)
    const goalsTeamA = randInt(0, goalsTeamB - 1)
    return { goalsTeamA, goalsTeamB, wentToPenalties: false }
  }
  return randomKnockoutPayload()
}

export function buildGroupPredictionsForChampion(championId: string): Map<string, MatchPredictionPayload> {
  return buildGroupPredictionsForFavorites([championId])
}

export function buildGroupPredictionsForFavorites(
  favoriteTeamIds: readonly string[],
): Map<string, MatchPredictionPayload> {
  const favorites = new Set(favoriteTeamIds)
  const out = new Map<string, MatchPredictionPayload>()
  for (const row of GROUP_STAGE_SCHEDULE) {
    const homeFav = favorites.has(row.teamHomeId)
    const awayFav = favorites.has(row.teamAwayId)
    if (homeFav && awayFav) {
      out.set(row.matchId, groupPayloadWinner(row.teamHomeId, row.teamAwayId, row.teamHomeId))
    } else if (homeFav) {
      out.set(row.matchId, groupPayloadWinner(row.teamHomeId, row.teamAwayId, row.teamHomeId))
    } else if (awayFav) {
      out.set(row.matchId, groupPayloadWinner(row.teamHomeId, row.teamAwayId, row.teamAwayId))
    } else {
      out.set(row.matchId, randomGroupPayload())
    }
  }
  return out
}

const FINAL_MATCH_NUM = 104

export function koPayloadDrawPenaltiesWinner(
  teamAId: string,
  teamBId: string,
  winnerId: string,
): MatchPredictionPayload {
  const winnerIsTeamA = winnerId === teamAId
  return {
    goalsTeamA: 0,
    goalsTeamB: 0,
    wentToPenalties: true,
    ...penaltiesWinnerFlagsForTeamA(winnerIsTeamA),
  }
}

export function koPayloadForPodiumSlot(args: {
  matchNum: number
  homeId: string
  awayId: string
  championId: string
  runnerUpId: string
}): MatchPredictionPayload {
  const { matchNum, homeId, awayId, championId, runnerUpId } = args
  const hasChampion = homeId === championId || awayId === championId
  const hasRunnerUp = homeId === runnerUpId || awayId === runnerUpId

  if (hasChampion && hasRunnerUp) {
    return koPayloadDrawPenaltiesWinner(homeId, awayId, championId)
  }
  if (hasChampion) {
    return koPayloadWinner(homeId, awayId, championId)
  }
  if (hasRunnerUp && matchNum !== FINAL_MATCH_NUM) {
    return koPayloadWinner(homeId, awayId, runnerUpId)
  }
  return randomKnockoutPayload()
}
