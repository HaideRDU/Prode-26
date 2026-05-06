import { useEffect, useState, type ReactElement } from 'react'
import '../predictions/pred-theme.css'
import {
  deletePrivateRoom,
  listRoomMembers,
  removePrivateRoomMember,
  type RoomMemberLite,
} from '../services/roomAdminService'
import {
  ROOM_DESCRIPTION_MAX_CHARS,
  ROOM_NAME_MAX_CHARS,
  ROOM_PRIZE_MAX_CHARS,
} from '../constants/roomFieldLimits'
import { updatePrivateRoomDetails, updatePrivateRoomPodiumPrizes } from '../services/roomsService'
import type { PrivateRoomPodiumPrizes } from '../types/predictions'

type AdminTab = 'users' | 'advanced'

export function PrivateRoomAdminModal({
  roomId,
  currentUserId,
  roomName,
  roomDescription,
  podiumPrizes,
  onRoomUpdated,
  onClose,
  onRoomDeleted,
}: {
  roomId: string
  currentUserId: string
  roomName: string
  roomDescription?: string | null
  podiumPrizes?: PrivateRoomPodiumPrizes | null
  onRoomUpdated?: () => void | Promise<void>
  onClose: () => void
  onRoomDeleted?: () => void
}) {
  const [tab, setTab] = useState<AdminTab>('users')
  const [members, setMembers] = useState<RoomMemberLite[]>([])
  const [loading, setLoading] = useState(true)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [busyDeleteRoom, setBusyDeleteRoom] = useState(false)
  const [busySavePrizes, setBusySavePrizes] = useState(false)
  const [busySaveRoom, setBusySaveRoom] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editName, setEditName] = useState(roomName)
  const [editDescription, setEditDescription] = useState(roomDescription?.trim() ?? '')
  const [prizeFirst, setPrizeFirst] = useState('')
  const [prizeSecond, setPrizeSecond] = useState('')
  const [prizeThird, setPrizeThird] = useState('')

  useEffect(() => {
    setEditName(roomName.slice(0, ROOM_NAME_MAX_CHARS))
    setEditDescription((roomDescription?.trim() ?? '').slice(0, ROOM_DESCRIPTION_MAX_CHARS))
  }, [roomId, roomName, roomDescription])

  useEffect(() => {
    setPrizeFirst((podiumPrizes?.first?.trim() ?? '').slice(0, ROOM_PRIZE_MAX_CHARS))
    setPrizeSecond((podiumPrizes?.second?.trim() ?? '').slice(0, ROOM_PRIZE_MAX_CHARS))
    setPrizeThird((podiumPrizes?.third?.trim() ?? '').slice(0, ROOM_PRIZE_MAX_CHARS))
  }, [roomId, podiumPrizes?.first, podiumPrizes?.second, podiumPrizes?.third])

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

  async function handleSaveRoomDetails() {
    if (busySaveRoom || busyDeleteRoom || busySavePrizes || busyUserId) return
    setError(null)
    setBusySaveRoom(true)
    try {
      await updatePrivateRoomDetails(roomId, { name: editName, description: editDescription })
      await onRoomUpdated?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron guardar los datos de la sala.')
    } finally {
      setBusySaveRoom(false)
    }
  }

  async function handleSavePrizes() {
    if (busySavePrizes || busyDeleteRoom || busyUserId || busySaveRoom) return
    setError(null)
    setBusySavePrizes(true)
    try {
      await updatePrivateRoomPodiumPrizes(roomId, {
        first: prizeFirst,
        second: prizeSecond,
        third: prizeThird,
      })
      await onRoomUpdated?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron guardar los premios.')
    } finally {
      setBusySavePrizes(false)
    }
  }

  async function handleRemove(userId: string) {
    if (busyUserId || busyDeleteRoom || busySaveRoom || busySavePrizes) return
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
    if (busyDeleteRoom || busyUserId || busySaveRoom || busySavePrizes) return
    const displayName = editName.trim() || roomName
    const ok = window.confirm(
      `¿Seguro que deseas borrar la sala "${displayName}"? Esta acción elimina usuarios, predicciones y clasificación de la sala.`,
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

  let panel: ReactElement
  if (tab === 'users') {
    panel = (
      <div
        id="room-admin-panel-users"
        role="tabpanel"
        aria-labelledby="room-admin-tab-users"
        className="room-admin-modal-panel"
      >
        <p className="app-muted" style={{ marginTop: 0 }}>
          Miembros de la sala. El líder no puede eliminarse.
        </p>
        {loading ? <p className="user-email">Cargando miembros…</p> : null}
        {!loading ? (
          <div className="room-admin-members-scroll">
            {members.map((m) => (
              <div key={m.id} className="room-admin-member-row">
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
      </div>
    )
  } else {
    panel = (
      <div
        id="room-admin-panel-advanced"
        role="tabpanel"
        aria-labelledby="room-admin-tab-advanced"
        className="room-admin-modal-panel"
      >
        <div className="room-admin-modal-section room-admin-modal-section--nested">
          <h3 className="room-admin-modal-section__title">Nombre y descripción</h3>
          <label className="room-admin-modal-field">
            <span className="app-muted">
              Nombre de la sala <span className="room-admin-char-hint">({editName.length}/{ROOM_NAME_MAX_CHARS})</span>
            </span>
            <input
              className="field-input"
              value={editName}
              onChange={(e) => setEditName(e.target.value.slice(0, ROOM_NAME_MAX_CHARS))}
              placeholder="Nombre visible para los miembros"
              autoComplete="off"
              maxLength={ROOM_NAME_MAX_CHARS}
            />
          </label>
          <label className="room-admin-modal-field">
            <span className="app-muted">
              Descripción (opcional){' '}
              <span className="room-admin-char-hint">
                ({editDescription.length}/{ROOM_DESCRIPTION_MAX_CHARS})
              </span>
            </span>
            <textarea
              className="field-input"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value.slice(0, ROOM_DESCRIPTION_MAX_CHARS))}
              placeholder="Reglas locales, forma de pago del premio, etc."
              rows={3}
              maxLength={ROOM_DESCRIPTION_MAX_CHARS}
            />
          </label>
          <button
            type="button"
            className="btn-secondary"
            disabled={busySaveRoom || busyDeleteRoom || !editName.trim()}
            onClick={() => void handleSaveRoomDetails()}
          >
            {busySaveRoom ? 'Guardando…' : 'Guardar nombre y descripción'}
          </button>
        </div>

        <div className="room-admin-modal-section room-admin-modal-section--nested">
          <h3 className="room-admin-modal-section__title">Premios del podio (top 3)</h3>
          <p className="app-muted room-admin-modal-section__hint">
            Texto visible para todos los miembros junto a la clasificación.
          </p>
          <label className="room-admin-modal-field">
            <span className="app-muted">
              1.er lugar <span className="room-admin-char-hint">({prizeFirst.length}/{ROOM_PRIZE_MAX_CHARS})</span>
            </span>
            <input
              className="field-input"
              value={prizeFirst}
              onChange={(e) => setPrizeFirst(e.target.value.slice(0, ROOM_PRIZE_MAX_CHARS))}
              placeholder="Ej.: Camiseta oficial, $50, trofeo…"
              maxLength={ROOM_PRIZE_MAX_CHARS}
            />
          </label>
          <label className="room-admin-modal-field">
            <span className="app-muted">
              2.º lugar <span className="room-admin-char-hint">({prizeSecond.length}/{ROOM_PRIZE_MAX_CHARS})</span>
            </span>
            <input
              className="field-input"
              value={prizeSecond}
              onChange={(e) => setPrizeSecond(e.target.value.slice(0, ROOM_PRIZE_MAX_CHARS))}
              placeholder="Ej.: Premio simbólico…"
              maxLength={ROOM_PRIZE_MAX_CHARS}
            />
          </label>
          <label className="room-admin-modal-field">
            <span className="app-muted">
              3.er lugar <span className="room-admin-char-hint">({prizeThird.length}/{ROOM_PRIZE_MAX_CHARS})</span>
            </span>
            <input
              className="field-input"
              value={prizeThird}
              onChange={(e) => setPrizeThird(e.target.value.slice(0, ROOM_PRIZE_MAX_CHARS))}
              placeholder="Ej.: Mención honorífica…"
              maxLength={ROOM_PRIZE_MAX_CHARS}
            />
          </label>
          <button
            type="button"
            className="btn-secondary"
            disabled={busySavePrizes || busyDeleteRoom}
            onClick={() => void handleSavePrizes()}
          >
            {busySavePrizes ? 'Guardando premios…' : 'Guardar premios'}
          </button>
        </div>

        <div className="room-admin-modal-section room-admin-modal-section--nested room-admin-modal-section--danger">
          <h3 className="room-admin-modal-section__title">Zona peligrosa</h3>
          <p className="app-muted room-admin-modal-section__hint">
            Elimina la sala y todos los datos asociados. No se puede deshacer.
          </p>
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
    )
  }

  return (
    <div className="modal-overlay" role="presentation">
      <div
        className="modal-card room-admin-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-admin-title"
      >
        <div className="modal-header">
          <h2 id="room-admin-title">Configurar sala privada</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="room-admin-modal-tabs" role="tablist" aria-label="Secciones de configuración">
          <button
            type="button"
            role="tab"
            id="room-admin-tab-users"
            aria-selected={tab === 'users'}
            aria-controls="room-admin-panel-users"
            className={`room-admin-modal-tab${tab === 'users' ? ' room-admin-modal-tab--active' : ''}`}
            onClick={() => setTab('users')}
          >
            Usuarios
          </button>
          <button
            type="button"
            role="tab"
            id="room-admin-tab-advanced"
            aria-selected={tab === 'advanced'}
            aria-controls="room-admin-panel-advanced"
            className={`room-admin-modal-tab${tab === 'advanced' ? ' room-admin-modal-tab--active' : ''}`}
            onClick={() => setTab('advanced')}
          >
            Avanzado
          </button>
        </div>

        {panel}

        {error ? <p className="auth-error">{error}</p> : null}
        <div className="button-group" style={{ marginTop: 16 }}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busyDeleteRoom}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
