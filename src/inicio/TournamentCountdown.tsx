import { tournamentKickoffLabel, useTournamentCountdown } from '../hooks/useTournamentCountdown'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function TournamentCountdown() {
  const { days, hours, minutes, seconds, started } = useTournamentCountdown()
  const kickoff = tournamentKickoffLabel()

  if (started) {
    return (
      <div className="inicio-home__countdown inicio-home__countdown--started" aria-live="polite">
        <p className="inicio-home__countdown-started">El torneo ya está en marcha</p>
        <p className="inicio-home__countdown-meta">Inicio oficial: {kickoff}</p>
      </div>
    )
  }

  return (
    <div className="inicio-home__countdown" aria-live="polite" aria-label="Cuenta regresiva al inicio del torneo">
      <p className="inicio-home__countdown-label">Falta para el pitido inicial</p>
      <div className="inicio-home__countdown-grid">
        <div className="inicio-home__countdown-unit">
          <strong>{days}</strong>
          <span>días</span>
        </div>
        <div className="inicio-home__countdown-unit">
          <strong>{pad2(hours)}</strong>
          <span>horas</span>
        </div>
        <div className="inicio-home__countdown-unit">
          <strong>{pad2(minutes)}</strong>
          <span>min</span>
        </div>
        <div className="inicio-home__countdown-unit">
          <strong>{pad2(seconds)}</strong>
          <span>seg</span>
        </div>
      </div>
      <p className="inicio-home__countdown-meta">{kickoff}</p>
    </div>
  )
}
