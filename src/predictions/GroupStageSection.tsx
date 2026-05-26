import type { MatchDoc, MatchStatus } from '../types/predictions'
import { orderedGroupIds } from '../domain/groupStandings'
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
  teamLabel: (id: string) => string
  groupLocked: boolean
}) {
  const groups = orderedGroupIds().filter((g) => matchesByGroup.has(g))
  if (groups.length === 0) return null

  return (
    <section className="pred-group-stage">
      <h2 className="pred-section-title">1 · Fase de grupos</h2>
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
  teamLabel: (id: string) => string
  disabled: boolean
  onChange: (goalsHome: number | null, goalsAway: number | null) => void
}) {
  const homeStr = String(draft.goalsHome ?? 0)
  const awayStr = String(draft.goalsAway ?? 0)
  const preview =
    match.status === 'finished' &&
    match.goalsHome != null &&
    match.goalsAway != null &&
    isFilled
      ? scoreMatchPrediction(match, {
          goalsHome: draft.goalsHome as number,
          goalsAway: draft.goalsAway as number,
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
      className={`pred-match-card pred-match-card--group pred-match-card--compact ${!isFilled && !disabled ? 'pred-match-card--incomplete' : ''}`}
    >
      <div className="pred-match-row-top pred-match-row-top--group">
        <TeamFlagName
          teamId={match.teamHomeId}
          name={teamLabel(match.teamHomeId)}
          layout="stack"
        />
        <span className="pred-vs-inline">VS</span>
        <TeamFlagName
          teamId={match.teamAwayId}
          name={teamLabel(match.teamAwayId)}
          layout="stack"
        />
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

      {preview != null && preview > 0 ? (
        <span className="app-muted pred-preview-pts">Pts: {preview}</span>
      ) : null}
    </div>
  )
}
