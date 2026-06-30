import { BONUS_QUESTION_IDS } from '../data/questionIds'
import { maxMatchPoints, type KnockoutRoundId } from '../config/ruleset'
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

  const bonusCount = BONUS_QUESTION_IDS.length

  return (
    <div className="rules-points-tables">
      <PointsTable
        caption="1. Puntos por partido"
        headers={matchHeaders}
        rows={matchRows}
      />
      <p className="rules-points-hint">
        Cada acierto suma de forma independiente. La fila «Máximo posible» es el total si acertás ganador/empate
        y ambos goles. En eliminatorias, estos puntos solo aplican si el cruce oficial de esa llave coincide con el
        cruce que pronosticaste.
      </p>

      <h3>2. Bonus: goleador del partido</h3>
      <p className="rules-points-hint">
        Elegís un solo jugador por partido. Si anota, sumás puntos por cada gol en el encuentro (solo goles en los
        90 minutos o en el tiempo suplementario del mismo partido).
      </p>
      <PointsTable caption="Puntos por gol según ronda" headers={playerHeaders} rows={playerRows} />

      <PointsTable
        caption="3. Avance — equipos clasificados"
        headers={['Ronda de destino', 'Pts por eq.']}
        rows={advRows}
      />
      <p className="rules-points-hint">
        Si el cruce real cambia frente a tu bracket, esta es la unica puntuacion que podes sumar por esa seleccion.
      </p>
      <p className="rules-points-hint">
        Por cada selección que acertás que clasifica a esa fase, sumás los puntos indicados (acumulables).
      </p>

      <h3>4. Especiales — podio del torneo</h3>
      <ul>
        <li>
          Campeón: <strong>+{POINTS_CHAMPION}</strong> · Subcampeón: <strong>+{POINTS_RUNNER_UP}</strong> · Tercer
          puesto: <strong>+{POINTS_THIRD_PLACE}</strong>
        </li>
      </ul>

      <h3>5. Banco de preguntas extra</h3>
      <p className="rules-points-hint">
        Las <strong>{bonusCount}</strong> preguntas adicionales del banco, resueltas según publicaciones oficiales
        del torneo, otorgan <strong>+{POINTS_BONUS_QUESTION}</strong> puntos cada una acertada.
      </p>

      <h3>Premios individuales del torneo</h3>
      <ul>
        <li>
          <strong>Goleador del torneo (+{POINTS_TOP_SCORER} pts):</strong> se asignan los puntos a quienes
          eligieron a cualquiera de los ganadores del premio, incluso si hay empate en el liderato de goleo. No
          cuentan goles en tanda de penales.
        </li>
        <li>
          <strong>Mejor arquero (+{POINTS_BEST_GOALKEEPER_AVERAGE} pts):</strong> el guardameta debe haber jugado
          al menos 4 partidos completos. No se consideran goles recibidos en tandas de penales. Si hay empate en el
          promedio de goles recibidos, suman todos los que eligieron a cualquiera de los arqueros empatados en el
          primer lugar.
        </li>
      </ul>
    </div>
  )
}
