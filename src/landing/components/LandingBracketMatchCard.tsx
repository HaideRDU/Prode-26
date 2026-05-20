import { TeamFlagName } from '../../predictions/TeamFlagName'
import type { LandingBracketMatchData } from '../landingDemoData'
import { TEAM_NAME_ES } from '../landingDemoData'
import { parseBracketScore } from '../parseBracketScore'

type Props = {
  match: LandingBracketMatchData
  date?: string
  roundLabel?: string
  /** Código FIFA (BRA) o nombre completo. */
  teamLabel?: 'code' | 'name'
}

function teamText(teamId: string, mode: 'code' | 'name'): string {
  return mode === 'name' ? (TEAM_NAME_ES[teamId] ?? teamId) : teamId
}

export function LandingBracketMatchCard({
  match,
  date,
  roundLabel,
  teamLabel = 'name',
}: Props) {
  const parsed = parseBracketScore(match.score)
  const pensParsed = match.penalties ? parseBracketScore(match.penalties) : null
  const displayWinner =
    parsed.winner === 'draw' && pensParsed?.winner != null ? pensParsed.winner : parsed.winner

  return (
    <div className="landing-bracket-card">
      {roundLabel ? <p className="landing-bracket-card__round">{roundLabel}</p> : null}
      {date ? <p className="landing-bracket-card__date">{date}</p> : null}
      <div className="landing-bracket-card__box">
        <div
          className={`landing-bracket-card__row${displayWinner === 'home' ? ' landing-bracket-card__row--winner' : ''}`}
        >
          <TeamFlagName
            teamId={match.home}
            name={teamText(match.home, teamLabel)}
            size={24}
            compact
          />
          <span
            className={`landing-bracket-card__score${displayWinner === 'home' ? ' landing-bracket-card__score--win' : ''}`}
          >
            {parsed.homeGoals}
          </span>
        </div>
        <div
          className={`landing-bracket-card__row${displayWinner === 'away' ? ' landing-bracket-card__row--winner' : ''}`}
        >
          <TeamFlagName
            teamId={match.away}
            name={teamText(match.away, teamLabel)}
            size={24}
            compact
          />
          <span
            className={`landing-bracket-card__score${displayWinner === 'away' ? ' landing-bracket-card__score--win' : ''}`}
          >
            {parsed.awayGoals}
          </span>
        </div>
        {pensParsed && pensParsed.homeGoals !== '—' ? (
          <p className="landing-bracket-card__pens" aria-label="Penales">
            {pensParsed.homeGoals} — {pensParsed.awayGoals} pen.
          </p>
        ) : null}
        {parsed.winner === null && parsed.homeGoals === '—' ? (
          <p className="landing-bracket-card__pending">Por jugar</p>
        ) : null}
      </div>
    </div>
  )
}
