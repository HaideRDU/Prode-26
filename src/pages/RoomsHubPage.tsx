import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import type { User } from 'firebase/auth'
import type { PrivateRoomPodiumPrizes, RoomMaxMembers } from '../types/predictions'
import { createRoom, joinRoomByCode } from '../services/roomsService'
import { getPredictionFinalized } from '../services/predictionStateService'
import type { AccountOutletContext } from '../types/outletContext'
import { ALL_QUESTION_METAS } from '../data/bonusQuestionsMeta'

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
  const [customizeQuestions, setCustomizeQuestions] = useState(false)
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>(
    ALL_QUESTION_METAS.map((q) => q.id),
  )
  const [prizeFirst, setPrizeFirst] = useState('')
  const [prizeSecond, setPrizeSecond] = useState('')
  const [prizeThird, setPrizeThird] = useState('')

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
    if (customizeQuestions && selectedQuestionIds.length === 0) {
      setCreateError('Selecciona al menos una pregunta extra o desactiva la personalización.')
      return
    }
    setCreateBusy(true)
    try {
      const podiumPrizes: PrivateRoomPodiumPrizes = {
        first: prizeFirst,
        second: prizeSecond,
        third: prizeThird,
      }
      const { roomId } = await createRoom(
        name.trim(),
        description.trim(),
        maxMembers,
        user.uid,
        displayName,
        customizeQuestions ? selectedQuestionIds : undefined,
        podiumPrizes,
      )
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
            <div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={customizeQuestions}
                  onChange={(e) => setCustomizeQuestions(e.target.checked)}
                />
                <span className="app-muted">Personalizar “Extras y banco de preguntas”</span>
              </label>
            </div>
            {customizeQuestions ? (
              <div className="app-room-question-picker">
                <label className="app-room-question-picker-select-all">
                  <input
                    type="checkbox"
                    checked={selectedQuestionIds.length === ALL_QUESTION_METAS.length}
                    onChange={(e) => {
                      setSelectedQuestionIds(
                        e.target.checked ? ALL_QUESTION_METAS.map((q) => q.id) : [],
                      )
                    }}
                  />
                  <span className="app-muted">
                    Seleccionar todas ({selectedQuestionIds.length}/{ALL_QUESTION_METAS.length})
                  </span>
                </label>
                <div className="app-room-question-picker-scroll">
                  {ALL_QUESTION_METAS.map((meta) => {
                    const checked = selectedQuestionIds.includes(meta.id)
                    return (
                      <label key={meta.id} className="app-room-question-picker-row">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setSelectedQuestionIds((prev) =>
                              e.target.checked ? [...prev, meta.id] : prev.filter((id) => id !== meta.id),
                            )
                          }}
                        />
                        <span className="app-muted">{meta.labelEs}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ) : null}
            <div className="app-rooms-hub-prizes">
              <p className="app-muted" style={{ marginBottom: 8, fontWeight: 600 }}>
                Premios del podio (opcional)
              </p>
              <p className="app-muted" style={{ marginBottom: 10, fontSize: '0.88rem' }}>
                Podés definirlos ahora o más tarde en Configurar sala.
              </p>
              <label>
                <span className="app-muted">1.er lugar</span>
                <input
                  className="field-input"
                  value={prizeFirst}
                  onChange={(e) => setPrizeFirst(e.target.value)}
                  placeholder="Ej.: Trofeo, dinero, detalle…"
                />
              </label>
              <label>
                <span className="app-muted">2.º lugar</span>
                <input
                  className="field-input"
                  value={prizeSecond}
                  onChange={(e) => setPrizeSecond(e.target.value)}
                  placeholder="Opcional"
                />
              </label>
              <label>
                <span className="app-muted">3.er lugar</span>
                <input
                  className="field-input"
                  value={prizeThird}
                  onChange={(e) => setPrizeThird(e.target.value)}
                  placeholder="Opcional"
                />
              </label>
            </div>
            <div className="app-rooms-hub-actions">
              <button type="submit" className="btn-secondary" disabled={createBusy}>
                {createBusy ? 'Creando…' : 'Crear sala'}
              </button>
              {createError ? <p className="auth-error">{createError}</p> : null}
            </div>
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
