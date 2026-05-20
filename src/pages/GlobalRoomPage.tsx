import { useEffect } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import type { User } from 'firebase/auth'
import { ensureGlobalRoomMembership } from '../services/roomsService'
import { GLOBAL_ROOM_ID } from '../constants/rooms'
import type { AccountOutletContext } from '../types/outletContext'

const GLOBAL_STANDINGS_PATH = `/room/${GLOBAL_ROOM_ID}/standings`

export function GlobalRoomPage({ user }: { user: User }) {
  const navigate = useNavigate()
  const { publicDisplayName } = useOutletContext<AccountOutletContext>()
  const displayName = publicDisplayName || user.email || 'Usuario'

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await ensureGlobalRoomMembership(user.uid, displayName)
      if (!cancelled) navigate(GLOBAL_STANDINGS_PATH, { replace: true })
    })()
    return () => {
      cancelled = true
    }
  }, [user.uid, displayName, navigate])

  return <p className="user-email">Cargando sala global…</p>
}
