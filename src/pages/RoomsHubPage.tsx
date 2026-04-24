import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import type { User } from 'firebase/auth'
import type { RoomMaxMembers } from '../types/predictions'
import { createRoom, joinRoomByCode } from '../services/roomsService'
import { getPredictionFinalized } from '../services/predictionStateService'
import type { AccountOutletContext } from '../types/outletContext'

const LIMITS: RoomMaxMembers[] = [20, 30, 40, 50, 100]

type HubTab = 'create' | 'join'

export function RoomsHubPage({ user }: { user: User }) {
  const { publicDisplayName } = useOutletContext<AccountOutletContext>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const activeTab: HubTab = useMemo(
    () => (searchParams.get('tab') === 'create' ? 'create' : 'join'),
    [searchParams],
  )

  const setTab = useCallback(
    (tab: HubTab) => {
      if (tab === 'create') {
        setSearchParams({ tab: 'create' }, { replace: true })
      } else {
        setSearchParams({}, { replace: true })
      }
    },
    [setSearchParams],
  )

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [maxMembers, setMaxMembers] = useState<RoomMaxMembers>(20)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createBusy, setCreateBusy] = useState(false)

  const [code, setCode] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [joinBusy, setJoinBusy] = useState(false)

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault()
    setCreateError(null)
    if (!name.trim()) {
      setCreateError('Indica un nombre')
      return
    }
    const displayName = publicDisplayName || user.email || 'Usuario'
    setCreateBusy(true)
    try {
      const { roomId } = await createRoom(name.trim(), description.trim(), maxMembers, user.uid, displayName)
      const finalized = await getPredictionFinalized(user.uid, roomId)
      navigate(`/room/${roomId}/${finalized ? 'standings' : 'predictions'}`)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'No se pudo crear la sala')
    } finally {
      setCreateBusy(false)
    }
  }

  async function handleJoinSubmit(e: React.FormEvent) {
    e.preventDefault()
    setJoinError(null)
    const c = code.trim().toUpperCase()
    if (!c) {
      setJoinError('Introduce el código')
      return
    }
    const displayName = publicDisplayName || user.email || 'Usuario'
    setJoinBusy(true)
    try {
      const roomId = await joinRoomByCode(c, user.uid, displayName)
      const finalized = await getPredictionFinalized(user.uid, roomId)
      navigate(`/room/${roomId}/${finalized ? 'standings' : 'predictions'}`)
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'No se pudo unir')
    } finally {
      setJoinBusy(false)
    }
  }

  return (
    <div className="app-rooms-hub">
      <h1 className="app-page-title">Salas</h1>
      <p className="auth-lead app-rooms-hub-lead">
        Creá una sala nueva o unite con el código de invitación.
      </p>

      <div className="app-rooms-hub-tabs" role="tablist" aria-label="Crear o unirse a sala">
        <button
          type="button"
          role="tab"
          id="rooms-hub-tab-create"
          aria-selected={activeTab === 'create'}
          aria-controls="rooms-hub-panel-create"
          className={`app-rooms-hub-tab${activeTab === 'create' ? ' app-rooms-hub-tab--active' : ''}`}
          onClick={() => setTab('create')}
        >
          Crear sala
        </button>
        <button
          type="button"
          role="tab"
          id="rooms-hub-tab-join"
          aria-selected={activeTab === 'join'}
          aria-controls="rooms-hub-panel-join"
          className={`app-rooms-hub-tab${activeTab === 'join' ? ' app-rooms-hub-tab--active' : ''}`}
          onClick={() => setTab('join')}
        >
          Unirse por código
        </button>
      </div>

      {activeTab === 'create' ? (
        <div
          id="rooms-hub-panel-create"
          role="tabpanel"
          aria-labelledby="rooms-hub-tab-create"
          className="app-rooms-hub-panel"
        >
          <form onSubmit={handleCreateSubmit} className="form-fields app-rooms-hub-form">
            <label>
              <span className="app-muted">Nombre</span>
              <input
                className="field-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre de la sala"
              />
            </label>
            <label>
              <span className="app-muted">Descripcion (opcional)</span>
              <textarea
                className="field-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe brevemente la sala"
                rows={3}
              />
            </label>
            <label>
              <span className="app-muted">Límite de jugadores</span>
              <select
                className="field-input"
                value={maxMembers}
                onChange={(e) => setMaxMembers(Number(e.target.value) as RoomMaxMembers)}
              >
                {LIMITS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn-secondary" disabled={createBusy}>
              {createBusy ? 'Creando…' : 'Crear sala'}
            </button>
            {createError ? <p className="auth-error">{createError}</p> : null}
          </form>
        </div>
      ) : (
        <div
          id="rooms-hub-panel-join"
          role="tabpanel"
          aria-labelledby="rooms-hub-tab-join"
          className="app-rooms-hub-panel"
        >
          <form onSubmit={handleJoinSubmit} className="form-fields app-rooms-hub-form">
            <label>
              <span className="app-muted">Código</span>
              <input
                className="field-input"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Código de invitación"
                maxLength={8}
              />
            </label>
            <button type="submit" className="btn-secondary" disabled={joinBusy}>
              {joinBusy ? 'Uniendo…' : 'Unirse'}
            </button>
            {joinError ? <p className="auth-error">{joinError}</p> : null}
          </form>
        </div>
      )}
    </div>
  )
}
