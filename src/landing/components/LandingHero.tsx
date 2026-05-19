import { ParticiparLink } from './ParticiparLink'
import { LandingProductMock } from './LandingProductMock'
import { LandingAnchorLink } from './LandingAnchorLink'

export function LandingHero() {
  return (
    <section className="landing-hero" aria-labelledby="landing-hero-title">
      <div className="landing-container landing-hero__grid">
        <div>
          <p className="landing-hero__badge">Mundial 2026 · Predicciones en vivo</p>
          <h1 id="landing-hero-title" className="landing-display">
            Tu quiniela premium del Mundial
          </h1>
          <p className="landing-hero__lead">
            Compite en salas privadas, suma puntos con marcadores exactos y escala el ranking en tiempo
            real. Emoción de sportsbook, claridad de fantasy.
          </p>
          <div className="landing-hero__ctas">
            <ParticiparLink className="landing-btn landing-btn--gold landing-btn--lg" />
            <LandingAnchorLink
              href="#como-funciona"
              className="landing-btn landing-btn--outline landing-btn--lg"
            >
              Ver cómo funciona
            </LandingAnchorLink>
          </div>
          <div className="landing-hero__metrics">
            <div className="landing-hero__metric">
              <strong>72</strong>
              <span>partidos de grupos</span>
            </div>
            <div className="landing-hero__metric">
              <strong>+22</strong>
              <span>pts por campeón</span>
            </div>
            <div className="landing-hero__metric">
              <strong>Live</strong>
              <span>ranking automático</span>
            </div>
          </div>
        </div>
        <LandingProductMock />
      </div>
    </section>
  )
}
