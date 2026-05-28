import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { UiControl } from '../theme/uiControl'
import './landing.css'
import { LandingNavbar } from './components/LandingNavbar'
import { LandingHero } from './components/LandingHero'
import { LandingSection } from './components/LandingSection'
import { LandingBadge } from './components/LandingBadge'
import { LandingProgressBar } from './components/LandingProgressBar'
import { LandingPillTabs } from './components/LandingPillTabs'
import { ParticiparLink } from './components/ParticiparLink'
import {
  LANDING_FEATURES,
  LANDING_HOW_TO_PLAY,
  LANDING_FIXTURE_MATCHES,
  LANDING_RANKING,
  TEAM_NAME_ES,
} from './landingDemoData'
import { DEFAULT_RULESET } from '../config/ruleset'
import { ADVANCEMENT_POINTS, KO_EXACT_SCORE_BY_ROUND, MATCH_POINTS_BY_PHASE } from '../services/scoring'
import { LandingBracketBoard } from './components/LandingBracketBoard'
import { LandingRankMovement } from './components/LandingRankMovement'
import { TeamFlagName } from '../predictions/TeamFlagName'

const POINT_TABS = [
  { id: 'grupos' as const, label: 'Grupos' },
  { id: 'ko' as const, label: 'Eliminatorias' },
  { id: 'avance' as const, label: 'Avance' },
  { id: 'especiales' as const, label: 'Especiales' },
]

const gr = MATCH_POINTS_BY_PHASE.group
const ko = MATCH_POINTS_BY_PHASE.knockout
const koRounds = ['r32', 'r16', 'qf', 'sf', 'third', 'final'] as const

const GROUP_POINTS_MATRIX = {
  headers: ['Grupos', 'R32', 'R16', 'QF', 'SF', '3ro', 'Final'],
  rows: [
    {
      label: 'Ganador / empate',
      values: [gr.winnerOrDraw, ...koRounds.map((r) => ko[r].winnerOrDraw)],
    },
    {
      label: 'Goles Selección A',
      values: [gr.goalsTeamA, ...koRounds.map((r) => ko[r].goalsTeamA)],
    },
    {
      label: 'Goles Selección B',
      values: [gr.goalsTeamB, ...koRounds.map((r) => ko[r].goalsTeamB)],
    },
    {
      label: 'Máximo posible',
      values: [5, ...koRounds.map((r) => KO_EXACT_SCORE_BY_ROUND[r])],
      max: true,
    },
  ],
}

const KNOCKOUT_POINTS_TABLE = {
  headers: ['R32', 'R16', 'QF', 'SF', '3ro', 'Final'],
  rows: [
    {
      label: 'Máximo por partido',
      values: koRounds.map((r) => KO_EXACT_SCORE_BY_ROUND[r]),
      max: true,
    },
  ],
}

const ADVANCEMENT_POINTS_TABLE = {
  headers: ['Puntos'],
  rows: [
    { label: 'Clasifica a dieciseisavos (R32)', values: [ADVANCEMENT_POINTS.toR32] },
    { label: 'Clasifica a octavos (R16)', values: [ADVANCEMENT_POINTS.toR16] },
    { label: 'Clasifica a cuartos (QF)', values: [ADVANCEMENT_POINTS.toQf] },
    { label: 'Clasifica a semifinal (SF)', values: [ADVANCEMENT_POINTS.toSf] },
    { label: 'Clasifica a la final', values: [ADVANCEMENT_POINTS.toFinal] },
    { label: 'Podio: tercero / sub / campeón', values: [ADVANCEMENT_POINTS.thirdPlace] },
    { label: 'Subcampeón', values: [ADVANCEMENT_POINTS.runnerUp] },
    { label: 'Campeón', values: [ADVANCEMENT_POINTS.champion], max: true },
  ],
}

const SPECIAL_POINTS_TABLE = {
  headers: ['Puntos'],
  rows: [
    { label: 'Goleador del torneo', values: [DEFAULT_RULESET.points.specials.topScorer] },
    { label: 'Mejor arquero (promedio)', values: [DEFAULT_RULESET.points.specials.bestGoalkeeperAverage] },
    { label: 'Pregunta bonus (c/u)', values: [DEFAULT_RULESET.points.specials.bonusQuestion], max: true },
  ],
}

function PointsTable({
  headers,
  rows,
}: {
  headers: readonly string[]
  rows: ReadonlyArray<{ label: string; values: readonly number[]; max?: boolean }>
}) {
  return (
    <div className="landing-points-table-wrap">
      <table className="landing-points-table">
        <thead>
          <tr>
            <th scope="col">Acierto</th>
            {headers.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className={row.max ? 'is-max' : undefined}>
              <th scope="row">{row.label}</th>
              {row.values.map((v, idx) => (
                <td key={`${row.label}-${idx}`}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PointsPanel({ tab }: { tab: (typeof POINT_TABS)[number]['id'] }) {
  if (tab === 'grupos') {
    return <PointsTable headers={GROUP_POINTS_MATRIX.headers} rows={GROUP_POINTS_MATRIX.rows} />
  }
  if (tab === 'ko') {
    return <PointsTable headers={KNOCKOUT_POINTS_TABLE.headers} rows={KNOCKOUT_POINTS_TABLE.rows} />
  }
  if (tab === 'avance') {
    return <PointsTable headers={ADVANCEMENT_POINTS_TABLE.headers} rows={ADVANCEMENT_POINTS_TABLE.rows} />
  }
  return <PointsTable headers={SPECIAL_POINTS_TABLE.headers} rows={SPECIAL_POINTS_TABLE.rows} />
}

export function LandingPage({ uiControl }: { uiControl?: UiControl }) {
  const [pointTab, setPointTab] = useState<(typeof POINT_TABS)[number]['id']>('grupos')

  return (
    <div className="landing-root">
      <LandingNavbar uiControl={uiControl} />
      <main id="top">
        <LandingHero />

        <LandingSection tone="cream">
          <div className="landing-section__head landing-section__head--center">
            <p className="landing-label">Por qué Prode 26</p>
            <h2 id="que-es-title" className="landing-display landing-display--sm">
              Todo lo que necesitas para competir
            </h2>
          </div>
          <div className="landing-cards-grid landing-cards-grid--3">
            {LANDING_FEATURES.map((f) => (
              <article key={f.title} className="landing-card">
                <div className="landing-card__icon" aria-hidden>
                  {f.icon}
                </div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </article>
            ))}
          </div>
        </LandingSection>

        <LandingSection id="como-jugar" tone="cream">
          <div className="landing-how-play__head">
            <LandingBadge variant="lime">Guía rápida</LandingBadge>
            <h2 className="landing-display landing-display--sm landing-how-play__title">
              Cómo jugar sin perderse en las reglas
            </h2>
            <p className="landing-how-play__lead">
              La experiencia está diseñada como un recorrido progresivo: primero entiendes la dinámica,
              luego completas tus pronósticos y finalmente ves cómo se calculan tus puntos.
            </p>
          </div>
          <div className="landing-how-play__grid">
            {LANDING_HOW_TO_PLAY.map((step, i) => (
              <article key={step.title} className="landing-how-play__card">
                <span className="landing-how-play__icon" aria-hidden>
                  {i + 1}
                </span>
                <h3 className="landing-how-play__card-title">{step.title}</h3>
                <p className="landing-how-play__card-desc">{step.desc}</p>
              </article>
            ))}
          </div>
        </LandingSection>

        <LandingSection id="puntos" tone="cream">
          <div className="landing-section__head">
            <p className="landing-label">Reglas</p>
            <h2 className="landing-display landing-display--sm">Sistema de puntos</h2>
            <p className="landing-muted landing-points-caption">
              Esta tabla muestra cómo se suman puntos por acierto en cada fase del torneo.
            </p>
          </div>
          <LandingPillTabs
            tabs={POINT_TABS}
            active={pointTab}
            onChange={setPointTab}
            ariaLabel="Categorías de puntuación"
          />
          <div className={`landing-points-panel${pointTab === 'grupos' ? ' landing-points-panel--table' : ''}`}>
            <PointsPanel tab={pointTab} />
          </div>
        </LandingSection>

        <LandingSection id="fixture" tone="navy">
          <div className="landing-section__head">
            <p className="landing-label">Calendario</p>
            <h2 className="landing-display landing-display--sm">Fixture interactivo</h2>
          </div>
          <div className="landing-fixture-grid">
            {LANDING_FIXTURE_MATCHES.map((m) => (
              <article key={m.matchId} className="landing-fixture-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <LandingBadge variant="slate">Grupo {m.groupId}</LandingBadge>
                  <LandingBadge variant={m.status === 'guardado' ? 'emerald' : 'slate'}>
                    {m.status === 'guardado' ? 'Guardado' : 'Pendiente'}
                  </LandingBadge>
                </div>
                <div className="landing-fixture-card__teams">
                  <TeamFlagName
                    teamId={m.teamHomeId}
                    name={TEAM_NAME_ES[m.teamHomeId] ?? m.teamHomeId}
                    size={24}
                    compact
                  />
                  <span className="landing-fixture-vs">vs</span>
                  <TeamFlagName
                    teamId={m.teamAwayId}
                    name={TEAM_NAME_ES[m.teamAwayId] ?? m.teamAwayId}
                    size={24}
                    compact
                  />
                </div>
                <div className="landing-fixture-card__meta">
                  <span>{m.city}</span>
                  <span>+{m.potentialPts} pts</span>
                </div>
              </article>
            ))}
          </div>
        </LandingSection>

        <LandingSection tone="cream" compactEdge="bottom">
          <div className="landing-section__head landing-section__head--center">
            <p className="landing-label">Eliminatorias</p>
            <h2 className="landing-display landing-display--sm">Bracket del torneo</h2>
          </div>
          <div className="landing-bracket-wrap">
            <LandingBracketBoard />
          </div>
        </LandingSection>

        <LandingSection id="ranking" tone="cream" compactEdge="top">
          <div className="landing-section__head">
            <p className="landing-label">Clasificación</p>
            <h2 className="landing-display landing-display--sm">Ranking en vivo</h2>
            <p className="landing-muted">Demo de sala — los puntos se actualizan solos al cerrar partidos.</p>
          </div>
          <div className="landing-card landing-card--ranking">
            <LandingProgressBar value={72} />
            <p className="landing-muted" style={{ fontSize: '0.8125rem', margin: '0.5rem 0 1.25rem' }}>
              Temporada sala «Mundial 2026» · 72% del torneo disputado
            </p>
            <table className="landing-rank-table">
              <thead>
                <tr>
                  <th className="landing-rank-table__center landing-rank-table__col-rank" scope="col">
                    #
                  </th>
                  <th className="landing-rank-table__player" scope="col">
                    Jugador
                  </th>
                  <th className="landing-rank-table__center" scope="col">
                    Pts
                  </th>
                  <th className="landing-rank-table__center" scope="col">
                    Exactos
                  </th>
                  <th className="landing-rank-table__center" scope="col">
                    Trend
                  </th>
                  <th className="landing-rank-table__center landing-rank-table__col-mov" scope="col">
                    Mov.
                  </th>
                </tr>
              </thead>
              <tbody>
                {LANDING_RANKING.map((row) => (
                  <tr key={row.rank} className={row.highlight ? 'highlight' : undefined}>
                    <td className="landing-rank-table__center landing-rank-table__col-rank">
                      <span
                        className={`landing-rank-pos${row.rank <= 3 ? ` landing-rank-pos--${row.rank}` : ''}`}
                      >
                        {row.rank}
                      </span>
                    </td>
                    <td className="landing-rank-table__player">{row.name}</td>
                    <td className="landing-rank-table__center">
                      <strong>{row.pts}</strong>
                    </td>
                    <td className="landing-rank-table__center">{row.exact}</td>
                    <td className="landing-rank-table__center landing-rank-table__trend">{row.trend}</td>
                    <td className="landing-rank-table__center landing-rank-table__col-mov">
                      <LandingRankMovement delta={row.rankDelta} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </LandingSection>

        <section className="landing-final-cta" aria-labelledby="landing-cta-title">
          <div className="landing-container">
            <p className="landing-label">Listo para jugar</p>
            <h2 id="landing-cta-title" className="landing-display landing-display--sm">
              Entra al torneo con tu crew
            </h2>
            <p>Crea tu cuenta, únete a una sala y empieza a sumar antes del pitazo inicial.</p>
            <ParticiparLink className="landing-btn landing-btn--gold landing-btn--lg" />
            <p style={{ marginTop: '1.5rem' }}>
              <Link to="/reglamento" className="landing-footer" style={{ border: 'none', padding: 0 }}>
                Leer reglamento completo
              </Link>
            </p>
          </div>
        </section>
      </main>
      <footer className="landing-footer landing-container">
        Prode 26 · Mundial 2026 · No afiliado a FIFA
      </footer>
    </div>
  )
}
