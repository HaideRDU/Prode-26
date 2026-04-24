import { BONUS_QUESTION_IDS } from '../data/questionIds'
import {
  GROUP_EXACT_SCORE_POINTS,
  GROUP_WINNER_POINTS,
  KO_EXACT_SCORE_POINTS,
  KO_PENALTY_BONUS_POINTS,
  KO_WINNER_POINTS,
  POINTS_BONUS_QUESTION,
  POINTS_CHAMPION,
  POINTS_FOURTH_PLACE,
  POINTS_RUNNER_UP,
  POINTS_THIRD_PLACE,
  POINTS_TOP_SCORER,
} from '../services/scoring'

const bonusQuestionCount = BONUS_QUESTION_IDS.length

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
        <strong>Marcador exacto:</strong> mismo número de goles del local y del visita que el resultado
        oficial.
      </p>
      <h3 className="pred-rules-modal__subtitle">Puntos por partido</h3>
      <ul className="pred-rules-modal__list">
        <li>
          <strong>Fase de grupos:</strong> si acertás el desenlace (quién gana o si queda empatado según
          el resultado real), sumás <strong>+{GROUP_WINNER_POINTS}</strong> punto. Si además acertás el
          marcador exacto, en ese partido sumás <strong>+{GROUP_EXACT_SCORE_POINTS}</strong> puntos en total
          (no se suma primero +{GROUP_WINNER_POINTS} y después otros +{GROUP_EXACT_SCORE_POINTS}; el máximo
          por partido en grupos es <strong>{GROUP_EXACT_SCORE_POINTS}</strong> cuando pegás el marcador
          tal cual).
        </li>
        <li>
          <strong>Eliminatorias:</strong> si acertás el desenlace (ganador o empate resuelto según el
          resultado oficial, incluidos penales si aplica), sumás <strong>+{KO_WINNER_POINTS}</strong>{' '}
          puntos. Si además acertás el marcador exacto, sumás <strong>+{KO_EXACT_SCORE_POINTS}</strong>{' '}
          puntos en total por ese partido (no se acumulan por separado ganador y marcador). Si el partido
          oficial fue a penales y acertás empate en goles, que hubo penales y el ganador de la tanda,
          sumás <strong>+{KO_PENALTY_BONUS_POINTS}</strong> adicionales sobre el caso de marcador exacto con
          penales.
        </li>
      </ul>
      <h3 className="pred-rules-modal__subtitle">Podio y goleador (extras)</h3>
      <ul className="pred-rules-modal__list">
        <li>Campeón: <strong>+{POINTS_CHAMPION}</strong> puntos si acertás.</li>
        <li>Subcampeón: <strong>+{POINTS_RUNNER_UP}</strong> puntos.</li>
        <li>Tercer puesto: <strong>+{POINTS_THIRD_PLACE}</strong> puntos.</li>
        <li>Cuarto puesto: <strong>+{POINTS_FOURTH_PLACE}</strong> punto.</li>
        <li>Goleador del torneo: <strong>+{POINTS_TOP_SCORER}</strong> puntos.</li>
      </ul>
      <h3 className="pred-rules-modal__subtitle">Banco de preguntas extra</h3>
      <p className="app-muted" style={{ margin: 0 }}>
        Son <strong>{bonusQuestionCount}</strong> preguntas; cada una vale{' '}
        <strong>+{POINTS_BONUS_QUESTION}</strong> puntos si tu respuesta coincide con el resultado oficial
        publicado para esa pregunta.
      </p>
    </>
  )
}
