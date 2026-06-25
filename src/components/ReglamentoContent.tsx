import { PointsTablesSection } from './PointsTablesSection'
import { DEFAULT_RULESET, getGeneralPredictionsLockAt } from '../config/ruleset'

type ReglamentoContentProps = {
  showPageTitle?: boolean
}

/** Reglamento oficial WC2026 — misma fuente en `/reglamento` (público) y menú Reglamento (app). */
export function ReglamentoContent({ showPageTitle = true }: ReglamentoContentProps) {
  const openH = DEFAULT_RULESET.lockWindows.playerPerMatchOpensHoursBeforeKickoff
  const lockAt = getGeneralPredictionsLockAt()
  const generalLockLabel = lockAt.toLocaleString('es-CO', {
    timeZone: DEFAULT_RULESET.timezone,
    dateStyle: 'long',
    timeStyle: 'short',
  })
  return (
    <>
      {showPageTitle ? <h1 className="app-page-title">Reglamento</h1> : null}

      <p className="rules-lead">
        Sistema de predicciones y puntos — Copa Mundial de la FIFA 2026. Reglamento oficial y estructura de
        puntuación.
      </p>

      <h2>Fechas límite</h2>
      <ul>
        <li>
          <strong>Plazo general:</strong> predicciones principales (grupos, llaves, podio, especiales) se cierran
          de forma irrevocable el <strong>{generalLockLabel}</strong> (zona {DEFAULT_RULESET.timezone}). Pasado ese
          momento no podés modificarlas.
        </li>
        <li>
          Los puntos se cargan automáticamente al finalizar cada encuentro según el resultado oficial de los{' '}
          <strong>90 minutos reglamentarios</strong> (no incluye tiempos suplementarios ni tandas de penales para
          el marcador del partido).
        </li>
        <li>
          <strong>Goleador por partido (bonus):</strong> podés elegir un jugador desde{' '}
          <strong>{openH} horas</strong> antes del pitazo; el cierre es independiente por partido,{' '}
          <strong>1 hora antes del inicio oficial</strong> (zona {DEFAULT_RULESET.timezone}).
        </li>
      </ul>

      <h2>Sistema de puntajes</h2>
      <p>
        En cada partido, los puntos se suman por cada tipo de acierto de forma independiente (ganador/empate,
        goles Selección A, goles Selección B). Si acertás el resultado exacto del encuentro, obtenés el máximo
        posible de esa ronda.
      </p>

      <PointsTablesSection />

      <section className="rules-detail-block" aria-labelledby="rules-golden-title">
        <h2 id="rules-golden-title">Regla de oro en eliminatorias</h2>
        <p>
          Para sumar por goles de una selección en fases eliminatorias (R32 en adelante), la selección real debe
          coincidir con la de tu pronóstico. Los goles se evalúan por <strong>identidad del equipo</strong>, sin
          importar si en el partido real juega como Selección A o Selección B.
        </p>
        <div className="rules-example">
          <p>
            <strong>Ejemplo 1 (cambio de rival):</strong> En cuartos, pronosticaste Brasil 2 – 1 Croacia. El
            partido real fue Brasil 2 – 1 Bélgica. Sumás por ganador (+3 en QF) y goles de Brasil;{' '}
            <strong>0 pts</strong> en goles de la Selección B porque pronosticaste a Croacia y jugó Bélgica (aunque
            el marcador de goles coincida).
          </p>
          <p>
            <strong>Ejemplo 2 (inversión de localía):</strong> Pronosticaste Brasil 2 – 1 Croacia. El partido
            real fue Croacia 1 – 2 Brasil. Sumás ganador y goles de ambas selecciones: coinciden equipos y goles →
            máximo posible de la ronda, sin importar el orden en el marcador.
          </p>
        </div>
      </section>

      <section className="rules-detail-block" aria-labelledby="rules-glossary-title">
        <h2 id="rules-glossary-title">Glosario de rondas</h2>
        <p className="rules-glossary">
          <strong>Gr</strong> Fase de grupos · <strong>R32</strong> Dieciseisavos · <strong>R16</strong> Octavos ·{' '}
          <strong>QF</strong> Cuartos · <strong>SF</strong> Semifinal · <strong>3.º</strong> Tercer puesto ·{' '}
          <strong>Fin</strong> Gran final
        </p>
      </section>

      <h2>Desempates</h2>
      <ol>
        <li>Mayor cantidad de marcadores exactos.</li>
        <li>Mayor cantidad de aciertos en preguntas especiales.</li>
        <li>Acierto del campeón.</li>
        <li>Sorteo manual (si persiste el empate).</li>
      </ol>
    </>
  )
}
