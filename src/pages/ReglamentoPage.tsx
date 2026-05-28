import { PointsTablesSection } from '../components/PointsTablesSection'
import { DEFAULT_RULESET } from '../config/ruleset'
import { getGeneralPredictionsLockAt } from '../config/ruleset'

export function ReglamentoPage() {
  const openH = DEFAULT_RULESET.lockWindows.playerPerMatchOpensHoursBeforeKickoff
  const generalLockDays = DEFAULT_RULESET.lockWindows.generalPredictionsHoursBeforeTournament / 24
  const lockAt = getGeneralPredictionsLockAt()

  return (
    <div>
      <div className="rules-page-card">
        <h1 className="app-page-title">Reglamento</h1>

        <h2>Fechas límite</h2>
        <ul>
          <li>
            Predicciones generales (grupos, llaves, podio, especiales): cierre irrevocable{' '}
            <strong>{generalLockDays} días</strong> antes del pitido inicial (
            {lockAt.toLocaleString('es-CO', { timeZone: DEFAULT_RULESET.timezone })}).
          </li>
          <li>
            Goleador por partido: ventana desde <strong>{openH} horas</strong> antes del pitazo hasta{' '}
            <strong>11:59 p. m. del día anterior</strong> al partido (zona horaria del torneo:{' '}
            {DEFAULT_RULESET.timezone}).
          </li>
        </ul>

        <h2>Sistema de puntajes</h2>
        <p>
          Los puntos por partido se suman por cada tipo de acierto (ganador/empate, goles Selección A, goles
          Selección B). En eliminatorias, los goles se evalúan por identidad del equipo (regla de oro): si
          pronosticaste a un rival distinto al real, no sumas por sus goles aunque el marcador coincida.
        </p>

        <PointsTablesSection />

        <h2>Desempates</h2>
        <ol>
          <li>Mayor cantidad de marcadores exactos.</li>
          <li>Mayor cantidad de aciertos en preguntas especiales.</li>
          <li>Acierto del campeón.</li>
          <li>Sorteo manual (si persiste el empate).</li>
        </ol>
      </div>
    </div>
  )
}
