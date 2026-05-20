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
import { LandingTooltip } from './components/LandingTooltip'
import { ParticiparLink } from './components/ParticiparLink'
import {
  LANDING_FEATURES,
  LANDING_HOW_TO_PLAY,
  LANDING_FIXTURE_MATCHES,
  LANDING_RANKING,
  TEAM_NAME_ES,
} from './landingDemoData'
import { DEFAULT_RULESET } from '../config/ruleset'
import { LandingBracketBoard } from './components/LandingBracketBoard'
import { TeamFlagName } from '../predictions/TeamFlagName'

const POINT_TABS = [
  { id: 'grupos' as const, label: 'Grupos' },
  { id: 'ko' as const, label: 'Eliminatorias' },
  { id: 'avance' as const, label: 'Avance' },
  { id: 'especiales' as const, label: 'Especiales' },
]

const p = DEFAULT_RULESET.points

function PointsPanel({ tab }: { tab: (typeof POINT_TABS)[number]['id'] }) {
  if (tab === 'grupos') {
    return (
      <ul>
        <li>
          Marcador exacto: <strong>+{p.group.exactScore}</strong> pts
        </li>
        <li>
          Un marcador correcto: <strong>+{p.group.oneScoreHit}</strong> · Ganador o empate:{' '}
          <strong>+{p.group.winnerOrDrawHit}</strong>
        </li>
      </ul>
    )
  }
  if (tab === 'ko') {
    return (
      <ul>
        <li>
          Exacto por ronda: R32 <strong>{p.knockout.exactScoreByRound.r32}</strong>, R16{' '}
          <strong>{p.knockout.exactScoreByRound.r16}</strong>, QF{' '}
          <strong>{p.knockout.exactScoreByRound.qf}</strong>, SF{' '}
          <strong>{p.knockout.exactScoreByRound.sf}</strong>, 3.er{' '}
          <strong>{p.knockout.exactScoreByRound.third}</strong>, Final{' '}
          <strong>{p.knockout.exactScoreByRound.final}</strong>
        </li>
        <li>
          Sin exacto: un marcador <strong>+{p.knockout.oneScoreHitWhenNotExact}</strong>, resultado{' '}
          <strong>+{p.knockout.winnerHitWhenNotExact}</strong>
        </li>
      </ul>
    )
  }
  if (tab === 'avance') {
    return (
      <ul>
        <li>
          Campeón <strong>+{p.advancement.champion}</strong> · Subcampeón{' '}
          <strong>+{p.advancement.runnerUp}</strong> · 3.er puesto{' '}
          <strong>+{p.advancement.thirdPlace}</strong>
        </li>
        <li>
          Llaves: a 16avos <strong>+{p.advancement.toR16}</strong>, cuartos{' '}
          <strong>+{p.advancement.toQf}</strong>, semis <strong>+{p.advancement.toSf}</strong>, final{' '}
          <strong>+{p.advancement.toFinal}</strong>
        </li>
      </ul>
    )
  }
  return (
    <ul>
      <li>
        Goleador del torneo: <strong>+{p.specials.topScorer}</strong>
      </li>
      <li>
        Mejor portero (promedio): <strong>+{p.specials.bestGoalkeeperAverage}</strong>
      </li>
      <li>
        Pregunta bonus: <strong>+{p.specials.bonusQuestion}</strong> c/u
      </li>
    </ul>
  )
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
            <h2 className="landing-display landing-display--sm">
              <LandingTooltip
                label="Sistema de puntos"
                tip="Los mismos valores del reglamento oficial de la app."
              />
            </h2>
          </div>
          <LandingPillTabs
            tabs={POINT_TABS}
            active={pointTab}
            onChange={setPointTab}
            ariaLabel="Categorías de puntuación"
          />
          <div className="landing-points-panel">
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
          <div className="landing-card" style={{ padding: '1.5rem 2rem' }}>
            <LandingProgressBar value={72} />
            <p className="landing-muted" style={{ fontSize: '0.8125rem', margin: '0.5rem 0 1.25rem' }}>
              Temporada sala «Mundial 2026» · 72% del torneo disputado
            </p>
            <table className="landing-rank-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Jugador</th>
                  <th>Pts</th>
                  <th>Exactos</th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                {LANDING_RANKING.map((row) => (
                  <tr key={row.rank} className={row.highlight ? 'highlight' : undefined}>
                    <td>
                      <span
                        className={`landing-rank-pos${row.rank <= 3 ? ` landing-rank-pos--${row.rank}` : ''}`}
                      >
                        {row.rank}
                      </span>
                    </td>
                    <td>{row.name}</td>
                    <td>
                      <strong>{row.pts}</strong>
                    </td>
                    <td>{row.exact}</td>
                    <td style={{ color: 'var(--landing-emerald)' }}>{row.trend}</td>
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
