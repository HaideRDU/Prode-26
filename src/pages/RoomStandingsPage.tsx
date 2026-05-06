import { useEffect, useId, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useStandings } from '../hooks/useStandings'
import { PredictionScoringHelpBody } from '../predictions/PredictionScoringHelpBody'
import type { AccountOutletContext } from '../types/outletContext'
import type { RoomDoc } from '../types/predictions'
import { getPredictionFinalized } from '../services/predictionStateService'
import { getRoom } from '../services/roomsService'
import { PrivateRoomAdminModal } from '../rooms/PrivateRoomAdminModal'
import { RoomPrivatePodiumSection } from '../rooms/RoomPrivatePodiumSection'
import { RoomHomePlayerPickBanner } from '../predictions/RoomHomePlayerPickBanner'
import '../predictions/pred-theme.css'

const predictionPromptStorageKey = (id: string) => `wc26_room_prediction_prompt:${id}`

export function RoomStandingsPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { user } = useOutletContext<AccountOutletContext>()
  const { standings, error, loading, isGlobalRoom } = useStandings(roomId, user?.uid)
  const tieBreakHelpId = useId()
  const pointsHelpId = useId()
  const [showScoringHelpModal, setShowScoringHelpModal] = useState(false)
  const [room, setRoom] = useState<RoomDoc | null>(null)
  const [showAdmin, setShowAdmin] = useState(false)
  const [showPredictionPrompt, setShowPredictionPrompt] = useState(false)
  const [predictionFinalized, setPredictionFinalized] = useState<boolean | null>(null)

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
    if (!roomId || !user) return
    try {
      if (!sessionStorage.getItem(predictionPromptStorageKey(roomId))) {
        setShowPredictionPrompt(true)
      }
    } catch {
      setShowPredictionPrompt(true)
    }
  }, [roomId, user])

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

  function goToPredictionsPage() {
    if (roomId) navigate(`/room/${roomId}/predictions`)
  }

  const fabPredictionsLabel =
    predictionFinalized === true ? 'Ver predicción' : 'Hacer predicción'
  const fabPredictionsAria =
    predictionFinalized === true
      ? 'Ir a ver mi predicción'
      : 'Ir a hacer mi predicción'

  return (
    <div className="pred-wc26 room-standings-page">
      <button
        type="button"
        className="room-standings-fab-predictions"
        aria-label={fabPredictionsAria}
        onClick={goToPredictionsPage}
      >
        {fabPredictionsLabel}
      </button>
      {canManageRoom ? (
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
      ) : null}
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
              Completa o revisa tu pronóstico en esta sala. Puedes volver a la clasificación cuando quieras.
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
      <RoomHomePlayerPickBanner variant={isGlobalRoom ? 'global' : 'private'} />
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
      <div className="page-title-with-help">
        <h1 className="app-page-title">Clasificación</h1>
        <span className="help-points-wrap" tabIndex={-1}>
          <button
            type="button"
            className="help-points-trigger"
            aria-label="Cómo suman los puntos"
            aria-describedby={pointsHelpId}
            title="Cómo suman los puntos"
            onClick={() => setShowScoringHelpModal(true)}
          >
            ?
          </button>
          <span id={pointsHelpId} role="tooltip" className="help-points-tooltip">
            <strong>¿Qué es?</strong> Resumen de cómo suman los puntos en esta sala.
            <br />
            Pasa por aquí para ver la ayuda rápida o haz clic para ver el detalle completo.
            <br />
            <strong>Desempate:</strong> si empatan en puntos, gana quien tenga más exactos → más especiales → campeón (Sí).
          </span>
        </span>
      </div>
      <p className="app-muted" style={{ marginTop: -4, marginBottom: 12 }}>
        {isGlobalRoom ? 'Top 50 · Sala global' : 'Miembros de la sala privada'}
      </p>
      {!isGlobalRoom ? (
        <RoomPrivatePodiumSection standings={standings} prizes={room?.podiumPrizes} />
      ) : null}
      {loading ? <p className="user-email">Cargando…</p> : null}
      {error ? <p className="auth-error">{error}</p> : null}
      <table className="standings-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Usuario</th>
            <th>Puntos</th>
            <th>
              <span className="standings-tiebreak-help" tabIndex={0} aria-describedby={tieBreakHelpId}>
                Desempate
                <span id={tieBreakHelpId} role="tooltip" className="standings-tiebreak-help__tooltip">
                  <strong>¿Qué es?</strong> Se usa cuando hay empate en puntos.
                  <br />
                  <strong>Formato:</strong> exactos/especiales/campeón.
                  <br />
                  <strong>Orden:</strong> más exactos → más especiales → campeón (Sí) → criterio final.
                </span>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row) => (
            <tr
              key={row.id}
              className={[
                row.isCurrentUser ? 'current-user-row' : '',
                row.isOutsideTop50 ? 'current-user-row--outside' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <td>{row.rank}</td>
              <td>
                {row.displayName?.trim() || row.userId || row.id}
                {row.isOutsideTop50 ? <span className="standings-own-rank-tag">Tu posición</span> : null}
              </td>
              <td>{row.points}</td>
              <td>
                {row.tieBreak
                  ? `${row.tieBreak.exactScoreHits}/${row.tieBreak.specialQuestionHits}/${row.tieBreak.championHit ? 'Sí' : 'No'}`
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
          roomName={room.name}
          roomDescription={room.description}
          currentUserId={user.uid}
          podiumPrizes={room.podiumPrizes}
          onRoomUpdated={() => void refreshRoomDoc()}
          onClose={() => setShowAdmin(false)}
          onRoomDeleted={() => {
            setShowAdmin(false)
            window.location.replace(import.meta.env.BASE_URL || '/')
          }}
        />
      ) : null}
    </div>
  )
}
