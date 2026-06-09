import { RankPositionBadge } from '../components/RankPositionBadge'
import type { StandingRow } from '../services/standingsService'
import { RankMovementBadge } from './RankMovementBadge'

type Props = {
  standings: StandingRow[]
  subtitle: string
  showSpecialsColumn?: boolean
  onViewPredictions: (row: StandingRow) => void
  onViewHistory: (row: StandingRow) => void
}

export function StandingsLeaderboard({
  standings,
  subtitle,
  showSpecialsColumn = false,
  onViewPredictions,
  onViewHistory,
}: Props) {
  return (
    <div className="standings-rank-card">
      <p className="standings-rank-card__meta">{subtitle}</p>
      <table className="standings-rank-table">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Jugador</th>
            <th scope="col" className="standings-rank-table__center">
              Pts
            </th>
            <th scope="col" className="standings-rank-table__center">
              Exactos
            </th>
            {showSpecialsColumn ? (
              <th scope="col" className="standings-rank-table__center standings-rank-table__col-especiales">
                Especiales
              </th>
            ) : null}
            <th scope="col" className="standings-rank-table__center">
              Mov.
            </th>
            <th scope="col" className="standings-rank-table__center standings-rank-table__col-actions">
              Transparencia
            </th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row) => {
            const name = row.displayName?.trim() || row.userId || row.id
            return (
              <tr
                key={row.id}
                className={[
                  row.isCurrentUser ? 'standings-rank-table__you' : '',
                  row.isOutsideTop50 ? 'standings-rank-table__you--outside' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <td className="standings-rank-table__col-rank">
                  <RankPositionBadge rank={row.rank} />
                </td>
                <td>
                  <span className="standings-rank-table__name">{name}</span>
                  {row.isOutsideTop50 ? (
                    <span className="standings-own-rank-tag">Tu posición</span>
                  ) : null}
                </td>
                <td className="standings-rank-table__center">
                  <strong className="standings-rank-table__pts">{row.points}</strong>
                </td>
                <td className="standings-rank-table__center">{row.tieBreak?.exactScoreHits ?? '—'}</td>
                {showSpecialsColumn ? (
                  <td className="standings-rank-table__center standings-rank-table__col-especiales">
                    {row.tieBreak?.specialQuestionHits ?? '—'}
                  </td>
                ) : null}
                <td className="standings-rank-table__center">
                  <RankMovementBadge delta={row.rankDelta ?? 0} />
                </td>
                <td className="standings-rank-table__center standings-rank-table__col-actions">
                  <div className="standings-rank-table__actions">
                    <button
                      type="button"
                      className="standings-rank-table__action-btn"
                      onClick={() => onViewPredictions(row)}
                      aria-label={`Ver predicción de ${name}`}
                      title="Ver predicción"
                    >
                      Predicción
                    </button>
                    <button
                      type="button"
                      className="standings-rank-table__action-btn standings-rank-table__action-btn--secondary"
                      onClick={() => onViewHistory(row)}
                      aria-label={`Ver historial de puntos de ${name}`}
                      title="Historial de puntos"
                    >
                      Historial
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
