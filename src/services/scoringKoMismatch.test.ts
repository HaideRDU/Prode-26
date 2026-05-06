/**
 * Ejecutar: npx tsx src/services/scoringKoMismatch.test.ts
 */
import assert from 'node:assert/strict'
import {
  KO_ONE_SCORE_POINTS,
  KO_WINNER_POINTS,
  scoreMatchPredictionDetails,
} from './scoring'

function main() {
  const matchBase = {
    phase: 'knockout' as const,
    status: 'finished' as const,
    goalsHome: 2,
    goalsAway: 1,
    wentToPenalties: false,
    penaltiesWinnerHome: undefined as boolean | undefined,
    round: 'r16',
    teamHomeId: 'team_A',
    teamAwayId: 'team_B',
  }

  const wrongLineup = {
    predictedHomeId: 'team_C',
    predictedAwayId: 'team_D',
  }

  const detailsWrongPair = scoreMatchPredictionDetails(
    matchBase,
    { goalsHome: 2, goalsAway: 1, wentToPenalties: false },
    wrongLineup,
  )
  assert.equal(detailsWrongPair.exactScoreHit, false)
  assert.equal(detailsWrongPair.points, KO_WINNER_POINTS)

  const overlapLineup = {
    predictedHomeId: 'team_B',
    predictedAwayId: 'team_C',
  }

  const detailsOverlap = scoreMatchPredictionDetails(
    matchBase,
    { goalsHome: 1, goalsAway: 2, wentToPenalties: false },
    overlapLineup,
  )
  assert.equal(detailsOverlap.exactScoreHit, false)
  assert.equal(detailsOverlap.points, KO_ONE_SCORE_POINTS)

  console.log('scoringKoMismatch.test.ts: OK')
}

main()
