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
    predictedTeamAId: 'BRA',
    predictedTeamBId: 'CRO',
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
    predictedTeamAId: 'team_B',
    predictedTeamBId: 'team_C',
  }

  const detailsOverlap = scoreMatchPredictionDetails(
    matchBase,
    { goalsHome: 1, goalsAway: 2, wentToPenalties: false },
    overlapLineup,
  )
  assert.equal(detailsOverlap.exactScoreHit, false)
  assert.equal(detailsOverlap.points, 3, 'Solo goles de team_B acertados en R16')

  const matchFinal = {
    phase: 'knockout' as const,
    status: 'finished' as const,
    goalsHome: 1,
    goalsAway: 0,
    wentToPenalties: false,
    round: 'final',
    teamHomeId: 'CIV',
    teamAwayId: 'JOR',
  }

  const detailsPensWinner = scoreMatchPredictionDetails(
    matchFinal,
    {
      goalsHome: 0,
      goalsAway: 0,
      wentToPenalties: true,
      penaltiesWinnerHome: true,
    },
    { predictedTeamAId: 'CIV', predictedTeamBId: 'CZE' },
  )
  assert.equal(detailsPensWinner.winnerOrDrawHit, true)
  assert.equal(detailsPensWinner.points, 4, 'Ganador final por penales aunque el rival predicho difiera')

  const detailsPensAwayOnly = scoreMatchPredictionDetails(
    matchFinal,
    {
      goalsHome: 0,
      goalsAway: 0,
      wentToPenalties: true,
      penaltiesWinnerTeamB: true,
      penaltiesWinnerAway: true,
    },
    { predictedTeamAId: 'CIV', predictedTeamBId: 'CZE' },
  )
  assert.equal(detailsPensAwayOnly.winnerOrDrawHit, false)
  assert.equal(detailsPensAwayOnly.points, 0, 'Ganador visitante en penales no cuenta como local')

  console.log('scoringKoMismatch.test.ts: OK')
}

main()
