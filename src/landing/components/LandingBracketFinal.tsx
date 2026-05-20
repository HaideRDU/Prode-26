import { flagImageUrl } from '../../data/wc2026/teamFlagAlpha2'
import {
  LANDING_BRACKET_FINAL_MATCH,
  LANDING_BRACKET_FINAL_META,
  TEAM_NAME_ES,
} from '../landingDemoData'
import { parseBracketScore } from '../parseBracketScore'

export function LandingBracketFinal() {
  const parsed = parseBracketScore(LANDING_BRACKET_FINAL_MATCH.score)
  const championId =
    parsed.winner === 'home'
      ? LANDING_BRACKET_FINAL_MATCH.home
      : parsed.winner === 'away'
        ? LANDING_BRACKET_FINAL_MATCH.away
        : null
  const championName = championId ? (TEAM_NAME_ES[championId] ?? championId) : 'Por definir'
  const homeFlag = flagImageUrl(LANDING_BRACKET_FINAL_MATCH.home, 40)
  const awayFlag = flagImageUrl(LANDING_BRACKET_FINAL_MATCH.away, 40)

  return (
    <div className="landing-bracket-final">
      <div className="landing-bracket-final__trophy-ring" aria-hidden>
        🏆
      </div>
      <p className="landing-bracket-final__title">Final</p>
      <p className="landing-bracket-final__meta">
        {LANDING_BRACKET_FINAL_META.date} · {LANDING_BRACKET_FINAL_META.venue}
      </p>
      <div className="landing-bracket-final__card">
        <div className="landing-bracket-final__teams">
          <div className="landing-bracket-final__team">
            {homeFlag ? (
              <img src={homeFlag} alt="" width={40} height={30} className="landing-bracket-final__flag" />
            ) : (
              <span className="landing-bracket-final__flag-ph" aria-hidden />
            )}
            <span className="landing-bracket-final__code">{LANDING_BRACKET_FINAL_MATCH.home}</span>
          </div>
          <span className="landing-bracket-final__score">
            {parsed.homeGoals} — {parsed.awayGoals}
          </span>
          <div className="landing-bracket-final__team">
            {awayFlag ? (
              <img src={awayFlag} alt="" width={40} height={30} className="landing-bracket-final__flag" />
            ) : (
              <span className="landing-bracket-final__flag-ph" aria-hidden />
            )}
            <span className="landing-bracket-final__code">{LANDING_BRACKET_FINAL_MATCH.away}</span>
          </div>
        </div>
        <div className="landing-bracket-final__champion">
          <span className="landing-bracket-final__champion-label">Campeón</span>
          {championId && flagImageUrl(championId, 24) ? (
            <img
              src={flagImageUrl(championId, 24)!}
              alt=""
              width={24}
              height={18}
              className="landing-bracket-final__champion-flag"
            />
          ) : null}
          <strong className="landing-bracket-final__champion-name">{championName}</strong>
        </div>
      </div>
    </div>
  )
}
