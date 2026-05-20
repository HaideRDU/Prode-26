import type { StandingRow } from '../services/standingsService'
import { formatRankOrdinal, RankMovementBadge, rankMovementSummary } from './RankMovementBadge'

type Props = {
  row: StandingRow | undefined
}

export function StandingsMyStatusCard({ row }: Props) {
  const delta = row?.rankDelta ?? 0

  return (
    <section className="standings-dashboard-card standings-my-status" aria-labelledby="standings-my-status-title">
      <p className="standings-dashboard-card__label">Mi estado</p>
      {row ? (
        <div className="standings-my-status__panel">
          <div className="standings-my-status__panel-top">
            <span className="standings-my-status__user">
              {row.displayName?.trim() || row.userId}
            </span>
            <RankMovementBadge delta={delta} size="lg" />
          </div>
          <h2 id="standings-my-status-title" className="standings-my-status__rank">
            {formatRankOrdinal(row.rank)}
          </h2>
          <p className="standings-my-status__summary">{rankMovementSummary(delta)}</p>
        </div>
      ) : (
        <p className="standings-my-status__empty app-muted">Aún no apareces en la clasificación de esta sala.</p>
      )}
    </section>
  )
}
