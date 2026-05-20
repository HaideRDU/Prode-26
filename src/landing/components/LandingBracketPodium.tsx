import { TeamFlagName } from '../../predictions/TeamFlagName'
import { getLandingPodiumSlots } from '../bracketPodium'

const PLACE_LABEL: Record<1 | 2 | 3, string> = {
  1: '1.º',
  2: '2.º',
  3: '3.er',
}

export function LandingBracketPodium() {
  const slots = getLandingPodiumSlots()

  return (
    <div className="landing-bracket__podium-stage">
      <p className="landing-label landing-bracket__podium-heading">Podio</p>
      <div className="landing-bracket__podium-row" role="list">
        {slots.map((slot) => (
          <div
            key={slot.place}
            role="listitem"
            className={`landing-bracket__podium-slot landing-bracket__podium-slot--${slot.place}${slot.place === 1 ? ' landing-bracket__podium-slot--champ' : ''}`}
          >
            <div className="landing-bracket__podium-head">
              {slot.place === 1 ? (
                <span className="landing-bracket__podium-trophy" aria-hidden>
                  🏆
                </span>
              ) : null}
              {slot.teamId ? (
                <TeamFlagName teamId={slot.teamId} name={slot.nameEs} size={24} />
              ) : (
                <span className="landing-bracket__podium-placeholder">{slot.nameEs}</span>
              )}
            </div>
            <div className="landing-bracket__podium-pedestal">
              <span className="landing-bracket__podium-place">{PLACE_LABEL[slot.place]}</span>
              <div className="landing-bracket__podium-bar" aria-hidden />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
