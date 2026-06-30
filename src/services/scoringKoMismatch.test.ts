/**
 * Ejecutar: npm run test:scoring-ko
 */
import assert from 'node:assert/strict'
import { scoreMatchPredictionDetails } from './scoring'

function main() {
  const matchQf = {
    phase: 'knockout' as const,
    status: 'finished' as const,
    goalsTeamA: 2,
    goalsTeamB: 1,
    wentToPenalties: false,
    round: 'qf',
    teamAId: 'BRA',
    teamBId: 'BEL',
  }

  const wrongLineup = {
    predictedTeamAId: 'BRA',
    predictedTeamBId: 'CRO',
  }

  const detailsWrongPair = scoreMatchPredictionDetails(
    matchQf,
    { goalsTeamA: 2, goalsTeamB: 1, wentToPenalties: false },
    wrongLineup,
  )
  assert.equal(detailsWrongPair.exactScoreHit, false)
  assert.equal(detailsWrongPair.points, 0, 'Cruce distinto en QF: sin puntos de partido')

  const matchSwapped = {
    ...matchQf,
    goalsTeamA: 1,
    goalsTeamB: 2,
    teamAId: 'CRO',
    teamBId: 'BRA',
  }

  const detailsSwapped = scoreMatchPredictionDetails(
    matchSwapped,
    { goalsTeamA: 2, goalsTeamB: 1, wentToPenalties: false },
    wrongLineup,
  )
  assert.equal(detailsSwapped.exactScoreHit, true)
  assert.equal(detailsSwapped.points, 9, 'Máximo QF: 3+3+3')

  const matchBase = {
    phase: 'knockout' as const,
    status: 'finished' as const,
    goalsTeamA: 2,
    goalsTeamB: 1,
    wentToPenalties: false,
    round: 'r16',
    teamAId: 'team_A',
    teamBId: 'team_B',
  }

  const overlapLineup = {
    predictedTeamAId: 'team_B',
    predictedTeamBId: 'team_C',
  }

  const detailsOverlap = scoreMatchPredictionDetails(
    matchBase,
    { goalsTeamA: 1, goalsTeamB: 2, wentToPenalties: false },
    overlapLineup,
  )
  assert.equal(detailsOverlap.exactScoreHit, false)
  assert.equal(
    detailsOverlap.points,
    0,
    'Un solo rival en común no alcanza: sin ganador acertado ni goles parciales',
  )

  const matchFinal = {
    phase: 'knockout' as const,
    status: 'finished' as const,
    goalsTeamA: 1,
    goalsTeamB: 0,
    wentToPenalties: false,
    round: 'final',
    teamAId: 'CIV',
    teamBId: 'JOR',
  }

  const detailsPensWinner = scoreMatchPredictionDetails(
    matchFinal,
    {
      goalsTeamA: 0,
      goalsTeamB: 0,
      wentToPenalties: true,
      penaltiesWinnerTeamA: true,
    },
    { predictedTeamAId: 'CIV', predictedTeamBId: 'CZE' },
  )
  assert.equal(detailsPensWinner.winnerOrDrawHit, false)
  assert.equal(detailsPensWinner.points, 0, 'Final con rival distinto: sin puntos de partido')

  const detailsPensAwayOnly = scoreMatchPredictionDetails(
    matchFinal,
    {
      goalsTeamA: 0,
      goalsTeamB: 0,
      wentToPenalties: true,
      penaltiesWinnerTeamB: true,
    },
    { predictedTeamAId: 'CIV', predictedTeamBId: 'CZE' },
  )
  assert.equal(detailsPensAwayOnly.winnerOrDrawHit, false)
  assert.equal(detailsPensAwayOnly.points, 0, 'Ganador visitante en penales no cuenta como local')

  const matchKorUzb = {
    phase: 'knockout' as const,
    status: 'finished' as const,
    goalsTeamA: 3,
    goalsTeamB: 0,
    wentToPenalties: false,
    round: 'r16',
    teamAId: 'KOR',
    teamBId: 'UZB',
  }
  const detailsKorPartial = scoreMatchPredictionDetails(
    matchKorUzb,
    { goalsTeamA: 1, goalsTeamB: 0, wentToPenalties: false },
    { predictedTeamAId: 'KOR', predictedTeamBId: 'OTHER' },
  )
  assert.equal(detailsKorPartial.points, 0, 'R16 con rival distinto: sin puntos de partido')

  const matchCivJpn = {
    phase: 'knockout' as const,
    status: 'finished' as const,
    goalsTeamA: 0,
    goalsTeamB: 3,
    wentToPenalties: false,
    round: 'qf',
    teamAId: 'CIV',
    teamBId: 'JPN',
  }
  const detailsCivPens = scoreMatchPredictionDetails(
    matchCivJpn,
    {
      goalsTeamA: 0,
      goalsTeamB: 0,
      wentToPenalties: true,
      penaltiesWinnerTeamB: true,
    },
    { predictedTeamAId: 'CIV', predictedTeamBId: 'JPN' },
  )
  assert.equal(detailsCivPens.points, 3, 'QF: solo ganador por penales (3), sin gol 0=0 si el oficial fue 0-3')

  const detailsCivWrongRival = scoreMatchPredictionDetails(
    matchCivJpn,
    {
      goalsTeamA: 0,
      goalsTeamB: 0,
      wentToPenalties: true,
      penaltiesWinnerTeamB: true,
    },
    { predictedTeamAId: 'CIV', predictedTeamBId: 'CZE' },
  )
  assert.equal(detailsCivWrongRival.points, 0, 'Penales al rival predicho (CZE) no cuenta si ganó Japón')

  console.log('scoringKoMismatch.test.ts: OK')
}

main()
