import { useMemo, useState } from 'react'
import type { StandingRow } from '../services/standingsService'

type Props = {
  standings: StandingRow[]
  subtitle: string
  showSpecialsColumn?: boolean
  onViewPredictions: (row: StandingRow) => void
  onViewHistory: (row: StandingRow) => void
}

type ScoreTab = 'general' | 'match' | 'player' | 'advance' | 'extras'

const SCORE_TABS: { id: ScoreTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'match', label: 'Partidos' },
  { id: 'player', label: 'Goleadores' },
  { id: 'advance', label: 'Avance' },
  { id: 'extras', label: 'Extras' },
]

const SEGMENTS = [
  { key: 'match' as const, label: 'Partidos', className: 'standings-scoreboard__segment--match' },
  { key: 'player' as const, label: 'Goleador', className: 'standings-scoreboard__segment--player' },
  { key: 'advance' as const, label: 'Avance', className: 'standings-scoreboard__segment--advance' },
  { key: 'extras' as const, label: 'Extras', className: 'standings-scoreboard__segment--extras' },
]

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '??'
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
}

function categoryPoints(row: StandingRow, tab: ScoreTab): number {
  const breakdown = row.breakdown
  if (tab === 'general') return row.points ?? 0
  if (tab === 'match') return breakdown?.matchPoints ?? 0
  if (tab === 'player') return breakdown?.playerPickPoints ?? 0
  if (tab === 'advance') return breakdown?.advancementPoints ?? 0
  return breakdown?.specialsPoints ?? 0
}

function segmentValues(row: StandingRow) {
  return {
    match: row.breakdown?.matchPoints ?? 0,
    player: row.breakdown?.playerPickPoints ?? 0,
    advance: row.breakdown?.advancementPoints ?? 0,
    extras: row.breakdown?.specialsPoints ?? 0,
  }
}

function rankLabel(rank: number | undefined, index: number): string {
  const value = Number.isFinite(rank) ? rank : index + 1
  if (value === 1) return '1'
  if (value === 2) return '2'
  if (value === 3) return '3'
  return String(value)
}

export function StandingsLeaderboard({
  standings,
  subtitle,
  showSpecialsColumn = false,
  onViewPredictions,
  onViewHistory,
}: Props) {
  const [activeTab, setActiveTab] = useState<ScoreTab>('general')
  const orderedRows = useMemo(() => {
    return [...standings].sort((a, b) => {
      const pa = categoryPoints(a, activeTab)
      const pb = categoryPoints(b, activeTab)
      if (pa !== pb) return pb - pa
      const ra = Number.isFinite(a.rank) ? a.rank : Number.MAX_SAFE_INTEGER
      const rb = Number.isFinite(b.rank) ? b.rank : Number.MAX_SAFE_INTEGER
      if (ra !== rb) return ra - rb
      return (a.displayName ?? a.userId).localeCompare(b.displayName ?? b.userId, 'es')
    })
  }, [standings, activeTab])

  const leader = orderedRows[0]
  const maxVisiblePoints = Math.max(1, ...orderedRows.map((row) => categoryPoints(row, activeTab)))
  const totalByTab = SCORE_TABS.reduce(
    (acc, tab) => acc + standings.reduce((sum, row) => sum + categoryPoints(row, tab.id), 0),
    0,
  )

  return (
    <section className="standings-scoreboard" aria-labelledby="standings-scoreboard-title">
      <div className="standings-scoreboard__hero">
        <p className="standings-scoreboard__live">
          <span aria-hidden="true" /> Mundial 2026 - En vivo
        </p>
        <h2 id="standings-scoreboard-title">Tabla de puntajes</h2>
        <p>{subtitle}. Haz clic en un jugador para ver su desglose por partido.</p>
        <div className="standings-scoreboard__legend" aria-label="Categorias de puntos">
          <span className="standings-scoreboard__legend-chip standings-scoreboard__legend-chip--exact">
            Exactos {standings.reduce((sum, row) => sum + (row.tieBreak?.exactScoreHits ?? 0), 0)}
          </span>
          <span className="standings-scoreboard__legend-chip standings-scoreboard__legend-chip--match">
            Resultados
          </span>
          <span className="standings-scoreboard__legend-chip standings-scoreboard__legend-chip--player">
            Goleador
          </span>
          <span className="standings-scoreboard__legend-chip standings-scoreboard__legend-chip--advance">
            Avance
          </span>
          {showSpecialsColumn ? (
            <span className="standings-scoreboard__legend-chip standings-scoreboard__legend-chip--extras">
              Extras
            </span>
          ) : null}
        </div>
      </div>

      <div className="standings-scoreboard__tabs" role="tablist" aria-label="Filtro de puntaje">
        {SCORE_TABS.filter((tab) => showSpecialsColumn || tab.id !== 'extras').map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`standings-scoreboard__tab${activeTab === tab.id ? ' is-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {leader ? (
        <article className="standings-scoreboard__leader">
          <div>
            <span className="standings-scoreboard__leader-kicker">Lider</span>
            <strong>{leader.displayName?.trim() || leader.userId}</strong>
          </div>
          <span>
            <strong>{categoryPoints(leader, activeTab)}</strong>
            <small>pts</small>
          </span>
        </article>
      ) : null}

      <div className="standings-scoreboard__rows">
        {orderedRows.map((row, index) => {
          const name = row.displayName?.trim() || row.userId || row.id
          const pts = categoryPoints(row, activeTab)
          const values = segmentValues(row)
          const totalSegments = Math.max(1, values.match + values.player + values.advance + values.extras)
          const rowWidth = Math.max(5, Math.round((pts / maxVisiblePoints) * 100))
          return (
            <article
              key={row.id}
              className={[
                'standings-scoreboard-row',
                row.isCurrentUser ? 'is-current' : '',
                index < 3 ? `is-podium is-podium-${index + 1}` : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <button
                type="button"
                className="standings-scoreboard-row__main"
                onClick={() => onViewHistory(row)}
                aria-label={`Ver desglose de puntos de ${name}`}
              >
                <span className="standings-scoreboard-row__rank">{rankLabel(row.rank, index)}</span>
                <span className="standings-scoreboard-row__avatar" aria-hidden="true">
                  {initials(name)}
                </span>
                <span className="standings-scoreboard-row__body">
                  <span className="standings-scoreboard-row__name">{name}</span>
                  <span className="standings-scoreboard-row__bar" aria-hidden="true">
                    <span className="standings-scoreboard-row__bar-total" style={{ width: `${rowWidth}%` }} />
                    <span className="standings-scoreboard-row__segments">
                      {SEGMENTS.map((segment) => {
                        const value = values[segment.key]
                        if (value <= 0) return null
                        return (
                          <span
                            key={segment.key}
                            title={`${segment.label}: ${value}`}
                            className={`standings-scoreboard__segment ${segment.className}`}
                            style={{ width: `${Math.max(3, (value / totalSegments) * 100)}%` }}
                          />
                        )
                      })}
                    </span>
                  </span>
                </span>
                <span className="standings-scoreboard-row__points">
                  <strong>{pts}</strong>
                  <small>pts</small>
                </span>
                <span className="standings-scoreboard-row__chevron" aria-hidden="true">
                  &gt;
                </span>
              </button>
              <button
                type="button"
                className="standings-scoreboard-row__prediction"
                onClick={() => onViewPredictions(row)}
              >
                Ver prediccion
              </button>
            </article>
          )
        })}
      </div>

      <p className="standings-scoreboard__foot">
        {standings.length} participantes - {totalByTab} puntos registrados en esta sala
      </p>
    </section>
  )
}
