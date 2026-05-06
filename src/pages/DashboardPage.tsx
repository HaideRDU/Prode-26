import { useEffect, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import type { User } from 'firebase/auth'
import { useRooms } from '../hooks/useRooms'
import { ensureGlobalRoomMembership, getRoom } from '../services/roomsService'
import { getPredictionFinalized } from '../services/predictionStateService'
import { GLOBAL_ROOM_ID } from '../constants/rooms'
import type { AccountOutletContext } from '../types/outletContext'
import type { PrivateRoomPodiumPrizes } from '../types/predictions'
import { InviteCodeQuickStrip } from '../rooms/InviteCodeQuickStrip'
import { PrivateRoomAdminModal } from '../rooms/PrivateRoomAdminModal'
import { RoomInviteModal } from '../rooms/RoomInviteModal'

export function DashboardPage({ user }: { user: User }) {
  const { publicDisplayName } = useOutletContext<AccountOutletContext>()
  const navigate = useNavigate()
  const displayName = publicDisplayName || user.email || 'Usuario'
  const { rooms, error, loading } = useRooms(user.uid)
  const [finalizedByRoomId, setFinalizedByRoomId] = useState<Record<string, boolean>>({})
  const [adminRoom, setAdminRoom] = useState<{
    roomId: string
    roomName: string
    roomDescription?: string | null
    podiumPrizes?: PrivateRoomPodiumPrizes | null
  } | null>(null)
  const [inviteModalRoomId, setInviteModalRoomId] = useState<string | null>(null)
  const [inviteModalCode, setInviteModalCode] = useState<string>('')

  useEffect(() => {
    void ensureGlobalRoomMembership(user.uid, displayName)
  }, [user.uid, displayName])

  useEffect(() => {
    const ids = [GLOBAL_ROOM_ID, ...rooms.map((r) => r.roomId)]
    let cancelled = false
    Promise.all(
      ids.map(async (id) => ({ id, finalized: await getPredictionFinalized(user.uid, id) })),
    )
      .then((pairs) => {
        if (cancelled) return
        const next: Record<string, boolean> = {}
        for (const p of pairs) next[p.id] = p.finalized
        setFinalizedByRoomId(next)
      })
      .catch(() => {
        if (!cancelled) setFinalizedByRoomId({})
      })
    return () => {
      cancelled = true
    }
  }, [rooms, user.uid])

  function roomTarget(roomId: string): string {
    return finalizedByRoomId[roomId] ? `/room/${roomId}/standings` : `/room/${roomId}/predictions`
  }

  return (
    <div>
      <h1 className="app-page-title">Panel</h1>
      <p className="auth-lead" style={{ textAlign: 'left', marginBottom: '20px' }}>
        Tus salas de predicción. La sala global es independiente de cada sala privada.
      </p>
      {loading ? <p className="user-email">Cargando salas…</p> : null}
      {error ? <p className="auth-error">{error}</p> : null}
      <div className="app-card-list">
        <article className="app-room-card" aria-label="Sala global">
          <div className="app-room-card-top">
            <Link to={`/room/${GLOBAL_ROOM_ID}/standings`} className="app-room-title-link">
              <h3 className="app-room-title">Sala global</h3>
            </Link>
            <p className="app-muted">Sala abierta para todos los usuarios.</p>
          </div>
          <div className="app-room-card-bottom">
            <p className="app-room-points">Sin puntaje individual</p>
            <Link to={roomTarget(GLOBAL_ROOM_ID)} className="app-room-open-btn">
              Abrir predicciones
            </Link>
          </div>
        </article>
        {rooms.map((r) => (
          <article key={r.roomId} className="app-room-card" aria-label={`Sala ${r.room.name}`}>
            <div className="app-room-card-top">
              <Link to={`/room/${r.roomId}/standings`} className="app-room-title-link">
                <h3 className="app-room-title">{r.room.name}</h3>
              </Link>
              <p className="app-muted">{r.room.description?.trim() || 'Sin descripcion de sala.'}</p>
            </div>
            <div className="app-room-card-bottom">
              <p className="app-room-points">
                {r.myPoints != null ? `${r.myPoints} pts` : 'Sin puntos'}
                {r.myRank != null ? ` · Pos. ${r.myRank}` : ''}
              </p>
              <Link to={roomTarget(r.roomId)} className="app-room-open-btn">
                Abrir predicciones
              </Link>
              {r.room.type === 'private' && r.room.createdBy === user.uid ? (
                <div className="app-room-card-admin-actions">
                  <InviteCodeQuickStrip inviteCode={r.room.inviteCode} />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      void getRoom(r.roomId).then((fresh) => {
                        setInviteModalRoomId(r.roomId)
                        setInviteModalCode(fresh?.inviteCode ?? r.room.inviteCode)
                      })
                    }}
                  >
                    Invitaciones
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      void getRoom(r.roomId).then((fresh) =>
                        setAdminRoom({
                          roomId: r.roomId,
                          roomName: fresh?.name ?? r.room.name,
                          roomDescription: fresh?.description ?? r.room.description,
                          podiumPrizes: fresh?.podiumPrizes ?? r.room.podiumPrizes,
                        }),
                      )
                    }}
                  >
                    Configurar sala
                  </button>
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      {adminRoom ? (
        <PrivateRoomAdminModal
          roomId={adminRoom.roomId}
          roomName={adminRoom.roomName}
          roomDescription={adminRoom.roomDescription}
          currentUserId={user.uid}
          podiumPrizes={adminRoom.podiumPrizes}
          onRoomUpdated={async () => {
            const data = await getRoom(adminRoom.roomId)
            setAdminRoom((prev) =>
              prev && data
                ? {
                    ...prev,
                    roomName: data.name,
                    roomDescription: data.description,
                    podiumPrizes: data.podiumPrizes,
                  }
                : prev,
            )
          }}
          onClose={() => setAdminRoom(null)}
          onRoomDeleted={() => navigate('/', { replace: true })}
        />
      ) : null}
      {inviteModalRoomId ? (
        <RoomInviteModal
          roomId={inviteModalRoomId}
          inviteCode={inviteModalCode}
          onClose={() => {
            setInviteModalRoomId(null)
            setInviteModalCode('')
          }}
        />
      ) : null}
    </div>
  )
}
