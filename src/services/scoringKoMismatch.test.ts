/**
 * Ejecutar: npm run test:scoring-ko
 */
import assert from 'node:assert/strict'
import { scoreMatchPredictionDetails } from './scoring'

function main() {
  const matchQf = {
    phase: 'knockout' as const,
    status: 'finished' as const,
    goalsHome: 2,
    goalsAway: 1,
    wentToPenalties: false,
    penaltiesWinnerHome: undefined as boolean | undefined,
    round: 'qf',
    teamHomeId: 'BRA',
    teamAwayId: 'BEL',
  }

  const wrongLineup = {
    predictedHomeId: 'BRA',
    predictedAwayId: 'CRO',
  }

  const detailsWrongPair = scoreMatchPredictionDetails(
    matchQf,
    { goalsHome: 2, goalsAway: 1, wentToPenalties: false },
    wrongLineup,
  )
  assert.equal(detailsWrongPair.exactScoreHit, false)
  assert.equal(detailsWrongPair.points, 6, 'Ganador QF (3) + goles Brasil (3)')

  const matchSwapped = {
    ...matchQf,
    goalsHome: 1,
    goalsAway: 2,
    teamHomeId: 'CRO',
    teamAwayId: 'BRA',
  }

  const detailsSwapped = scoreMatchPredictionDetails(
    matchSwapped,
    { goalsHome: 2, goalsAway: 1, wentToPenalties: false },
    wrongLineup,
  )
  assert.equal(detailsSwapped.exactScoreHit, true)
  assert.equal(detailsSwapped.points, 9, 'Máximo QF: 3+3+3')

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
  assert.equal(detailsOverlap.points, 3, 'Solo goles de team_B acertados en R16')

  console.log('scoringKoMismatch.test.ts: OK')
}

main()
