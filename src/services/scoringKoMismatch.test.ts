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
  assert.equal(detailsWrongPair.points, 6, 'QF: ganador y gol de BRA suman por identidad')

  const matchMexCol = {
    phase: 'knockout' as const,
    status: 'finished' as const,
    goalsTeamA: 2,
    goalsTeamB: 0,
    wentToPenalties: false,
    round: 'r32',
    teamAId: 'MEX',
    teamBId: 'COL',
  }
  const detailsGoldenRule = scoreMatchPredictionDetails(
    matchMexCol,
    { goalsTeamA: 2, goalsTeamB: 0, wentToPenalties: false },
    { predictedTeamAId: 'MEX', predictedTeamBId: 'ECU' },
  )
  assert.equal(detailsGoldenRule.winnerOrDrawHit, true)
  assert.equal(detailsGoldenRule.goalsAHit, true)
  assert.equal(detailsGoldenRule.goalsBHit, false)
  assert.equal(detailsGoldenRule.exactScoreHit, false)
  assert.equal(
    detailsGoldenRule.points,
    4,
    'Regla de oro: MEX suma ganador y goles; ECU en otra llave solo suma avance, no este partido',
  )

  const detailsNoSharedTeam = scoreMatchPredictionDetails(
    matchMexCol,
    { goalsTeamA: 2, goalsTeamB: 0, wentToPenalties: false },
    { predictedTeamAId: 'CRO', predictedTeamBId: 'ECU' },
  )
  assert.equal(detailsNoSharedTeam.points, 0, 'Marcador parecido sin equipos en comun no suma partido KO')

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
    3,
    'Un solo rival en comun puede sumar goles parciales por identidad',
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
  assert.equal(detailsPensWinner.winnerOrDrawHit, true)
  assert.equal(detailsPensWinner.points, 4, 'Final: ganador CIV suma por identidad aunque cambie rival')

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
  assert.equal(detailsKorPartial.points, 2, 'R16: ganador KOR suma por identidad aunque cambie rival')

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
  assert.equal(detailsCivPens.points, 6, 'QF: ganador por penales y gol de CIV por identidad')

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
  assert.equal(detailsCivWrongRival.points, 3, 'Rival ausente no suma, pero CIV 0-0 si suma gol por identidad')

  const matchNedMar = {
    phase: 'knockout' as const,
    status: 'finished' as const,
    goalsTeamA: 1,
    goalsTeamB: 1,
    wentToPenalties: true,
    penaltiesWinnerTeamB: true,
    round: 'r32',
    teamAId: 'NED',
    teamBId: 'MAR',
  }
  const detailsNedMar = scoreMatchPredictionDetails(
    matchNedMar,
    { goalsTeamA: 2, goalsTeamB: 1, wentToPenalties: false },
    { predictedTeamAId: 'NED', predictedTeamBId: 'MAR' },
  )
  assert.equal(detailsNedMar.points, 3, 'R32 NED 2-1 MAR vs 1-1 pen MAR: suma gol de MAR')
  console.log('scoringKoMismatch.test.ts: OK')
}

main()
