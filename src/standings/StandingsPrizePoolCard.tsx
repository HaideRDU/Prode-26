import type { PrivateRoomPodiumPrizes } from '../types/predictions'
const SLOTS = [
  { key: 'first' as const, label: '1.er lugar', barClass: 'standings-prize-pool__bar--first' },
  { key: 'second' as const, label: '2.º lugar', barClass: 'standings-prize-pool__bar--second' },
  { key: 'third' as const, label: '3.er lugar', barClass: 'standings-prize-pool__bar--third' },
]

type Props = {
  prizes?: PrivateRoomPodiumPrizes | null
  roomName?: string
}

export function StandingsPrizePoolCard({ prizes, roomName }: Props) {
  return (
    <section className="standings-dashboard-card standings-prize-pool" aria-labelledby="standings-prize-pool-title">
      <h2 id="standings-prize-pool-title" className="standings-dashboard-card__label">
        Premios de la sala
      </h2>
      {roomName ? <p className="standings-prize-pool__room">Sala «{roomName}»</p> : null}
      <ul className="standings-prize-pool__list">
        {SLOTS.map((slot) => {
          const text = prizes?.[slot.key]?.trim()
          return (
            <li key={slot.key} className="standings-prize-pool__row">
              <div className="standings-prize-pool__row-head">
                <span className="standings-prize-pool__place">{slot.label}</span>
                <span className="standings-prize-pool__value">{text || 'Sin premio registrado'}</span>
              </div>
              <div className={`standings-prize-pool__bar ${slot.barClass}`} aria-hidden />
            </li>
          )
        })}
      </ul>
    </section>
  )
}
