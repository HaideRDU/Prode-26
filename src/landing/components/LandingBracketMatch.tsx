import { TeamFlagName } from '../../predictions/TeamFlagName'
import type { LandingBracketMatchData } from '../landingDemoData'
import { TEAM_NAME_ES } from '../landingDemoData'
import { parseBracketScore } from '../parseBracketScore'

type Props = {
  match: LandingBracketMatchData
  layout?: 'stack' | 'versus'
}

function formatScoreLine(home: string, away: string): string {
  return `${home} — ${away}`
}

export function LandingBracketMatch({ match, layout = 'stack' }: Props) {
  const parsed = parseBracketScore(match.score)
  const pensParsed = match.penalties ? parseBracketScore(match.penalties) : null
  const displayWinner =
    parsed.winner === 'draw' && pensParsed?.winner != null ? pensParsed.winner : parsed.winner

  if (layout === 'versus') {
    const scoreMain =
      parsed.homeGoals === '—' ? '—' : formatScoreLine(parsed.homeGoals, parsed.awayGoals)
    const scorePens =
      pensParsed && pensParsed.homeGoals !== '—'
        ? formatScoreLine(pensParsed.homeGoals, pensParsed.awayGoals)
        : null

    return (
      <div className="landing-bracket__match landing-bracket__match--versus">
        <div className="landing-bracket__versus-row">
          <div
            className={`landing-bracket__versus-side${displayWinner === 'home' ? ' landing-bracket__versus-side--winner' : ''}`}
          >
            <TeamFlagName
              teamId={match.home}
              name={TEAM_NAME_ES[match.home] ?? match.home}
              size={24}
            />
          </div>
          <div className="landing-bracket__versus-center">
            <span className="landing-bracket__versus-score" aria-label="Marcador">
              {scoreMain}
            </span>
            {scorePens ? (
              <span className="landing-bracket__versus-pens" aria-label="Penales">
                {scorePens}
              </span>
            ) : null}
            {parsed.winner === null && parsed.homeGoals === '—' ? (
              <span className="landing-bracket__versus-pens landing-bracket__versus-status">Por jugar</span>
            ) : null}
          </div>
          <div
            className={`landing-bracket__versus-side${displayWinner === 'away' ? ' landing-bracket__versus-side--winner' : ''}`}
          >
            <TeamFlagName
              teamId={match.away}
              name={TEAM_NAME_ES[match.away] ?? match.away}
              size={24}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="landing-bracket__match">
      <div
        className={`landing-bracket__team-row${parsed.winner === 'home' ? ' landing-bracket__team-row--winner' : ''}${parsed.winner === 'draw' ? ' landing-bracket__team-row--draw' : ''}`}
      >
        <TeamFlagName
          teamId={match.home}
          name={TEAM_NAME_ES[match.home] ?? match.home}
          size={24}
          compact
        />
        <span className="landing-bracket__goals" aria-label={`Goles ${TEAM_NAME_ES[match.home] ?? match.home}`}>
          {parsed.homeGoals}
        </span>
      </div>
      <div
        className={`landing-bracket__team-row${parsed.winner === 'away' ? ' landing-bracket__team-row--winner' : ''}${parsed.winner === 'draw' ? ' landing-bracket__team-row--draw' : ''}`}
      >
        <TeamFlagName
          teamId={match.away}
          name={TEAM_NAME_ES[match.away] ?? match.away}
          size={24}
          compact
        />
        <span className="landing-bracket__goals" aria-label={`Goles ${TEAM_NAME_ES[match.away] ?? match.away}`}>
          {parsed.awayGoals}
        </span>
      </div>
      {parsed.winner === 'draw' && !match.penalties ? (
        <p className="landing-bracket__match-note">Empate</p>
      ) : null}
      {parsed.winner === null && parsed.homeGoals === '—' ? (
        <p className="landing-bracket__match-note">Por jugar</p>
      ) : null}
    </div>
  )
}
