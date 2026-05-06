import type { PrivateRoomPodiumPrizes } from '../types/predictions'
import type { StandingRow } from '../services/standingsService'

const SLOT_META = [
  { rankLabel: '1.er lugar', prizeField: 'first' as const },
  { rankLabel: '2.º lugar', prizeField: 'second' as const },
  { rankLabel: '3.er lugar', prizeField: 'third' as const },
]

export function RoomPrivatePodiumSection({
  standings,
  prizes,
}: {
  standings: StandingRow[]
  prizes?: PrivateRoomPodiumPrizes | null
}) {
  const topThree = standings.slice(0, 3)

  return (
    <section className="room-private-podium" aria-labelledby="room-private-podium-heading">
      <h2 id="room-private-podium-heading" className="room-private-podium__title">
        Podio y premios
      </h2>
      <p className="room-private-podium__lead app-muted">
        Los tres primeros puestos de esta sala y el premio definido por el líder.
      </p>
      <div className="room-private-podium__grid">
        {SLOT_META.map((slot, index) => {
          const row = topThree[index]
          const prizeText = prizes?.[slot.prizeField]?.trim()
          const userLabel = row?.displayName?.trim() || row?.userId || '—'

          return (
            <div key={slot.prizeField} className="room-private-podium__card">
              <div className="room-private-podium__rank">{slot.rankLabel}</div>
              <div className="room-private-podium__user">{userLabel}</div>
              <div className="room-private-podium__points">
                {row ? `${row.points} pts` : '—'}
              </div>
              <div className="room-private-podium__prize-label">Premio</div>
              <div className="room-private-podium__prize">
                {prizeText ? prizeText : 'Sin premio registrado'}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
