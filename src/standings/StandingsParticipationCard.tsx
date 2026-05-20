import type { RoomStandingsMeta } from '../hooks/useRoomStandingsMeta'

type Props = {
  meta: RoomStandingsMeta
}

export function StandingsParticipationCard({ meta }: Props) {
  return (
    <section className="standings-dashboard-card standings-participation" aria-label="Participación">
      <p className="standings-dashboard-card__label">Participación</p>
      <dl className="standings-participation__stats">
        <div className="standings-participation__stat standings-participation__stat--lime">
          <dd>{meta.participantsCount}</dd>
          <dt>participantes</dt>
        </div>
        <div className="standings-participation__stat standings-participation__stat--gold">
          <dd>{meta.tournamentProgressPct}%</dd>
          <dt>torneo disputado</dt>
        </div>
        <div className="standings-participation__stat standings-participation__stat--orange">
          <dd>{meta.totalExactHits}</dd>
          <dt>exactos conseguidos</dt>
        </div>
        <div className="standings-participation__stat standings-participation__stat--white">
          <dd>{meta.leaderPoints}</dd>
          <dt>pts del líder</dt>
        </div>
      </dl>
    </section>
  )
}
