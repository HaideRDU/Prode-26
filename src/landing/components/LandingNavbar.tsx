import { Link } from 'react-router-dom'
import { ParticiparLink } from './ParticiparLink'
import { LandingAnchorLink } from './LandingAnchorLink'
import { handleLandingBrandClick } from '../scrollToLandingSection'

const NAV_LINKS = [
  { href: '#como-funciona', label: 'Cómo funciona' },
  { href: '#puntos', label: 'Puntos' },
  { href: '#fixture', label: 'Partidos' },
  { href: '#ranking', label: 'Ranking' },
]

export function LandingNavbar() {
  return (
    <header className="landing-nav">
      <div className="landing-container landing-nav__inner">
        <a
          href="/"
          className="landing-nav__brand"
          aria-label="Prode 26 inicio"
          onClick={handleLandingBrandClick}
        >
          <span aria-hidden>🏆</span> Prode <span>26</span>
        </a>
        <nav className="landing-nav__links" aria-label="Secciones">
          {NAV_LINKS.map((l) => (
            <LandingAnchorLink key={l.href} href={l.href} className="landing-nav__link">
              {l.label}
            </LandingAnchorLink>
          ))}
        </nav>
        <div className="landing-nav__actions">
          <Link to="/login" className="landing-btn landing-btn--ghost landing-mobile-nav">
            Iniciar sesión
          </Link>
          <ParticiparLink />
        </div>
      </div>
    </header>
  )
}
