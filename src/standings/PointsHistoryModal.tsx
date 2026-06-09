import { useState } from 'react'
import type {
  PointsHistory,
  PointsHistoryBracketRow,
  PointsHistoryMatchRow,
  PointsHistoryQuestionRow,
} from '../domain/pointsHistory'
import { BONUS_QUESTION_IDS, EXTRA_IDS } from '../data/questionIds'

type Props = {
  history: PointsHistory | null
  loading: boolean
  error: string | null
  subjectDisplayName?: string
  onClose: () => void
}

type HistoryTab = 'matches' | 'bracket' | 'extras'

const PODIUM_IDS = new Set<string>([
  EXTRA_IDS.champion,
  EXTRA_IDS.runnerUp,
  EXTRA_IDS.thirdPlace,
  EXTRA_IDS.fourthPlace,
])

function MatchHistoryCard({ row }: { row: PointsHistoryMatchRow }) {
  return (
    <article className="points-history-card">
      <header className="points-history-card__head">
        <span className="points-history-card__badge">#{row.matchNumber}</span>
        <h4 className="points-history-card__title">{row.matchupLabel}</h4>
        <span className="points-history-card__total">
          <strong>{row.total}</strong> pts
        </span>
      </header>
      <dl className="points-history-card__grid">
        <div className="points-history-card__item">
          <dt>Resultado</dt>
          <dd>{row.officialScore}</dd>
        </div>
        <div className="points-history-card__item">
          <dt>Predicción</dt>
          <dd>{row.predictionScore}</dd>
        </div>
        <div className="points-history-card__item">
          <dt>Jugador</dt>
          <dd>{row.playerLabel}</dd>
        </div>
        <div className="points-history-card__item points-history-card__item--scores">
          <dt>Puntos</dt>
          <dd>
            Marcador <strong>{row.matchPoints}</strong>
            {row.playerBonusPoints > 0 ? (
              <>
                {' · '}
                Bonus <strong>{row.playerBonusPoints}</strong>
              </>
            ) : null}
          </dd>
        </div>
      </dl>
    </article>
  )
}

function BracketAdvancementCard({ row }: { row: PointsHistoryBracketRow }) {
  return (
    <article className="points-history-card points-history-card--bracket">
      <header className="points-history-card__head points-history-card__head--question">
        <h4 className="points-history-card__title">{row.teamLabel}</h4>
        <span className="points-history-card__total">
          <strong>+{row.points}</strong> pts
        </span>
      </header>
      <p className="points-history-card__bracket-note app-muted">
        En tu cuadro predicho llegó a <strong>{row.roundLabel}</strong> y el torneo real confirmó que
        esa selección participó en esa fase.
      </p>
    </article>
  )
}

function QuestionHistoryCard({ row }: { row: PointsHistoryQuestionRow }) {
  return (
    <article className="points-history-card">
      <header className="points-history-card__head points-history-card__head--question">
        <h4 className="points-history-card__title">{row.questionLabel}</h4>
        <span className="points-history-card__total">
          <strong>{row.points}</strong> pts
        </span>
      </header>
      <dl className="points-history-card__grid points-history-card__grid--single">
        <div className="points-history-card__item">
          <dt>Respuesta oficial</dt>
          <dd>{row.officialAnswer}</dd>
        </div>
        <div className="points-history-card__item">
          <dt>Predicción</dt>
          <dd>{row.predictionAnswer}</dd>
        </div>
      </dl>
    </article>
  )
}

export function PointsHistoryModal({ history, loading, error, subjectDisplayName, onClose }: Props) {
  const title = subjectDisplayName
    ? `Historial de ${subjectDisplayName}`
    : 'Historial de puntuaciones'
  const [tab, setTab] = useState<HistoryTab>('matches')

  const podiumRows =
    history?.questionRows.filter((r) => PODIUM_IDS.has(r.questionId)) ?? []
  const extraRows =
    history?.questionRows.filter(
      (r) =>
        !PODIUM_IDS.has(r.questionId) &&
        (BONUS_QUESTION_IDS as readonly string[]).includes(r.questionId),
    ) ?? []
  const otherQuestionRows =
    history?.questionRows.filter(
      (r) => !PODIUM_IDS.has(r.questionId) && !(BONUS_QUESTION_IDS as readonly string[]).includes(r.questionId),
    ) ?? []

  return (
    <div className="modal-overlay pred-rules-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-card pred-rules-modal points-history-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="points-history-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="points-history-title">{title}</h2>
          <button type="button" className="modal-close" aria-label="Cerrar" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="pred-rules-modal__body points-history-modal__body">
          {loading ? <p className="user-email">Cargando historial…</p> : null}
          {error ? <p className="auth-error">{error}</p> : null}

          {!loading && !error && history ? (
            <>
              <div className="points-history-summary">
                {history.totalPoints === 0 &&
                history.matchRows.length === 0 &&
                history.bracketRows.length === 0 &&
                history.questionRows.length === 0 ? (
                  <p className="app-muted" style={{ marginTop: 0 }}>
                    No participás en la clasificación de esta sala hasta que guardes y finalices tu
                    predicción. Los borradores o datos de prueba no suman en el ranking.
                  </p>
                ) : null}
                <p className="points-history-summary__total">
                  Puntaje acumulado: <strong>{history.totalPoints}</strong> pts
                </p>
                <ul className="points-history-summary__chips" aria-label="Desglose de puntos">
                  <li>
                    <span className="points-history-chip__label">Resultados partidos</span>
                    <span className="points-history-chip__value">{history.display.matchAndPlayer}</span>
                  </li>
                  {history.display.podium > 0 ? (
                    <li>
                      <span className="points-history-chip__label">Podio</span>
                      <span className="points-history-chip__value">{history.display.podium}</span>
                    </li>
                  ) : null}
                  {history.display.specials > 0 ? (
                    <li>
                      <span className="points-history-chip__label">Preguntas extra</span>
                      <span className="points-history-chip__value">{history.display.specials}</span>
                    </li>
                  ) : null}
                  {history.display.bracket > 0 ? (
                    <li>
                      <span className="points-history-chip__label">Avance en llave</span>
                      <span className="points-history-chip__value">{history.display.bracket}</span>
                    </li>
                  ) : null}
                </ul>
                <p className="points-history-summary__sum app-muted">
                  Suma del desglose:{' '}
                  <strong>
                    {history.display.matchAndPlayer +
                      history.display.podium +
                      history.display.specials +
                      history.display.bracket}
                  </strong>{' '}
                  pts
                </p>
              </div>

              {history.detailOutOfSync ? (
                <p className="points-history-sync-note auth-info">
                  El detalle por filas ({history.detailMatchSum + history.detailPodiumSum + history.detailSpecialsSum + history.detailBracketSum} pts) no coincide con la clasificación ({history.totalPoints} pts). La tabla de ranking es la referencia.
                </p>
              ) : null}

              <div
                className="points-history-tabs"
                role="tablist"
                aria-label="Secciones del historial"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'matches'}
                  className={`points-history-tabs__btn${tab === 'matches' ? ' is-active' : ''}`}
                  onClick={() => setTab('matches')}
                >
                  Resultados partidos
                  {history.display.matchAndPlayer > 0 ? (
                    <span className="points-history-tabs__pts">{history.display.matchAndPlayer}</span>
                  ) : null}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'bracket'}
                  className={`points-history-tabs__btn${tab === 'bracket' ? ' is-active' : ''}`}
                  onClick={() => setTab('bracket')}
                >
                  Avance en llave
                  {history.display.bracket > 0 ? (
                    <span className="points-history-tabs__pts">{history.display.bracket}</span>
                  ) : null}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'extras'}
                  className={`points-history-tabs__btn${tab === 'extras' ? ' is-active' : ''}`}
                  onClick={() => setTab('extras')}
                >
                  Podio y extra
                  {history.display.podium + history.display.specials > 0 ? (
                    <span className="points-history-tabs__pts">
                      {history.display.podium + history.display.specials}
                    </span>
                  ) : null}
                </button>
              </div>

              <div className="points-history-panel" role="tabpanel">
                {tab === 'matches' ? (
                  <>
                    <p className="points-history-panel__lead app-muted">
                      Puntos por acertar marcador, ganador/empate y goles en cada partido terminado
                      (más bonus de jugador por partido si aplica).
                    </p>
                    {history.matchRows.length === 0 ? (
                      <p className="app-muted">Todavía no sumaste puntos por partidos terminados.</p>
                    ) : (
                      <>
                        <div className="points-history-list">
                          {history.matchRows.map((row) => (
                            <MatchHistoryCard
                              key={`${row.matchNumber}-${row.matchupLabel}`}
                              row={row}
                            />
                          ))}
                        </div>
                        <p className="points-history-section-sum app-muted">
                          Subtotal: <strong>{history.detailMatchSum}</strong> pts
                          {history.display.matchAndPlayer !== history.detailMatchSum ? (
                            <> · en ranking: {history.display.matchAndPlayer} pts</>
                          ) : null}
                        </p>
                      </>
                    )}
                  </>
                ) : null}

                {tab === 'bracket' ? (
                  <>
                    <p className="points-history-panel__lead app-muted">
                      Por cada selección que tenías en tu cuadro predicho y que el torneo real jugó
                      en esa ronda, sumás +2 (R32), +4 (octavos), +6 (cuartos), +8 (semis) o +10
                      (final).
                    </p>
                    {history.bracketRows.length === 0 ? (
                      <p className="app-muted">Sin puntos por avance en llave todavía.</p>
                    ) : (
                      <>
                        <div className="points-history-list">
                          {history.bracketRows.map((row) => (
                            <BracketAdvancementCard
                              key={`${row.teamId}-${row.roundLabel}`}
                              row={row}
                            />
                          ))}
                        </div>
                        <p className="points-history-section-sum app-muted">
                          Subtotal: <strong>{history.detailBracketSum}</strong> pts
                          {history.display.bracket !== history.detailBracketSum ? (
                            <> · en ranking: {history.display.bracket} pts</>
                          ) : null}
                        </p>
                      </>
                    )}
                  </>
                ) : null}

                {tab === 'extras' ? (
                  <>
                    <p className="points-history-panel__lead app-muted">
                      Campeón, subcampeón, tercer y cuarto puesto, goleador del torneo, mejor arquero
                      y preguntas del banco.
                    </p>
                    {podiumRows.length === 0 &&
                    extraRows.length === 0 &&
                    otherQuestionRows.length === 0 ? (
                      <p className="app-muted">Sin puntos por podio o preguntas resueltas todavía.</p>
                    ) : (
                      <>
                        {podiumRows.length > 0 ? (
                          <>
                            <h3 className="points-history-subsection-title">Podio</h3>
                            <div className="points-history-list">
                              {podiumRows.map((row) => (
                                <QuestionHistoryCard key={row.questionId} row={row} />
                              ))}
                            </div>
                          </>
                        ) : null}
                        {extraRows.length > 0 || otherQuestionRows.length > 0 ? (
                          <>
                            <h3 className="points-history-subsection-title">Preguntas extra</h3>
                            <div className="points-history-list">
                              {[...extraRows, ...otherQuestionRows].map((row) => (
                                <QuestionHistoryCard key={row.questionId} row={row} />
                              ))}
                            </div>
                          </>
                        ) : null}
                        <p className="points-history-section-sum app-muted">
                          Subtotal podio: <strong>{history.detailPodiumSum}</strong> · extra:{' '}
                          <strong>{history.detailSpecialsSum}</strong> pts
                        </p>
                      </>
                    )}
                  </>
                ) : null}
              </div>
            </>
          ) : null}
        </div>

        <div className="button-group pred-save-modal-actions points-history-modal__footer">
          <button
            type="button"
            className="btn-secondary pred-save-modal-btn pred-save-modal-btn--cancel"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
