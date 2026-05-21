import { useMemo } from 'react'
import { useLocation, useMatch } from 'react-router-dom'
import { GLOBAL_ROOM_ID } from '../constants/rooms'
import { useTranslation } from '../i18n/LocaleContext'
import type { MessageKey } from '../i18n/messages'

function titleKeyForPath(pathname: string): MessageKey {
  if (pathname.includes('/predictions')) return 'topbar.predictions'
  if (pathname.includes('/standings')) {
    if (pathname.includes(`/room/${GLOBAL_ROOM_ID}/`)) return 'nav.globalRoom'
    return 'topbar.standings'
  }
  if (pathname.startsWith('/salas')) return 'nav.rooms'
  if (pathname.startsWith('/rooms')) return 'nav.createOrJoin'
  if (pathname.startsWith('/reglamento')) return 'nav.rules'
  if (pathname.startsWith('/sala-global')) return 'nav.globalRoom'
  if (pathname.startsWith('/inicio')) return 'nav.home'
  return 'nav.home'
}

export function useTopbarTitle(): string {
  const { pathname } = useLocation()
  const predictionsMatch = useMatch('/room/:roomId/predictions')
  const standingsMatch = useMatch('/room/:roomId/standings')
  const { t } = useTranslation()

  return useMemo(() => {
    if (predictionsMatch) return t('topbar.predictions')
    if (standingsMatch) {
      return standingsMatch.params.roomId === GLOBAL_ROOM_ID
        ? t('nav.globalRoom')
        : t('topbar.standings')
    }
    return t(titleKeyForPath(pathname))
  }, [pathname, predictionsMatch, standingsMatch, t])
}
