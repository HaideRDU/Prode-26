import { DEFAULT_RULESET } from '../config/ruleset'
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

export function ReglamentoPage() {
  return (
    <section>
      <div className="rules-page-card">
        <h1 className="app-page-title">Reglamento</h1>
        <p className="auth-lead" style={{ textAlign: 'left' }}>
          Versión activa: <strong>{DEFAULT_RULESET.versionLabel}</strong>
        </p>

        <h2>Fechas límite</h2>
        <ul>
          <li>
            Predicciones generales: se bloquean{' '}
            <strong>{DEFAULT_RULESET.lockWindows.generalPredictionsHoursBeforeTournament / 24} días</strong>{' '}
            antes del inicio del torneo.
          </li>
          <li>
            Dinámica KO por partido: cierre <strong>1 hora</strong> antes del inicio de cada encuentro.
          </li>
        </ul>

        <h2>Puntos por partido</h2>
        <ul>
          <li>
            Grupos: exacto <strong>{GROUP_EXACT_SCORE_POINTS}</strong>, un marcador{' '}
            <strong>{GROUP_ONE_SCORE_POINTS}</strong>, ganador/empate <strong>{GROUP_WINNER_POINTS}</strong>.
          </li>
          <li>
            KO (90 minutos): exacto por ronda (R32=6, R16=7, QF=8, SF=10, 3er puesto=9, final=12).
          </li>
          <li>
            KO sin exacto: un marcador <strong>{KO_ONE_SCORE_POINTS}</strong>, ganador/empate{' '}
            <strong>{KO_WINNER_POINTS}</strong>.
          </li>
        </ul>

        <h2>Avance y especiales</h2>
        <ul>
          <li>Campeón: <strong>{POINTS_CHAMPION}</strong></li>
          <li>Subcampeón: <strong>{POINTS_RUNNER_UP}</strong></li>
          <li>Tercer puesto: <strong>{POINTS_THIRD_PLACE}</strong></li>
          <li>Goleador: <strong>{POINTS_TOP_SCORER}</strong></li>
          <li>Arquero mejor promedio: <strong>{POINTS_BEST_GOALKEEPER_AVERAGE}</strong></li>
          <li>Cada pregunta especial del banco: <strong>{POINTS_BONUS_QUESTION}</strong></li>
        </ul>

        <h2>Desempates</h2>
        <ol>
          <li>Mayor cantidad de marcadores exactos.</li>
          <li>Mayor cantidad de aciertos en preguntas especiales.</li>
          <li>Acierto del campeón.</li>
          <li>Sorteo manual (si persiste).</li>
        </ol>
      </div>
    </section>
  )
}
