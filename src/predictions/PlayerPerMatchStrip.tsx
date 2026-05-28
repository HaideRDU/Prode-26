import type { MatchDoc } from '../types/predictions'
import { matchTeamAId, matchTeamBId } from '../domain/matchFields'
import { DEFAULT_RULESET } from '../config/ruleset'
import { useMatchTimeFormatters } from '../hooks/useUserTimeZone'
import { classifyPlayerPickMatches } from '../utils/playerPerMatchWindows'

export function PlayerPerMatchStrip({
  matches,
  teamLabel,
}: {
  matches: (MatchDoc & { id: string })[]
  teamLabel: (id: string | null | undefined) => string
}) {
  const openH = DEFAULT_RULESET.lockWindows.playerPerMatchOpensHoursBeforeKickoff
  const { formatMatchTime } = useMatchTimeFormatters()
  const classified = classifyPlayerPickMatches(matches)
  const first = classified.prediction[0] ?? classified.live[0] ?? classified.preview[0] ?? null

  return (
    <section className="pred-player-strip">
      <h2 className="pred-section-title">Jugador por partido</h2>
      <p className="app-muted" style={{ marginTop: 4 }}>
        Elegís <strong>un jugador</strong> por encuentro desde <strong>{openH} horas antes</strong> del pitazo.
        Cierre: <strong>11:59 p. m. del día anterior</strong> al partido (hora del torneo). Puntos por gol según
        fase (grupos 1 pt, hasta 5 en la final). Se guarda al seleccionar en clasificación.
      </p>
      {first ? (
        <div className="pred-player-strip-card">
          <div>
            <strong>En ventana / foco:</strong> {teamLabel(matchTeamAId(first))} vs{' '}
            {teamLabel(matchTeamBId(first))}
          </div>
          <div className="app-muted" style={{ marginTop: 4 }}>
            {formatMatchTime(first.scheduledAt)}
            {classified.prediction.length > 1
              ? ` · +${classified.prediction.length - 1} partido(s) más en clasificación`
              : null}
          </div>
        </div>
      ) : classified.nextOpensAt ? (
        <p className="app-muted">
          Próxima ventana: {formatMatchTime(classified.nextOpensAt)} ({openH} h antes del partido).
        </p>
      ) : (
        <p className="app-muted">Aún no hay partidos en ventana de jugador por partido.</p>
      )}
    </section>
  )
}

/** @deprecated Usar classifyPlayerPickMatches en el banner de clasificación. */
export function getNextKnockoutMatch(matches: (MatchDoc & { id: string })[]): (MatchDoc & { id: string }) | null {
  const c = classifyPlayerPickMatches(matches)
  return c.prediction[0] ?? c.live[0] ?? c.preview[0] ?? null
}
