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
            Tu quiniela del Mundial 2026
          </h1>
          <p className="inicio-home__lead">
            Compite en la sala global con todos los usuarios o armá tu liga en salas privadas con
            amigos. Sumá puntos con marcadores exactos y seguí el ranking en vivo.
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
          <div className="inicio-home__metrics" aria-label="Datos del torneo">
            <div className="inicio-home__metric">
              <strong>72</strong>
              <span>partidos de grupos</span>
            </div>
            <div className="inicio-home__metric">
              <strong>+22</strong>
              <span>pts por campeón</span>
            </div>
            <div className="inicio-home__metric">
              <strong>Live</strong>
              <span>ranking automático</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
