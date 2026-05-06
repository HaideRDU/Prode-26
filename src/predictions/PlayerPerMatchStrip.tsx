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
      <p className="app-muted" style={{ marginTop: 4 }}>
        Elegís <strong>un jugador</strong> para el partido KO en foco. Sumas <strong>2 pts por cada gol</strong> que
        marque en <strong>90’ + prórroga</strong> (no cuentan penales).
        {!DEFAULT_RULESET.features.playerPerMatchEnabled ? (
          <>
            {' '}
            Está <strong>preparado</strong> y se habilitará cuando tengamos la fuente oficial de plantillas y
            goleadores.
          </>
        ) : null}
      </p>
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
