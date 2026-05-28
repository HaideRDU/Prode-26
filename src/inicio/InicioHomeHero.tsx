import { Link, useOutletContext } from 'react-router-dom'
import { ParticiparLink } from '../landing/components/ParticiparLink'
import type { AccountOutletContext } from '../types/outletContext'
import { TournamentCountdown } from './TournamentCountdown'
import './inicio-home.css'

export function InicioHomeHero() {
  const { publicDisplayName } = useOutletContext<AccountOutletContext>()
  const name = publicDisplayName?.trim()

  return (
    <div className="inicio-home">
      <section className="inicio-home__hero" aria-labelledby="inicio-hero-title">
        <div className="inicio-home__inner">
          <p className="inicio-home__badge">Mundial 2026 · Ya estás dentro</p>
          {name ? <p className="inicio-home__greeting">Hola, {name}</p> : null}
          <h1 id="inicio-hero-title" className="inicio-home__display">
            No es azar, gana quien mejor entiende el Mundial
          </h1>
          <p className="inicio-home__lead">
            Lee cada grupo, analiza cada cruce e interpreta el desarrollo del torneo. Acierta tus
            predicciones, suma puntos y compite por quedarte con el primer puesto.
          </p>
          <TournamentCountdown />
          <div className="inicio-home__ctas">
            <ParticiparLink
              to="/room/global/standings"
              className="inicio-home__btn inicio-home__btn--gold inicio-home__btn--lg"
            >
              Participar ahora
            </ParticiparLink>
            <Link to="/salas" className="inicio-home__btn inicio-home__btn--outline inicio-home__btn--lg">
              Mis salas privadas
            </Link>
            <Link to="/rooms" className="inicio-home__btn inicio-home__btn--ghost">
              Crear o unirse
            </Link>
          </div>
          <div className="inicio-home__highlights" aria-label="Beneficios del torneo">
            <div className="inicio-home__highlight-card">
              <span className="inicio-home__highlight-icon" aria-hidden>
                👥
              </span>
              <div className="inicio-home__highlight-text">
                <strong>3 Ganadores</strong>
                <span>Podio final</span>
              </div>
            </div>
            <div className="inicio-home__highlight-card">
              <span className="inicio-home__highlight-icon" aria-hidden>
                🎁
              </span>
              <div className="inicio-home__highlight-text">
                <strong>BONUS</strong>
                <span>En cada partido</span>
              </div>
            </div>
            <div className="inicio-home__highlight-card">
              <span className="inicio-home__highlight-icon" aria-hidden>
                ⚡
              </span>
              <div className="inicio-home__highlight-text">
                <strong>Live</strong>
                <span>Ranking en tiempo real</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
