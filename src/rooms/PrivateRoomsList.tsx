import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { User } from 'firebase/auth'
import { useRooms } from '../hooks/useRooms'
import { getRoom } from '../services/roomsService'
import type { PrivateRoomPodiumPrizes } from '../types/predictions'
import { PrivateRoomAdminModal } from './PrivateRoomAdminModal'
import { RoomInviteModal } from './RoomInviteModal'

function ShareIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="2" />
      <path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function RoomSettingsIcon() {
  return (
    <svg
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
  )
}

export function PrivateRoomsList({
  user,
  onRoomDeletedNavigateTo = '/salas',
}: {
  user: User
  onRoomDeletedNavigateTo?: string
}) {
  const navigate = useNavigate()
  const { rooms, error, loading } = useRooms(user.uid)
  const [adminRoom, setAdminRoom] = useState<{
    roomId: string
    roomOwnerId: string
    roomName: string
    roomDescription?: string | null
    podiumPrizes?: PrivateRoomPodiumPrizes | null
  } | null>(null)
  const [inviteModalRoomId, setInviteModalRoomId] = useState<string | null>(null)
  const [inviteModalCode, setInviteModalCode] = useState<string>('')

  function openInviteModal(roomId: string, fallbackCode: string) {
    void getRoom(roomId).then((fresh) => {
      setInviteModalRoomId(roomId)
      setInviteModalCode(fresh?.inviteCode ?? fallbackCode)
    })
  }

  function openAdminModal(room: (typeof rooms)[number]) {
    void getRoom(room.roomId).then((fresh) =>
      setAdminRoom({
        roomId: room.roomId,
        roomOwnerId: fresh?.createdBy ?? room.room.createdBy,
        roomName: fresh?.name ?? room.room.name,
        roomDescription: fresh?.description ?? room.room.description,
        podiumPrizes: fresh?.podiumPrizes ?? room.room.podiumPrizes,
      }),
    )
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
        {rooms.map((r) => {
          const isOwner = r.room.type === 'private' && r.room.createdBy === user.uid
          const description = r.room.description?.trim() || 'Sin descripción de sala.'
          return (
            <article key={r.roomId} className="app-room-card" aria-label={`Sala ${r.room.name}`}>
              <Link to={`/room/${r.roomId}/standings`} className="app-room-title-link">
                <h3 className="app-room-title">{r.room.name}</h3>
              </Link>
              <p className="app-room-card-desc">{description}</p>
              <div className="app-room-card-footer">
                <div className="app-room-card-stats">
                  <p className="app-room-card-stat-pts">
                    {r.myPoints != null ? `${r.myPoints} Pts` : 'Sin puntos'}
                  </p>
                  <p className="app-room-card-stat-rank">
                    {r.myRank != null ? `Puesto ${r.myRank}` : 'Sin posición'}
                  </p>
                </div>
                {isOwner ? (
                  <div className="app-room-card-actions" role="group" aria-label="Acciones de sala">
                    <button
                      type="button"
                      className="app-room-card-icon-btn"
                      aria-label="Compartir invitación"
                      title="Compartir"
                      onClick={() => openInviteModal(r.roomId, r.room.inviteCode)}
                    >
                      <ShareIcon />
                    </button>
                    <button
                      type="button"
                      className="app-room-card-icon-btn"
                      aria-label="Configurar sala"
                      title="Configurar sala"
                      onClick={() => openAdminModal(r)}
                    >
                      <RoomSettingsIcon />
                    </button>
                  </div>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>
      {adminRoom ? (
        <PrivateRoomAdminModal
          roomId={adminRoom.roomId}
          roomOwnerId={adminRoom.roomOwnerId}
          roomName={adminRoom.roomName}
          roomDescription={adminRoom.roomDescription}
          podiumPrizes={adminRoom.podiumPrizes}
          onRoomUpdated={async () => {
            const data = await getRoom(adminRoom.roomId)
            setAdminRoom((prev) =>
              prev && data
                ? {
                    ...prev,
                    roomOwnerId: data.createdBy,
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
