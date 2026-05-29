import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useMatchList } from '../hooks/useMatchList'
import { usePredictions } from '../hooks/usePredictions'
import { useStandings } from '../hooks/useStandings'
import { useTeamLabels } from '../hooks/useTeamLabels'
import { useTournamentResults } from '../hooks/useTournamentResults'
import { buildPointsHistory } from '../domain/pointsHistory'
import { PredictionScoringHelpBody } from '../predictions/PredictionScoringHelpBody'
import type { AccountOutletContext } from '../types/outletContext'
import type { RoomDoc } from '../types/predictions'
import { getPredictionFinalized } from '../services/predictionStateService'
import { getRoom } from '../services/roomsService'
import { InviteCodeQuickStrip } from '../rooms/InviteCodeQuickStrip'
import { PrivateRoomAdminModal } from '../rooms/PrivateRoomAdminModal'
import { RoomInviteModal } from '../rooms/RoomInviteModal'
import { RoomHomePlayerPickBanner } from '../predictions/RoomHomePlayerPickBanner'
import { useRoomStandingsMeta } from '../hooks/useRoomStandingsMeta'
import { StandingsLeaderboard } from '../standings/StandingsLeaderboard'
import { StandingsMyStatusCard } from '../standings/StandingsMyStatusCard'
import { StandingsPageHeader } from '../standings/StandingsPageHeader'
import { PointsHistoryModal } from '../standings/PointsHistoryModal'
import { PredictionReviewModal } from '../predictions/PredictionReviewModal'
import { StandingsParticipationCard } from '../standings/StandingsParticipationCard'
import { StandingsPrizePoolCard } from '../standings/StandingsPrizePoolCard'
import { roomHasBonusQuestions } from '../utils/roomBonusQuestions'
import '../predictions/pred-theme.css'
import '../standings/standings-dashboard.css'

const predictionPromptStorageKey = (id: string) => `wc26_room_prediction_prompt:${id}`

export function RoomStandingsPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { user } = useOutletContext<AccountOutletContext>()
  const { standings, error, loading, isGlobalRoom } = useStandings(roomId, user?.uid)
  const meta = useRoomStandingsMeta(roomId, standings)
  const [showScoringHelpModal, setShowScoringHelpModal] = useState(false)
  const [room, setRoom] = useState<RoomDoc | null>(null)
  const [showAdmin, setShowAdmin] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showPredictionPrompt, setShowPredictionPrompt] = useState(false)
  const [showPointsHistory, setShowPointsHistory] = useState(false)
  const [showPredictionReview, setShowPredictionReview] = useState(false)
  const [predictionFinalized, setPredictionFinalized] = useState<boolean | null>(null)
  const { matches } = useMatchList()
  const { predictions, loading: loadingPredictions } = usePredictions(roomId, user?.uid)
  const { label: teamLabel } = useTeamLabels()
  const {
    tournamentResultsByQuestionId,
    loading: loadingTournamentResults,
    error: tournamentResultsError,
  } = useTournamentResults()

  useEffect(() => {
    if (!roomId || !user) {
      setPredictionFinalized(null)
      return
    }
    let cancelled = false
    void getPredictionFinalized(user.uid, roomId).then((done) => {
      if (!cancelled) setPredictionFinalized(done)
    })
    return () => {
      cancelled = true
    }
  }, [roomId, user])

  useEffect(() => {
    if (!roomId || !user) {
      setShowPredictionPrompt(false)
      return
    }
    if (predictionFinalized === null) return
    if (predictionFinalized === true) {
      setShowPredictionPrompt(false)
      try {
        sessionStorage.setItem(predictionPromptStorageKey(roomId), '1')
      } catch {
        /* ignore */
      }
      return
    }
    try {
      setShowPredictionPrompt(!sessionStorage.getItem(predictionPromptStorageKey(roomId)))
    } catch {
      setShowPredictionPrompt(true)
    }
  }, [roomId, user, predictionFinalized])

  function dismissPredictionPrompt() {
    if (roomId) {
      try {
        sessionStorage.setItem(predictionPromptStorageKey(roomId), '1')
      } catch {
        /* ignore */
      }
    }
    setShowPredictionPrompt(false)
  }

  function goToPredictions() {
    dismissPredictionPrompt()
    if (roomId) navigate(`/room/${roomId}/predictions`)
  }

  useEffect(() => {
    if (!roomId) return
    let cancelled = false
    getRoom(roomId)
      .then((data) => {
        if (!cancelled) setRoom(data)
      })
      .catch(() => {
        if (!cancelled) setRoom(null)
      })
    return () => {
      cancelled = true
    }
  }, [roomId])

  const canManageRoom = Boolean(
    user && room && room.type === 'private' && room.createdBy === user.uid && roomId !== 'global',
  )
  const showSpecialsColumn = roomHasBonusQuestions(room, isGlobalRoom)
  const myStandingRow = standings.find((row) => row.isCurrentUser)

  const enabledQuestionIds = useMemo(() => {
    if (isGlobalRoom || !room?.enabledQuestionIds?.length) return null
    return new Set(room.enabledQuestionIds)
  }, [isGlobalRoom, room?.enabledQuestionIds])

  const pointsHistory = useMemo(() => {
    if (!user?.uid) return null
    return buildPointsHistory({
      predictions,
      matches,
      tournamentResultsByQuestionId,
      teamLabel,
      enabledQuestionIds,
      standingPoints: myStandingRow?.points,
      standingBreakdown: myStandingRow?.breakdown,
      countsForStandings: predictionFinalized === true,
    })
  }, [
    predictions,
    matches,
    tournamentResultsByQuestionId,
    teamLabel,
    enabledQuestionIds,
    user?.uid,
    myStandingRow?.points,
    myStandingRow?.breakdown,
    predictionFinalized,
  ])

  const pointsHistoryLoading = loadingPredictions || loadingTournamentResults
  const pointsHistoryError = tournamentResultsError
  const standingsSubtitle = isGlobalRoom
    ? 'Sala global · Top 50'
    : room?.name
      ? `Sala «${room.name}»`
      : 'Miembros de la sala privada'

  async function refreshRoomDoc() {
    if (!roomId) return
    try {
      const data = await getRoom(roomId)
      setRoom(data)
    } catch {
      setRoom(null)
    }
  }

  if (!roomId) return <p className="auth-error">Sala no válida</p>

  function handleFabPredictions() {
    if (predictionFinalized === null) return
    if (predictionFinalized === true) {
      setShowPredictionReview(true)
      return
    }
    if (roomId) navigate(`/room/${roomId}/predictions`)
  }

  const fabPredictionsReady = predictionFinalized !== null
  const fabPredictionsLabel =
    predictionFinalized === true ? 'Ver predicción' : 'Hacer predicción'
  const fabPredictionsAria =
    predictionFinalized === true
      ? 'Abrir resumen de mi predicción'
      : predictionFinalized === false
        ? 'Ir a hacer mi predicción'
        : 'Cargando estado de predicción'

  return (
    <div className="pred-wc26 room-standings-page">
      <button
        type="button"
        className="room-standings-fab-predictions"
        aria-label={fabPredictionsAria}
        disabled={!fabPredictionsReady}
        onClick={handleFabPredictions}
      >
        {fabPredictionsLabel}
      </button>
      {showPredictionPrompt && roomId ? (
        <div
          className="modal-overlay pred-rules-modal-overlay"
          role="presentation"
          onClick={dismissPredictionPrompt}
        >
          <div
            className="modal-card pred-rules-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="room-prediction-prompt-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="room-prediction-prompt-title">¿Listo para tu predicción?</h2>
              <button
                type="button"
                className="modal-close"
                aria-label="Cerrar"
                onClick={dismissPredictionPrompt}
              >
                ×
              </button>
            </div>
            <div className="pred-rules-modal__body pred-rules-modal__body--compact">
              <p className="app-muted" style={{ marginTop: 0 }}>
                Todavía no finalizaste tu pronóstico en esta sala. Entrá a predicciones, completá todo y usá{' '}
                <strong>Guardar predicción</strong> para cerrarla. Después podés volver acá cuando quieras.
              </p>
            </div>
            <div className="button-group pred-save-modal-actions">
              <button
                type="button"
                className="btn-secondary pred-save-modal-btn pred-save-modal-btn--confirm"
                onClick={goToPredictions}
              >
                Ir a predicciones
              </button>
              <button
                type="button"
                className="btn-secondary pred-save-modal-btn pred-save-modal-btn--cancel"
                onClick={dismissPredictionPrompt}
              >
                Más tarde
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <RoomHomePlayerPickBanner
        variant={isGlobalRoom ? 'global' : 'private'}
        roomId={roomId}
        userId={user?.uid}
        titleTrailing={
          canManageRoom && room ? (
            <div className="room-standings-admin-toolbar room-standings-admin-toolbar--banner-inline">
              <InviteCodeQuickStrip inviteCode={room.inviteCode} />
              <button
                type="button"
                className="room-standings-settings-btn"
                aria-label="Invitaciones y solicitudes"
                title="Invitaciones"
                onClick={() => setShowInviteModal(true)}
              >
                <svg
                  className="room-standings-settings-btn__icon"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden
                >
                  <path
                    d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <circle cx="8.5" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
                  <path d="M20 8v6M23 11h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              <button
                type="button"
                className="room-standings-settings-btn"
                aria-label="Configurar sala"
                title="Configurar sala"
                onClick={() => setShowAdmin(true)}
              >
                <svg
                  className="room-standings-settings-btn__icon"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden
                >
                  <path
                    d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          ) : undefined
        }
      />
      {showScoringHelpModal ? (
        <div className="modal-overlay pred-rules-modal-overlay" role="presentation">
          <div
            className="modal-card pred-rules-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="standings-scoring-help-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="standings-scoring-help-title">Cómo suman los puntos</h2>
              <button
                type="button"
                className="modal-close"
                aria-label="Cerrar"
                onClick={() => setShowScoringHelpModal(false)}
              >
                ×
              </button>
            </div>
            <div className="pred-rules-modal__body">
              <PredictionScoringHelpBody variant="scores" />
            </div>
            <div className="button-group pred-save-modal-actions" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="btn-secondary pred-save-modal-btn pred-save-modal-btn--cancel"
                onClick={() => setShowScoringHelpModal(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="standings-dashboard">
        <StandingsPageHeader
          lastUpdateLabel={meta.lastUpdateLabel}
          onHelpClick={() => setShowScoringHelpModal(true)}
        />
        <div
          className={[
            'standings-dashboard__cards-row',
            isGlobalRoom ? 'standings-dashboard__cards-row--two' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {!isGlobalRoom ? (
            <StandingsPrizePoolCard prizes={room?.podiumPrizes} roomName={room?.name} />
          ) : null}
          <div className="standings-participation-column">
            <StandingsParticipationCard meta={meta} />
            <button
              type="button"
              className="standings-history-btn"
              onClick={() => setShowPointsHistory(true)}
              disabled={!user}
            >
              Historial de puntuaciones
            </button>
          </div>
          <StandingsMyStatusCard row={myStandingRow} />
        </div>
        {loading ? <p className="user-email">Cargando…</p> : null}
        {error ? <p className="auth-error">{error}</p> : null}
        {standings.length > 0 ? (
          <StandingsLeaderboard
            standings={standings}
            showSpecialsColumn={showSpecialsColumn}
            subtitle={standingsSubtitle}
          />
        ) : null}
      </div>
      {standings.length === 0 && !loading ? (
        <p className="app-muted">
          {isGlobalRoom
            ? 'Aún no hay predicciones registradas en la sala global.'
            : 'Aún no hay miembros con datos para mostrar en esta sala.'}
        </p>
      ) : null}
      {showAdmin && room ? (
        <PrivateRoomAdminModal
          roomId={roomId}
          roomOwnerId={room.createdBy}
          roomName={room.name}
          roomDescription={room.description}
          podiumPrizes={room.podiumPrizes}
          onRoomUpdated={() => void refreshRoomDoc()}
          onClose={() => setShowAdmin(false)}
          onRoomDeleted={() => {
            setShowAdmin(false)
            window.location.replace(import.meta.env.BASE_URL || '/')
          }}
        />
      ) : null}
      {showInviteModal && room ? (
        <RoomInviteModal
          roomId={roomId}
          inviteCode={room.inviteCode}
          onClose={() => setShowInviteModal(false)}
        />
      ) : null}
      {showPointsHistory ? (
        <PointsHistoryModal
          history={pointsHistory}
          loading={pointsHistoryLoading}
          error={pointsHistoryError}
          onClose={() => setShowPointsHistory(false)}
        />
      ) : null}
      {showPredictionReview && user ? (
        <PredictionReviewModal
          user={user}
          roomId={roomId}
          predictions={predictions}
          matches={matches}
          teamLabel={teamLabel}
          enabledQuestionIds={enabledQuestionIds}
          loading={loadingPredictions}
          error={null}
          onClose={() => setShowPredictionReview(false)}
        />
      ) : null}
    </div>
  )
}
