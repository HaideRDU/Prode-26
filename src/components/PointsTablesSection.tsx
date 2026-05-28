import { DEFAULT_RULESET, maxMatchPoints, type KnockoutRoundId } from '../config/ruleset'
import {
  ADVANCEMENT_POINTS,
  KO_EXACT_SCORE_BY_ROUND,
  MATCH_POINTS_BY_PHASE,
  PLAYER_GOALS_PER_GOAL_BY_ROUND,
  POINTS_BEST_GOALKEEPER_AVERAGE,
  POINTS_BONUS_QUESTION,
  POINTS_CHAMPION,
  POINTS_RUNNER_UP,
  POINTS_THIRD_PLACE,
  POINTS_TOP_SCORER,
} from '../services/scoring'

const KO_ROUND_LABEL: Record<KnockoutRoundId, string> = {
  r32: 'R32',
  r16: 'R16',
  qf: 'QF',
  sf: 'SF',
  third: '3.º',
  final: 'Fin',
}

const KO_ROUND_ORDER: KnockoutRoundId[] = ['r32', 'r16', 'qf', 'sf', 'third', 'final']

function PointsTable({
  caption,
  headers,
  rows,
}: {
  caption: string
  headers: string[]
  rows: (string | number)[][]
}) {
  return (
    <figure className="rules-points-table-wrap">
      <table className="rules-points-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

export function PointsTablesSection() {
  const gr = MATCH_POINTS_BY_PHASE.group
  const ko = MATCH_POINTS_BY_PHASE.knockout
  const ppg = PLAYER_GOALS_PER_GOAL_BY_ROUND

  const matchHeaders = ['Acierto', 'Gr', ...KO_ROUND_ORDER.map((r) => KO_ROUND_LABEL[r])]
  const matchRows: (string | number)[][] = [
    [
      'Ganador / empate',
      gr.winnerOrDraw,
      ...KO_ROUND_ORDER.map((r) => ko[r].winnerOrDraw),
    ],
    [
      'Goles Selección A',
      gr.goalsTeamA,
      ...KO_ROUND_ORDER.map((r) => ko[r].goalsTeamA),
    ],
    [
      'Goles Selección B',
      gr.goalsTeamB,
      ...KO_ROUND_ORDER.map((r) => ko[r].goalsTeamB),
    ],
    [
      'Máximo posible',
      maxMatchPoints(gr),
      ...KO_ROUND_ORDER.map((r) => KO_EXACT_SCORE_BY_ROUND[r]),
    ],
  ]

  const playerHeaders = ['Ronda', 'Gr', ...KO_ROUND_ORDER.map((r) => KO_ROUND_LABEL[r])]
  const playerRows: (string | number)[][] = [
    ['Puntos por gol', ppg.group, ...KO_ROUND_ORDER.map((r) => ppg[r])],
  ]

  const advRows: (string | number)[][] = [
    ['A dieciseisavos (R32)', ADVANCEMENT_POINTS.toR32],
    ['A octavos (R16)', ADVANCEMENT_POINTS.toR16],
    ['A cuartos (QF)', ADVANCEMENT_POINTS.toQf],
    ['A semifinales (SF)', ADVANCEMENT_POINTS.toSf],
    ['A la final', ADVANCEMENT_POINTS.toFinal],
  ]

  return (
    <div className="rules-points-tables">
      <PointsTable
        caption="1. Puntos por partido (aciertos independientes)"
        headers={matchHeaders}
        rows={matchRows}
      />
      <PointsTable caption="2. Goleador del partido (puntos por gol)" headers={playerHeaders} rows={playerRows} />
      <PointsTable
        caption="3. Avance — por selección que clasifica a la fase"
        headers={['Fase de destino', 'Pts']}
        rows={advRows}
      />
      <h3>4. Podio y especiales</h3>
      <ul>
        <li>
          Campeón: <strong>{POINTS_CHAMPION}</strong> · Subcampeón: <strong>{POINTS_RUNNER_UP}</strong> · Tercer
          puesto: <strong>{POINTS_THIRD_PLACE}</strong>
        </li>
        <li>
          Goleador del torneo: <strong>{POINTS_TOP_SCORER}</strong> · Mejor arquero:{' '}
          <strong>{POINTS_BEST_GOALKEEPER_AVERAGE}</strong>
        </li>
        <li>
          Cada acierto en preguntas del banco: <strong>{POINTS_BONUS_QUESTION}</strong>
        </li>
      </ul>
      <p className="app-muted rules-points-note">
        Cierre general: {DEFAULT_RULESET.lockWindows.generalPredictionsHoursBeforeTournament / 24} días antes del
        inicio. Goleador por partido: 11:59 p. m. del día anterior (hora {DEFAULT_RULESET.timezone}).
      </p>
    </div>
  )
}
