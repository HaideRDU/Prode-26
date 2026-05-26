import {
  GROUP_EXACT_SCORE_POINTS,
  GROUP_ONE_SCORE_POINTS,
  GROUP_WINNER_POINTS,
  KO_ONE_SCORE_POINTS,
  KO_WINNER_POINTS,
  POINTS_BEST_GOALKEEPER_AVERAGE,
  POINTS_BONUS_QUESTION,
  POINTS_CHAMPION,
  POINTS_RUNNER_UP,
  POINTS_THIRD_PLACE,
  POINTS_TOP_SCORER,
} from '../services/scoring'

/**
 * Texto de ayuda alineado con el motor en scoring.ts.
 * `variant`: solo puntajes o incluir nota sobre cuándo suman los partidos.
 */
export function PredictionScoringHelpBody({
  variant = 'scores',
}: {
  variant?: 'scores' | 'scoresWithWhenNote'
}) {
  return (
    <>
      {variant === 'scoresWithWhenNote' ? (
        <p className="app-muted pred-rules-modal__note" style={{ marginBottom: 10 }}>
          Los puntos de partido se suman cuando el partido figure como finalizado en la base de datos y
          exista resultado oficial.
        </p>
      ) : null}
      <p className="app-muted" style={{ marginBottom: 10 }}>
        <strong>Marcador exacto:</strong> mismo número de goles del Equipo A y del Equipo B que el resultado
        oficial.
      </p>
      <h3 className="pred-rules-modal__subtitle">Puntos por partido</h3>
      <ul className="pred-rules-modal__list">
        <li>
          <strong>Fase de grupos:</strong> marcador exacto (Equipo A y Equipo B) vale{' '}
          <strong>+{GROUP_EXACT_SCORE_POINTS}</strong>. Si no hay exacto, acertar uno de los dos marcadores
          suma <strong>+{GROUP_ONE_SCORE_POINTS}</strong> y acertar ganador/empate suma{' '}
          <strong>+{GROUP_WINNER_POINTS}</strong>.
        </li>
        <li>
          <strong>Eliminatorias (90 minutos):</strong> marcador exacto suma según ronda (R32=6, R16=7,
          QF=8, SF=10, 3er puesto=9, final=12). Si no hay exacto, acertar un marcador suma{' '}
          <strong>+{KO_ONE_SCORE_POINTS}</strong> y acertar ganador/empate suma{' '}
          <strong>+{KO_WINNER_POINTS}</strong>.
        </li>
      </ul>
      <h3 className="pred-rules-modal__subtitle">Avance y especiales</h3>
      <ul className="pred-rules-modal__list">
        <li>Campeón: <strong>+{POINTS_CHAMPION}</strong> puntos si acertás.</li>
        <li>Subcampeón: <strong>+{POINTS_RUNNER_UP}</strong> puntos.</li>
        <li>Tercer puesto: <strong>+{POINTS_THIRD_PLACE}</strong> puntos.</li>
        <li>Goleador del torneo: <strong>+{POINTS_TOP_SCORER}</strong> puntos.</li>
        <li>Arquero con mejor promedio de goles recibidos: <strong>+{POINTS_BEST_GOALKEEPER_AVERAGE}</strong> puntos.</li>
      </ul>
      <h3 className="pred-rules-modal__subtitle">Banco de preguntas extra</h3>
      <p className="app-muted" style={{ margin: 0 }}>
        Cada pregunta extra acertada vale <strong>+{POINTS_BONUS_QUESTION}</strong> puntos si tu respuesta
        coincide con el resultado oficial publicado para esa pregunta.
      </p>
    </>
  )
}
