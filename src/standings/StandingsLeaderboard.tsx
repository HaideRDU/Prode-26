import { RankPositionBadge } from '../components/RankPositionBadge'
import type { StandingRow } from '../services/standingsService'
import { RankMovementBadge } from './RankMovementBadge'

type Props = {
  standings: StandingRow[]
  subtitle: string
  showSpecialsColumn?: boolean
}

export function StandingsLeaderboard({ standings, subtitle, showSpecialsColumn = false }: Props) {
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
          </tr>
        </thead>
        <tbody>
          {standings.map((row) => (
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
                <span className="standings-rank-table__name">
                  {row.displayName?.trim() || row.userId || row.id}
                </span>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
