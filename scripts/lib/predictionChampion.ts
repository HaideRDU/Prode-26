import { GROUP_STAGE_SCHEDULE } from '../../src/data/wc2026/groupStageSchedule.ts'
import type { MatchPredictionPayload } from '../../src/types/predictions.ts'

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randBool(): boolean {
  return Math.random() < 0.5
}

export function randomGroupPayload(): MatchPredictionPayload {
  const goalsA = randInt(0, 4)
  const goalsB = randInt(0, 4)
  return {
    goalsHome: goalsA,
    goalsAway: goalsB,
    goalsTeamA: goalsA,
    goalsTeamB: goalsB,
  }
}

/** Marcador de grupo donde gana el equipo indicado (local o visitante en el fixture). */
export function groupPayloadWinner(
  teamHomeId: string,
  teamAwayId: string,
  winnerId: string,
): MatchPredictionPayload {
  const homeWins = winnerId === teamHomeId
  if (homeWins && winnerId !== teamAwayId) {
    const gh = randInt(2, 4)
    const ga = randInt(0, 1)
    return { goalsHome: gh, goalsAway: ga, goalsTeamA: gh, goalsTeamB: ga }
  }
  if (!homeWins && winnerId === teamAwayId) {
    const gh = randInt(0, 1)
    const ga = randInt(2, 4)
    return { goalsHome: gh, goalsAway: ga, goalsTeamA: gh, goalsTeamB: ga }
  }
  return randomGroupPayload()
}

export function randomKnockoutPayload(): MatchPredictionPayload {
  const goalsA = randInt(0, 4)
  const goalsB = randInt(0, 4)
  const draw = goalsA === goalsB
  return {
    goalsHome: goalsA,
    goalsAway: goalsB,
    goalsTeamA: goalsA,
    goalsTeamB: goalsB,
    wentToPenalties: draw,
    ...(draw
      ? {
          penaltiesWinnerHome: randBool(),
          penaltiesWinnerTeamA: randBool(),
        }
      : {}),
  }
}

/** Marcador KO con ganador fijo (sin empate). */
export function koPayloadWinner(homeId: string, awayId: string, winnerId: string): MatchPredictionPayload {
  if (winnerId === homeId) {
    const gh = randInt(1, 3)
    const ga = randInt(0, gh - 1)
    return { goalsHome: gh, goalsAway: ga, goalsTeamA: gh, goalsTeamB: ga, wentToPenalties: false }
  }
  if (winnerId === awayId) {
    const ga = randInt(1, 3)
    const gh = randInt(0, ga - 1)
    return { goalsHome: gh, goalsAway: ga, goalsTeamA: gh, goalsTeamB: ga, wentToPenalties: false }
  }
  return randomKnockoutPayload()
}

/** Predicciones de fase de grupos: el campeón gana todos sus partidos; el resto al azar. */
export function buildGroupPredictionsForChampion(championId: string): Map<string, MatchPredictionPayload> {
  const out = new Map<string, MatchPredictionPayload>()
  for (const row of GROUP_STAGE_SCHEDULE) {
    if (row.teamHomeId === championId || row.teamAwayId === championId) {
      out.set(row.matchId, groupPayloadWinner(row.teamHomeId, row.teamAwayId, championId))
    } else {
      out.set(row.matchId, randomGroupPayload())
    }
  }
  return out
}
