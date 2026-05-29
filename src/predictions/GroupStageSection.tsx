import type { MatchDoc, MatchStatus } from '../types/predictions'
import { orderedGroupIds } from '../domain/groupStandings'
import { matchGoalsTeamA, matchGoalsTeamB, matchTeamAId, matchTeamBId } from '../domain/matchFields'
import { TeamFlagName } from './TeamFlagName'
import { scoreMatchPrediction } from '../services/scoring'
import { parseGoalField } from '../domain/parseScoreText'

export type GroupDraftEntry = { goalsHome: number | null; goalsAway: number | null }

export function GroupStageSection({
  matchesByGroup,
  draftByMatchId,
  filledMatchIds,
  onDraftChange,
  teamLabel,
  groupLocked,
}: {
  matchesByGroup: Map<string, (MatchDoc & { id: string })[]>
  draftByMatchId: Map<string, GroupDraftEntry>
  filledMatchIds: ReadonlySet<string>
  onDraftChange: (matchId: string, goalsHome: number | null, goalsAway: number | null) => void
  teamLabel: (id: string | null | undefined) => string
  groupLocked: boolean
}) {
  const groups = orderedGroupIds().filter((g) => matchesByGroup.has(g))
  if (groups.length === 0) return null

  return (
    <section className="pred-group-stage">
      <h2 className="pred-section-title">3 · Fase de grupos</h2>
      <p className="app-muted pred-group-intro">
        Marcador en dos campos (goles Equipo A y Equipo B). Se guarda junto con eliminatorias y extras con el
        botón inferior cuando todo esté completo.
        {groupLocked ? ' · Fase de grupos ya guardada (no editable).' : ''}
      </p>

      {groups.map((gid) => {
        const list = matchesByGroup.get(gid) ?? []
        return (
          <details key={gid} className="pred-group-details" open>
            <summary>
              <span>
                GRUPO {gid}
                <span className="app-muted" style={{ fontWeight: 500, marginLeft: 8 }}>
                  · {list.length} partidos
                </span>
              </span>
            </summary>
            <div className="pred-group-matches">
              {list.map((m) => (
                <GroupMatchRow
                  key={m.id}
                  match={m}
                  draft={draftByMatchId.get(m.id) ?? { goalsHome: 0, goalsAway: 0 }}
                  isFilled={filledMatchIds.has(m.id)}
                  teamLabel={teamLabel}
                  disabled={groupLocked || (m.status !== 'scheduled' && m.status !== 'live')}
                  onChange={(h, a) => onDraftChange(m.id, h, a)}
                />
              ))}
            </div>
          </details>
        )
      })}
    </section>
  )
}

function GroupMatchRow({
  match,
  draft,
  isFilled,
  teamLabel,
  disabled,
  onChange,
}: {
  match: MatchDoc & { id: string; status: MatchStatus }
  draft: GroupDraftEntry
  isFilled: boolean
  teamLabel: (id: string | null | undefined) => string
  disabled: boolean
  onChange: (goalsHome: number | null, goalsAway: number | null) => void
}) {
  const teamAId = matchTeamAId(match)
  const teamBId = matchTeamBId(match)
  const homeStr = String(draft.goalsHome ?? 0)
  const awayStr = String(draft.goalsAway ?? 0)
  const earnedPoints =
    disabled &&
    match.status === 'finished' &&
    matchGoalsTeamA(match) != null &&
    matchGoalsTeamB(match) != null &&
    isFilled &&
    teamAId &&
    teamBId
      ? scoreMatchPrediction(match, {
          goalsTeamA: draft.goalsHome as number,
          goalsTeamB: draft.goalsAway as number,
        })
      : null

  function applyHome(raw: string) {
    const g = parseGoalField(raw)
    if (g !== null) {
      onChange(g, draft.goalsAway)
    } else if (!raw.trim()) {
      onChange(0, draft.goalsAway)
    }
  }

  function applyAway(raw: string) {
    const g = parseGoalField(raw)
    if (g !== null) {
      onChange(draft.goalsHome, g)
    } else if (!raw.trim()) {
      onChange(draft.goalsHome, 0)
    }
  }

  return (
    <div
      className={`pred-match-card pred-match-card--group pred-match-card--compact ${!isFilled && !disabled ? 'pred-match-card--incomplete' : ''}${earnedPoints !== null ? ' pred-match-card--has-pts' : ''}`}
    >
      {earnedPoints !== null ? (
        <span className="pred-match-card__pts-badge" aria-label={`Puntos obtenidos: ${earnedPoints}`}>
          Pts: {earnedPoints}
        </span>
      ) : null}
      <div className="pred-match-row-top pred-match-row-top--group">
        <TeamFlagName teamId={teamAId ?? ''} name={teamLabel(teamAId)} layout="stack" />
        <span className="pred-vs-inline">VS</span>
        <TeamFlagName teamId={teamBId ?? ''} name={teamLabel(teamBId)} layout="stack" />
      </div>

      <span className="pred-score-text-label app-muted">Marcador</span>
      <div className="pred-score-split" role="group" aria-label="Marcador predicho (Equipo A y Equipo B)">
        <input
          id={`score-home-${match.id}`}
          type="number"
          inputMode="numeric"
          min={0}
          max={20}
          step={1}
          className="field-input pred-score-split-input"
          autoComplete="off"
          placeholder="0"
          value={homeStr}
          onChange={(e) => applyHome(e.target.value)}
          disabled={disabled}
          aria-label="Goles Equipo A"
        />
        <span className="pred-score-split-sep" aria-hidden>
          -
        </span>
        <input
          id={`score-away-${match.id}`}
          type="number"
          inputMode="numeric"
          min={0}
          max={20}
          step={1}
          className="field-input pred-score-split-input"
          autoComplete="off"
          placeholder="0"
          value={awayStr}
          onChange={(e) => applyAway(e.target.value)}
          disabled={disabled}
          aria-label="Goles Equipo B"
        />
      </div>

    </div>
  )
}
