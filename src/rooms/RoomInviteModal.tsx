import { useEffect, useState } from 'react'
import { ModalPortal } from '../components/ModalPortal'
import '../predictions/pred-theme.css'
import { approveJoinRequest, listPendingJoinRequests, rejectJoinRequest } from '../services/roomInviteService'
import { InviteCodeQuickStrip } from './InviteCodeQuickStrip'

export function RoomInviteModal({
  roomId,
  inviteCode,
  onClose,
}: {
  roomId: string
  inviteCode: string
  onClose: () => void
}) {
  const [pendingRequests, setPendingRequests] = useState<
    { id: string; userId: string; displayName: string }[]
  >([])
  const [loadingPendingRequests, setLoadingPendingRequests] = useState(false)
  const [busyInvite, setBusyInvite] = useState<null | { userId: string; kind: 'approve' | 'reject' }>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoadingPendingRequests(true)
    listPendingJoinRequests(roomId)
      .then((rows) => {
        if (!cancelled) {
          setPendingRequests(rows.map((r) => ({ id: r.id, userId: r.userId, displayName: r.displayName })))
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudieron cargar las solicitudes.')
      })
      .finally(() => {
        if (!cancelled) setLoadingPendingRequests(false)
      })
    return () => {
      cancelled = true
    }
  }, [roomId])

  async function handleApproveRequest(targetUserId: string, displayName: string) {
    if (busyInvite) return
    setError(null)
    setBusyInvite({ userId: targetUserId, kind: 'approve' })
    try {
      await approveJoinRequest(roomId, targetUserId, displayName)
      setPendingRequests((prev) => prev.filter((r) => r.userId !== targetUserId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo aceptar la solicitud.')
    } finally {
      setBusyInvite(null)
    }
  }

  async function handleRejectRequest(targetUserId: string) {
    if (busyInvite) return
    setError(null)
    setBusyInvite({ userId: targetUserId, kind: 'reject' })
    try {
      await rejectJoinRequest(roomId, targetUserId)
      setPendingRequests((prev) => prev.filter((r) => r.userId !== targetUserId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo rechazar la solicitud.')
    } finally {
      setBusyInvite(null)
    }
  }

  return (
    <ModalPortal>
      <div className="pred-wc26 modal-overlay app-modal-portal-overlay" role="presentation">
        <div
          className="modal-card room-admin-modal-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="room-invite-title"
        >
        <div className="modal-header">
          <h2 id="room-invite-title">Invitaciones</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="room-admin-modal-panel">
          <div className="room-admin-modal-section room-admin-modal-section--nested">
            <h3 className="room-admin-modal-section__title">Código de sala</h3>
            <p className="app-muted room-admin-modal-section__hint">
              Compartilo para que pidan ingreso; vos aceptás o rechazás las solicitudes abajo.
            </p>
            <InviteCodeQuickStrip inviteCode={inviteCode} />
          </div>

          <div className="room-admin-modal-section room-admin-modal-section--nested">
            <h3 className="room-admin-modal-section__title">Solicitudes de ingreso</h3>
            <p className="app-muted room-admin-modal-section__hint">
              Quienes pidieron entrar con el código quedan pendientes hasta que los aceptes.
            </p>
            {loadingPendingRequests ? <p className="user-email">Cargando solicitudes…</p> : null}
            {!loadingPendingRequests && pendingRequests.length === 0 ? (
              <p className="app-muted">No hay solicitudes pendientes.</p>
            ) : null}
            {!loadingPendingRequests ? (
              <div className="room-admin-members-scroll">
                {pendingRequests.map((r) => (
                  <div key={r.id} className="room-admin-member-row">
                    <div>
                      <div>{r.displayName}</div>
                      <div className="app-muted" style={{ fontSize: 12 }}>
                        {r.userId}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={busyInvite !== null}
                        onClick={() => void handleApproveRequest(r.userId, r.displayName)}
                      >
                        {busyInvite?.userId === r.userId && busyInvite.kind === 'approve'
                          ? 'Aceptando…'
                          : 'Aceptar'}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={busyInvite !== null}
                        onClick={() => void handleRejectRequest(r.userId)}
                      >
                        {busyInvite?.userId === r.userId && busyInvite.kind === 'reject'
                          ? 'Rechazando…'
                          : 'Rechazar'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {error ? <p className="auth-error">{error}</p> : null}
        <div className="button-group" style={{ marginTop: 16 }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
        </div>
      </div>
    </ModalPortal>
  )
}
