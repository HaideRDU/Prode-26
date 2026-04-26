import { useEffect, useState } from 'react'
import { deletePrivateRoom, listRoomMembers, removePrivateRoomMember, type RoomMemberLite } from '../services/roomAdminService'

export function PrivateRoomAdminModal({
  roomId,
  currentUserId,
  roomName,
  onClose,
  onRoomDeleted,
}: {
  roomId: string
  currentUserId: string
  roomName: string
  onClose: () => void
  onRoomDeleted?: () => void
}) {
  const [members, setMembers] = useState<RoomMemberLite[]>([])
  const [loading, setLoading] = useState(true)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [busyDeleteRoom, setBusyDeleteRoom] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listRoomMembers(roomId)
      .then((list) => {
        if (!cancelled) {
          setMembers(list)
          setLoading(false)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'No se pudieron cargar los miembros.')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [roomId])

  async function handleRemove(userId: string) {
    if (busyUserId || busyDeleteRoom) return
    setError(null)
    setBusyUserId(userId)
    try {
      await removePrivateRoomMember(roomId, userId)
      setMembers((prev) => prev.filter((m) => m.userId !== userId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar el usuario.')
    } finally {
      setBusyUserId(null)
    }
  }

  async function handleDeleteRoom() {
    if (busyDeleteRoom || busyUserId) return
    const ok = window.confirm(
      `¿Seguro que deseas borrar la sala "${roomName}"? Esta acción elimina usuarios, predicciones y clasificación de la sala.`,
    )
    if (!ok) return
    setError(null)
    setBusyDeleteRoom(true)
    try {
      await deletePrivateRoom(roomId)
      onClose()
      onRoomDeleted?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo borrar la sala.')
    } finally {
      setBusyDeleteRoom(false)
    }
  }

  return (
    <div className="modal-overlay" role="presentation">
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="room-admin-title">
        <div className="modal-header">
          <h2 id="room-admin-title">Configurar sala privada</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        <p className="app-muted" style={{ marginTop: 4 }}>
          Sala: <strong>{roomName}</strong>
        </p>
        {loading ? <p className="user-email">Cargando miembros…</p> : null}
        {!loading ? (
          <div style={{ display: 'grid', gap: 8, marginTop: 8, maxHeight: 280, overflow: 'auto' }}>
            {members.map((m) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '8px 10px',
                }}
              >
                <div>
                  <div>{m.displayName}</div>
                  <div className="app-muted" style={{ fontSize: 12 }}>
                    {m.userId === currentUserId ? 'Líder' : m.userId}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={m.userId === currentUserId || busyUserId === m.userId || busyDeleteRoom}
                  onClick={() => handleRemove(m.userId)}
                >
                  {busyUserId === m.userId ? 'Eliminando…' : 'Eliminar usuario'}
                </button>
              </div>
            ))}
          </div>
        ) : null}
        {error ? <p className="auth-error">{error}</p> : null}
        <div className="button-group" style={{ marginTop: 16 }}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busyDeleteRoom}>
            Cerrar
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ borderColor: '#b91c1c', color: '#b91c1c' }}
            onClick={handleDeleteRoom}
            disabled={busyDeleteRoom}
          >
            {busyDeleteRoom ? 'Borrando sala…' : 'Borrar sala'}
          </button>
        </div>
      </div>
    </div>
  )
}
