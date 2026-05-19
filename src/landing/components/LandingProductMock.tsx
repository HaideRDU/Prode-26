import { LandingBadge } from './LandingBadge'
import { LandingProgressBar } from './LandingProgressBar'

export function LandingProductMock() {
  return (
    <aside className="landing-glass landing-mock" aria-label="Vista previa del panel de juego">
      <div className="landing-mock__header">
        <LandingBadge variant="lime">En vivo</LandingBadge>
        <span className="landing-badge landing-badge--gold">+124 pts posibles</span>
      </div>
      <p className="landing-mock__progress-label">Progreso de predicciones</p>
      <LandingProgressBar value={68} />
      <p className="landing-muted" style={{ fontSize: '0.8125rem', marginTop: '0.5rem' }}>
        34 de 50 partidos listos · 3 especiales pendientes
      </p>
      <div className="landing-mock__rank">
        <div className="landing-mock__rank-row landing-mock__rank-row--you">
          <span>#3 tú</span>
          <strong>214 pts</strong>
        </div>
        <div className="landing-mock__rank-row">
          <span>#1 carlos_mx</span>
          <span>248</span>
        </div>
        <div className="landing-mock__rank-row">
          <span>#2 ana_prode</span>
          <span>231</span>
        </div>
      </div>
    </aside>
  )
}
