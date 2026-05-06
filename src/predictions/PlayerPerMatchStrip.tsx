import type { MatchDoc } from '../types/predictions'
import { DEFAULT_RULESET, getKnockoutPickLockAt, toDate } from '../config/ruleset'

export function PlayerPerMatchStrip({
  nextMatch,
  teamLabel,
}: {
  nextMatch: (MatchDoc & { id: string }) | null
  teamLabel: (id: string) => string
}) {
  const lockAt = nextMatch ? getKnockoutPickLockAt(nextMatch.scheduledAt) : null
  return (
    <section className="pred-player-strip">
      <h2 className="pred-section-title">Jugador por partido (knockout)</h2>
      {!DEFAULT_RULESET.features.playerPerMatchEnabled ? (
        <p className="app-muted" style={{ marginTop: 4 }}>
          Funcionalidad preparada. Se activará cuando tengamos la fuente oficial de plantillas y goleadores.
        </p>
      ) : null}
      {nextMatch ? (
        <div className="pred-player-strip-card">
          <div>
            <strong>Próximo partido:</strong> {teamLabel(nextMatch.teamHomeId)} vs {teamLabel(nextMatch.teamAwayId)}
          </div>
          <div className="app-muted" style={{ marginTop: 4 }}>
            Cierre de selección: {lockAt ? lockAt.toLocaleString('es-CO') : 'sin fecha'}
          </div>
        </div>
      ) : (
        <p className="app-muted">Aún no hay partidos knockout programados.</p>
      )}
      <p className="app-muted" style={{ marginTop: 6 }}>
        Puntaje: 2 pts por gol del jugador elegido (válidos 90’ + prórroga; no penales).
      </p>
    </section>
  )
}

export function getNextKnockoutMatch(matches: (MatchDoc & { id: string })[]): (MatchDoc & { id: string }) | null {
  const now = Date.now()
  const candidates = matches
    .filter((m) => m.phase === 'knockout')
    .map((m) => ({ m, when: toDate(m.scheduledAt)?.getTime() ?? Number.MAX_SAFE_INTEGER }))
    .filter((row) => Number.isFinite(row.when))
    .sort((a, b) => a.when - b.when)
  const upcoming = candidates.find((row) => row.when >= now)
  return (upcoming ?? candidates[0])?.m ?? null
}
