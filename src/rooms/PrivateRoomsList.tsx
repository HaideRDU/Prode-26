import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { User } from 'firebase/auth'
import { useRooms } from '../hooks/useRooms'
import { getRoom } from '../services/roomsService'
import { getPredictionFinalized } from '../services/predictionStateService'
import type { PrivateRoomPodiumPrizes } from '../types/predictions'
import { InviteCodeQuickStrip } from './InviteCodeQuickStrip'
import { PrivateRoomAdminModal } from './PrivateRoomAdminModal'
import { RoomInviteModal } from './RoomInviteModal'

export function PrivateRoomsList({
  user,
  onRoomDeletedNavigateTo = '/salas',
}: {
  user: User
  onRoomDeletedNavigateTo?: string
}) {
  const navigate = useNavigate()
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
    const ids = rooms.map((r) => r.roomId)
    if (ids.length === 0) {
      setFinalizedByRoomId({})
      return
    }
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
    <>
      {loading ? <p className="user-email">Cargando salas…</p> : null}
      {error ? <p className="auth-error">{error}</p> : null}
      {!loading && !error && rooms.length === 0 ? (
        <p className="app-muted" style={{ marginBottom: 16 }}>
          Aún no pertenecés a ninguna sala privada. Creá una o unite con un código de invitación.
        </p>
      ) : null}
      <div className="app-card-list">
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
          onRoomDeleted={() => navigate(onRoomDeletedNavigateTo, { replace: true })}
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
    </>
  )
}
