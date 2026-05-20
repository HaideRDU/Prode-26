import { assignRanks } from '../services/aggregateScores'
import type { StandingRow } from '../services/standingsService'

/** Recalcula el puesto visible según puntos y desempate (por si Firestore trae rank desactualizado). */
export function applyDisplayRanks(rows: StandingRow[]): StandingRow[] {
  if (rows.length === 0) return rows

  const scores = new Map<
    string,
    {
      points: number
      breakdown: {
        matchPoints: number
        tournamentPoints: number
        advancementPoints: number
        specialsPoints: number
      }
      tieBreak: {
        exactScoreHits: number
        specialQuestionHits: number
        championHit: boolean
      }
    }
  >()

  for (const row of rows) {
    scores.set(row.userId, {
      points: row.points,
      breakdown: {
        matchPoints: row.breakdown?.matchPoints ?? 0,
        tournamentPoints: row.breakdown?.tournamentPoints ?? 0,
        advancementPoints: row.breakdown?.advancementPoints ?? 0,
        specialsPoints: row.breakdown?.specialsPoints ?? 0,
      },
      tieBreak: {
        exactScoreHits: row.tieBreak?.exactScoreHits ?? 0,
        specialQuestionHits: row.tieBreak?.specialQuestionHits ?? 0,
        championHit: row.tieBreak?.championHit ?? false,
      },
    })
  }

  const ranked = assignRanks(scores)
  return rows.map((row) => ({
    ...row,
    rank: ranked.get(row.userId)?.rank ?? row.rank,
  }))
}

/** Compara con el snapshot anterior y devuelve cuántos puestos subió/bajó cada jugador. */
export function applyRankMovementFromPrevious(
  rows: StandingRow[],
  previousRanks: Record<string, number>,
): StandingRow[] {
  return rows.map((row) => {
    const prevRank = previousRanks[row.userId]
    const rankDelta =
      typeof prevRank === 'number' && Number.isFinite(row.rank) ? prevRank - row.rank : 0
    return { ...row, rankDelta }
  })
}
