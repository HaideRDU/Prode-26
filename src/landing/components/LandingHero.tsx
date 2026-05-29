import { ParticiparLink } from './ParticiparLink'
import { LandingProductMock } from './LandingProductMock'
import { LandingAnchorLink } from './LandingAnchorLink'

export function LandingHero() {
  return (
    <section className="landing-hero" aria-labelledby="landing-hero-title">
      <div className="landing-container landing-hero__grid">
        <div>
          <p className="landing-hero__badge">Mundial 2026 · Torneo de pronósticos</p>
          <h1 id="landing-hero-title" className="landing-display landing-hero__title">
            Vive el Mundial
            <br />
            partido a partido
            <br />
            pronostica y
            <br />
            gana premios
          </h1>
          <p className="landing-hero__lead">
            Crea salas privadas para competir con tus amigos, suma puntos con tus marcadores y escala
            el ranking en tiempo real. La verdadera competencia mundialista está acá.
          </p>
          <div className="landing-hero__ctas">
            <ParticiparLink className="landing-btn landing-btn--gold landing-btn--lg" />
            <LandingAnchorLink
              href="#como-jugar"
              className="landing-btn landing-btn--outline landing-btn--lg"
            >
              Ver cómo funciona
            </LandingAnchorLink>
          </div>
          <ul className="landing-hero__features" aria-label="Ventajas del torneo">
            <li className="landing-hero__feature">
              <span className="landing-hero__feature-icon" aria-hidden>
                👥
              </span>
              <span className="landing-hero__feature-text">
                <strong>3</strong> Ganadores
              </span>
            </li>
            <li className="landing-hero__feature">
              <span className="landing-hero__feature-icon" aria-hidden>
                🎁
              </span>
              <span className="landing-hero__feature-text">
                <strong className="landing-hero__feature-accent">Bonus</strong> En cada partido
              </span>
            </li>
            <li className="landing-hero__feature">
              <span className="landing-hero__feature-icon" aria-hidden>
                ⚡
              </span>
              <span className="landing-hero__feature-text">
                <strong className="landing-hero__feature-accent">Live</strong> ranking automático
              </span>
            </li>
          </ul>
        </div>
        <LandingProductMock />
      </div>
    </section>
  )
}
