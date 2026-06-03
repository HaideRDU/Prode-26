import { RankPositionBadge } from '../../components/RankPositionBadge'
import { LANDING_MOCK_GROUP_RANKING, LANDING_MOCK_PREDICTIONS } from '../landingDemoData'
import { TeamFlagName } from '../../predictions/TeamFlagName'
import { LandingRankMovement } from './LandingRankMovement'

export function LandingProductMock() {
  return (
    <aside className="landing-glass landing-mock" aria-label="Vista previa del panel de juego">
      <div className="landing-mock__header">
        <span className="landing-badge landing-badge--live">
          <span className="landing-badge--live__dot" aria-hidden />
          En vivo
        </span>
        <span className="landing-mock__pts-total">+124 pts acumulados</span>
      </div>

      <section className="landing-mock__block" aria-labelledby="landing-mock-preds-title">
        <h3 id="landing-mock-preds-title" className="landing-mock__section-title">
          Tus pronósticos
        </h3>
        <ul className="landing-mock-preds">
          {LANDING_MOCK_PREDICTIONS.map((row) => (
            <li key={`${row.homeId}-${row.awayId}`} className="landing-mock-pred">
              <TeamFlagName teamId={row.homeId} name={row.homeId} size={24} compact />
              <span className="landing-mock-pred__score" aria-label="Marcador predicho">
                {row.homeScore} - {row.awayScore}
              </span>
              <TeamFlagName teamId={row.awayId} name={row.awayId} size={24} compact />
              {row.status === 'scored' ? (
                <span className="landing-mock-pred__pts">+{row.points} pts</span>
              ) : (
                <span className="landing-mock-pred__pending">Pendiente</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="landing-mock__block" aria-labelledby="landing-mock-rank-title">
        <h3 id="landing-mock-rank-title" className="landing-mock__section-title">
          Ranking del grupo
        </h3>
        <table className="landing-mock-rank-table">
          <caption className="visually-hidden">Clasificación de ejemplo en la sala</caption>
          <thead>
            <tr>
              <th scope="col" className="landing-mock-rank-table__col-rank">
                #
              </th>
              <th scope="col">Jugador</th>
              <th scope="col" className="landing-mock-rank-table__col-pts">
                Pts
              </th>
              <th scope="col" className="landing-mock-rank-table__col-mov">
                Mov.
              </th>
            </tr>
          </thead>
          <tbody>
            {LANDING_MOCK_GROUP_RANKING.map((row) => (
              <tr
                key={row.name}
                className={row.highlight ? 'landing-mock-rank-table__you' : undefined}
              >
                <td className="landing-mock-rank-table__col-rank">
                  <RankPositionBadge rank={row.rank} />
                </td>
                <td>
                  <span className="landing-mock-rank-table__name">{row.name}</span>
                </td>
                <td className="landing-mock-rank-table__col-pts">
                  <strong>{row.pts}</strong>
                  <span className="landing-mock-rank-table__pts-suffix"> pts</span>
                </td>
                <td className="landing-mock-rank-table__col-mov">
                  {row.rankDelta != null ? (
                    <LandingRankMovement delta={row.rankDelta} />
                  ) : (
                    <span className="landing-rank-move landing-rank-move--flat" aria-hidden>
                      —
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </aside>
  )
}
