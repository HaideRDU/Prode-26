import { useEffect, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { useStandings } from '../hooks/useStandings'
import { PredictionScoringHelpBody } from '../predictions/PredictionScoringHelpBody'
import type { AccountOutletContext } from '../types/outletContext'
import type { RoomDoc } from '../types/predictions'
import { getRoom } from '../services/roomsService'
import { PrivateRoomAdminModal } from '../rooms/PrivateRoomAdminModal'
import '../predictions/pred-theme.css'

export function RoomStandingsPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const { user } = useOutletContext<AccountOutletContext>()
  const { standings, error, loading, isGlobalRoom } = useStandings(roomId, user?.uid)
  const [showScoringHelpModal, setShowScoringHelpModal] = useState(false)
  const [room, setRoom] = useState<RoomDoc | null>(null)
  const [showAdmin, setShowAdmin] = useState(false)

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

  if (!roomId) return <p className="auth-error">Sala no válida</p>

  return (
    <div className="pred-wc26">
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
      <p className="app-muted" style={{ marginBottom: 16 }}>
        <Link to={`/room/${roomId}/predictions`}>Ver mi predicción</Link>
      </p>
      {canManageRoom ? (
        <p style={{ marginTop: -10, marginBottom: 12 }}>
          <button type="button" className="btn-secondary" onClick={() => setShowAdmin(true)}>
            Configurar sala
          </button>
        </p>
      ) : null}
      <div className="page-title-with-help">
        <h1 className="app-page-title">Clasificación</h1>
        <button
          type="button"
          className="help-points-trigger"
          aria-label="Ver cómo suman los puntos"
          title="Cómo suman los puntos"
          onClick={() => setShowScoringHelpModal(true)}
        >
          ?
        </button>
      </div>
      <p className="app-muted" style={{ marginTop: -4, marginBottom: 12 }}>
        {isGlobalRoom ? 'Top 50 · Sala global' : 'Miembros de la sala privada'}
      </p>
      {loading ? <p className="user-email">Cargando…</p> : null}
      {error ? <p className="auth-error">{error}</p> : null}
      <table className="standings-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Usuario</th>
            <th>Puntos</th>
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
          currentUserId={user.uid}
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
