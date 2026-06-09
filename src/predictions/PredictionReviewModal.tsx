import type { MatchDoc, PredictionDoc } from '../types/predictions'
import { usePlayerPerMatchPicks } from '../hooks/usePlayerPerMatchPicks'
import { usePlayerPickDisplayLabels } from '../hooks/usePlayerPickDisplayLabels'
import { KnockoutSection } from './KnockoutSection'
import { GroupStageSection } from './GroupStageSection'
import { PodiumReadOnlyDisplay } from './PodiumReadOnlyDisplay'
import { TournamentSpecialPlayersSection } from './TournamentSpecialPlayersSection'
import { BonusQuestionBank } from './BonusQuestionBank'
import { usePredictionReviewData } from './usePredictionReviewData'

type Props = {
  roomId: string
  subjectUserId: string
  subjectDisplayName: string
  isOwnPrediction?: boolean
  predictions: PredictionDoc[]
  matches: (MatchDoc & { id: string })[]
  teamLabel: (id: string | null | undefined) => string
  enabledQuestionIds: Set<string> | null
  loading: boolean
  error: string | null
  onClose: () => void
}

const noopKo = () => {}
const noopGroup = () => {}
const noopBonus = () => {}

export function PredictionReviewModal({
  roomId,
  subjectUserId,
  subjectDisplayName,
  isOwnPrediction = false,
  predictions,
  matches,
  teamLabel,
  enabledQuestionIds,
  loading,
  error,
  onClose,
}: Props) {
  const review = usePredictionReviewData(predictions, matches, enabledQuestionIds)
  const hasActiveBonusQuestions = review.activeQuestionMetas.length > 0
  const { picksByMatchId } = usePlayerPerMatchPicks(roomId, subjectUserId)
  const { labelByMatchId } = usePlayerPickDisplayLabels(matches, picksByMatchId)
  const bonusPlayerLabelByMatchId = new Map(Object.entries(labelByMatchId))

  const title = isOwnPrediction ? 'Mi predicción' : `Predicción de ${subjectDisplayName}`

  return (
    <div
      className="modal-overlay pred-rules-modal-overlay prediction-review-modal-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="modal-card pred-rules-modal prediction-review-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prediction-review-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="prediction-review-title">{title}</h2>
          <button type="button" className="modal-close" aria-label="Cerrar" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="pred-rules-modal__body prediction-review-modal__body">
          <p className="prediction-review-modal__lead app-muted">
            {isOwnPrediction
              ? 'Vista de solo lectura. No se modifican tus respuestas ni la clasificación.'
              : 'Vista pública de solo lectura para verificar pronósticos y jugadores bonus por partido.'}
          </p>

          {loading ? <p className="user-email">Cargando predicción…</p> : null}
          {error ? <p className="auth-error">{error}</p> : null}

          {!loading && !error ? (
            <div className="prediction-review-modal__content pred-wc26">
              {review.groupMatches.length > 0 ? (
                <div className="pred-group-progress prediction-review-modal__progress" aria-live="polite">
                  <div
                    className="pred-group-progress-bar"
                    role="progressbar"
                    aria-valuenow={review.filledOverall}
                    aria-valuemin={0}
                    aria-valuemax={review.totalOverall}
                  >
                    <div
                      className="pred-group-progress-fill"
                      style={{
                        width: `${review.totalOverall > 0 ? Math.round((review.filledOverall / review.totalOverall) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <span className="pred-group-progress-text">
                    {review.filledOverall} / {review.totalOverall} partidos (grupos + eliminatorias)
                  </span>
                </div>
              ) : null}

              <PodiumReadOnlyDisplay
                teamLabel={teamLabel}
                firstId={review.podiumIds.firstId}
                secondId={review.podiumIds.secondId}
                thirdId={review.podiumIds.thirdId}
                fourthId={review.podiumIds.fourthId}
                sectionIndex={1}
              />
              <KnockoutSection
                groupPredByMatchId={review.groupPredForBracket}
                koPredByMatchId={review.koPredByMatchId}
                matchesByKoId={review.matchesByKoId}
                teamLabel={teamLabel}
                onKoDraftChange={noopKo}
                readOnly
                layoutMode="review"
                sectionIndex={2}
                showPoints
                bonusPlayerLabelByMatchId={bonusPlayerLabelByMatchId}
              />
              {review.groupMatches.length > 0 ? (
                <GroupStageSection
                  matchesByGroup={review.matchesByGroup}
                  draftByMatchId={review.draftGroup}
                  filledMatchIds={review.filledGroupMatchIds}
                  onDraftChange={noopGroup}
                  teamLabel={teamLabel}
                  groupLocked
                  sectionIndex={3}
                  showPoints
                  bonusPlayerLabelByMatchId={bonusPlayerLabelByMatchId}
                />
              ) : null}
              <TournamentSpecialPlayersSection
                roomId={roomId}
                userId={subjectUserId}
                predByQuestionId={review.predByQuestionId}
                readOnly
              />
              {hasActiveBonusQuestions ? (
                <BonusQuestionBank
                  questionMetas={review.activeQuestionMetas}
                  mergedBonusByQuestionId={review.mergedBonusByQuestionId}
                  matchPickOptions={[]}
                  groupIds={[]}
                  onBonusDraftChange={noopBonus}
                  incompleteQuestionIds={new Set()}
                  readOnly
                  sectionIndex={4}
                />
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="button-group pred-save-modal-actions prediction-review-modal__footer">
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
