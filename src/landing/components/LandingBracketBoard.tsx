import {
  LANDING_BRACKET_QF_LEFT,
  LANDING_BRACKET_QF_RIGHT,
  LANDING_BRACKET_SEMIS,
  LANDING_BRACKET_THIRD_MATCH,
} from '../landingDemoData'
import { LandingBracketFinal } from './LandingBracketFinal'
import { LandingBracketMatchCard } from './LandingBracketMatchCard'

export function LandingBracketBoard() {
  const [sfLeft, sfRight] = LANDING_BRACKET_SEMIS

  return (
    <div className="landing-bracket-board" aria-label="Bracket eliminatorias demo">
      <div className="landing-bracket-board__col landing-bracket-board__col--qf">
        <p className="landing-bracket-board__heading">Cuartos</p>
        <div className="landing-bracket-board__stack">
          {LANDING_BRACKET_QF_LEFT.map((m, i) => (
            <LandingBracketMatchCard key={i} match={m} date={m.date} teamLabel="code" />
          ))}
        </div>
      </div>

      <div className="landing-bracket-board__col landing-bracket-board__col--sf">
        <p className="landing-bracket-board__heading">Semifinal</p>
        <div className="landing-bracket-board__stack landing-bracket-board__stack--center">
          <LandingBracketMatchCard match={sfLeft} teamLabel="name" />
        </div>
      </div>

      <div className="landing-bracket-board__col landing-bracket-board__col--final">
        <LandingBracketFinal />
      </div>

      <div className="landing-bracket-board__col landing-bracket-board__col--sf">
        <p className="landing-bracket-board__heading">Semifinal</p>
        <div className="landing-bracket-board__stack landing-bracket-board__stack--center">
          <LandingBracketMatchCard match={sfRight} teamLabel="name" />
        </div>
      </div>

      <div className="landing-bracket-board__col landing-bracket-board__col--qf">
        <p className="landing-bracket-board__heading">Cuartos</p>
        <div className="landing-bracket-board__stack">
          {LANDING_BRACKET_QF_RIGHT.map((m, i) => (
            <LandingBracketMatchCard key={i} match={m} date={m.date} teamLabel="code" />
          ))}
        </div>
      </div>

      <div className="landing-bracket-board__third">
        <p className="landing-bracket-board__heading">Tercer lugar</p>
        <LandingBracketMatchCard match={LANDING_BRACKET_THIRD_MATCH} teamLabel="name" />
      </div>
    </div>
  )
}
