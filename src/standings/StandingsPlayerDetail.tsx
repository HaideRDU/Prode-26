import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointsHistory, PointsHistoryMatchRow } from '../domain/pointsHistory'
import type { StandingRow } from '../services/standingsService'
import { TeamFlagName } from '../predictions/TeamFlagName'

type DetailTab = 'all' | 'groups' | 'r32' | 'r16' | 'qf' | 'sf' | 'final'

type Props = {
  member: { userId: string; displayName: string; standing: StandingRow }
  history: PointsHistory | null
  loading: boolean
  error: string | null
  onBack: () => void
}

const TABS: { id: DetailTab; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'groups', label: 'Grupos' },
  { id: 'r32', label: 'Dieciseisavos' },
  { id: 'r16', label: 'Octavos' },
  { id: 'qf', label: 'Cuartos' },
  { id: 'sf', label: 'Semis' },
  { id: 'final', label: 'Final' },
]

const PHASE_LABELS: { id: DetailTab; label: string; className: string }[] = [
  { id: 'groups', label: 'Grupos', className: 'is-groups' },
  { id: 'r32', label: 'Dieciseisavos', className: 'is-r32' },
  { id: 'r16', label: 'Octavos', className: 'is-r16' },
  { id: 'qf', label: 'Cuartos', className: 'is-qf' },
  { id: 'sf', label: 'Semis', className: 'is-sf' },
  { id: 'final', label: 'Final', className: 'is-final' },
]

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '??'
}

function tabForMatch(row: PointsHistoryMatchRow): DetailTab {
  if (row.matchNumber <= 72) return 'groups'
  if (row.matchNumber <= 88) return 'r32'
  if (row.matchNumber <= 96) return 'r16'
  if (row.matchNumber <= 100) return 'qf'
  if (row.matchNumber <= 102) return 'sf'
  return 'final'
}

function pointsByTab(rows: PointsHistoryMatchRow[]) {
  const out: Record<DetailTab, number> = {
    all: 0,
    groups: 0,
    r32: 0,
    r16: 0,
    qf: 0,
    sf: 0,
    final: 0,
  }
  for (const row of rows) {
    const tab = tabForMatch(row)
    out[tab] += row.total
    out.all += row.total
  }
  return out
}

function MatchDetailRow({ row }: { row: PointsHistoryMatchRow }) {
  const positiveLines = row.scoreLines.filter((line) => line.hit && line.points > 0)
  const total = row.total + row.advancementPoints
  const predictedPenWinner =
    row.predictionPenaltiesWinner === 'teamA'
      ? row.predictedTeamALabel ?? row.predictedTeamAId
      : row.predictionPenaltiesWinner === 'teamB'
        ? row.predictedTeamBLabel ?? row.predictedTeamBId
        : null
  const officialPenWinner =
    row.officialPenaltiesWinner === 'teamA'
      ? row.teamALabel ?? row.teamAId
      : row.officialPenaltiesWinner === 'teamB'
        ? row.teamBLabel ?? row.teamBId
        : null
  const predictionTeamALabel = row.predictedTeamALabel ?? row.predictedTeamAId ?? 'Equipo A'
  const predictionTeamBLabel = row.predictedTeamBLabel ?? row.predictedTeamBId ?? 'Equipo B'
  return (
    <article className={`score-detail-match${total >= 5 ? ' is-strong' : ''}`}>
      <header className="score-detail-match__top">
        <div className="score-detail-match__teams">
          <div className="score-detail-match__score-block">
            <span className="score-detail-match__label">Tu prediccion</span>
            <div className="score-detail-match__fixture score-detail-match__fixture--inside">
              {row.predictedTeamAId ? (
                <TeamFlagName teamId={row.predictedTeamAId} name={predictionTeamALabel} compact />
              ) : (
                <strong>{predictionTeamALabel}</strong>
              )}
              <span>vs</span>
              {row.predictedTeamBId ? (
                <TeamFlagName teamId={row.predictedTeamBId} name={predictionTeamBLabel} compact />
              ) : (
                <strong>{predictionTeamBLabel}</strong>
              )}
            </div>
            <strong>
              {row.predictionGoalsA} - {row.predictionGoalsB}
            </strong>
            {predictedPenWinner ? <small>Gana por penales: {predictedPenWinner}</small> : null}
          </div>
          <small className="score-detail-match__versus">comparado con</small>
          <div className="score-detail-match__score-block score-detail-match__score-block--real">
            <span className="score-detail-match__label">Partido real</span>
            <div className="score-detail-match__fixture score-detail-match__fixture--inside">
              {row.teamAId ? (
                <TeamFlagName teamId={row.teamAId} name={row.teamALabel ?? row.teamAId} compact />
              ) : (
                <strong>{row.matchupLabel}</strong>
              )}
              <span>vs</span>
              {row.teamBId ? (
                <TeamFlagName teamId={row.teamBId} name={row.teamBLabel ?? row.teamBId} compact />
              ) : null}
            </div>
            <strong>
              {row.officialGoalsA ?? '-'} - {row.officialGoalsB ?? '-'}
            </strong>
            {officialPenWinner ? <small>Gano por penales: {officialPenWinner}</small> : null}
          </div>
        </div>
        <div className="score-detail-match__meta">
          <span>M{row.matchNumber}</span>
          <strong className="score-detail-match__pts">+{total}</strong>
        </div>
      </header>
      <div className="score-detail-match__chips">
        {positiveLines.map((line) => (
          <span key={line.label} className="score-detail-chip score-detail-chip--exact">
            {line.label} +{line.points}
          </span>
        ))}
        {row.playerBonusPoints > 0 ? (
          <span className="score-detail-chip score-detail-chip--player">
            {row.playerLabel} +{row.playerBonusPoints}
          </span>
        ) : null}
        {row.advancementLines.map((line) => (
          <span key={line.teamLabel} className="score-detail-chip score-detail-chip--advance">
            Avance: {line.teamLabel} +{line.points}
          </span>
        ))}
      </div>
    </article>
  )
}

export function StandingsPlayerDetail({ member, history, loading, error, onBack }: Props) {
  const rootRef = useRef<HTMLElement | null>(null)
  const [tab, setTab] = useState<DetailTab>('all')
  const matchRows = history?.matchRows ?? []
  const byTab = useMemo(() => pointsByTab(matchRows), [matchRows])
  const maxPhase = Math.max(1, ...PHASE_LABELS.map((phase) => byTab[phase.id]))
  const visibleRows = matchRows.filter((row) => tab === 'all' || tabForMatch(row) === tab)
  const exactHits = member.standing.tieBreak?.exactScoreHits ?? 0
  const breakdown = history?.breakdown ?? member.standing.breakdown

  useEffect(() => {
    setTab('all')
    window.requestAnimationFrame(() => {
      rootRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
    })
  }, [member.userId])

  return (
    <section ref={rootRef} className="score-detail-view">
      <button type="button" className="score-detail-back" onClick={onBack}>
        ← Volver al ranking
      </button>

      <header className="score-detail-header">
        <span className="score-detail-avatar" aria-hidden="true">
          {initials(member.displayName)}
        </span>
        <div>
          <h2>{member.displayName}</h2>
          <p>{matchRows.length} partidos registrados</p>
        </div>
        <strong className="score-detail-total">
          {history?.totalPoints ?? member.standing.points}
          <small>pts totales</small>
        </strong>
      </header>

      <div className="score-detail-summary">
        <div>
          <strong>{exactHits}</strong>
          <span>Exactos</span>
        </div>
        <div>
          <strong>{breakdown?.matchPoints ?? 0}</strong>
          <span>Resultados</span>
        </div>
        <div>
          <strong>{breakdown?.playerPickPoints ?? 0}</strong>
          <span>Goleadores</span>
        </div>
        <div>
          <strong>{breakdown?.advancementPoints ?? 0}</strong>
          <span>Avances</span>
        </div>
        <div>
          <strong>{history?.display.specials ?? breakdown?.specialsPoints ?? 0}</strong>
          <span>Extras</span>
        </div>
      </div>

      {loading ? <p className="user-email">Cargando desglose...</p> : null}
      {error ? <p className="auth-error">{error}</p> : null}

      {history ? (
        <>
          <section className="score-detail-phase-card">
            <p>Puntos por fase</p>
            {PHASE_LABELS.map((phase) => {
              const value = byTab[phase.id]
              return (
                <div key={phase.id} className={`score-detail-phase ${phase.className}`}>
                  <span>{phase.label}</span>
                  <i>
                    <b style={{ width: `${Math.max(4, (value / maxPhase) * 100)}%` }} />
                  </i>
                  <strong>{value}</strong>
                </div>
              )
            })}
          </section>

          <div className="score-detail-tabs" role="tablist" aria-label="Filtro de partidos">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={tab === item.id ? 'is-active' : ''}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="score-detail-list">
            {visibleRows.length > 0 ? (
              visibleRows.map((row) => <MatchDetailRow key={`${row.matchNumber}-${row.matchupLabel}`} row={row} />)
            ) : (
              <p className="app-muted">Sin puntos registrados en esta fase.</p>
            )}
          </div>

          <section className="score-detail-extra-card">
            <div className="score-detail-extra-card__head">
              <div>
                <p>Extras y preguntas</p>
                <span>Preguntas oficiales ya resueltas para este jugador.</span>
              </div>
              <strong>{history.display.specials + history.display.podium} pts</strong>
            </div>
            {history.questionRows.length > 0 ? (
              <div className="score-detail-extra-list">
                {history.questionRows.map((row) => (
                  <article
                    key={row.questionId}
                    className={`score-detail-extra${row.points > 0 ? ' is-hit' : ''}`}
                  >
                    <div>
                      <strong>{row.questionLabel}</strong>
                      <dl>
                        <div>
                          <dt>Tu respuesta</dt>
                          <dd>{row.predictionAnswer}</dd>
                        </div>
                        <div>
                          <dt>Oficial</dt>
                          <dd>{row.officialAnswer}</dd>
                        </div>
                      </dl>
                    </div>
                    <span>+{row.points}</span>
                  </article>
                ))}
              </div>
            ) : (
              <p className="app-muted">Aun no hay preguntas extras resueltas para mostrar.</p>
            )}
          </section>
        </>
      ) : null}
    </section>
  )
}
