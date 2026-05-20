import { useEffect, useId, useRef, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import type { User } from 'firebase/auth'
import type { AccountOutletContext } from '../types/outletContext'
import { useTranslation } from '../i18n/LocaleContext'
import { ProfilePanel } from './ProfilePanel'
import './MainLayout.css'
import './app-shell-wc26.css'

export function MainLayout({
  user,
  publicDisplayName,
  accountOutletContext,
}: {
  user: User
  publicDisplayName: string
  accountOutletContext: AccountOutletContext
}) {
  const [navMenuOpen, setNavMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const navMenuId = useId()
  const profileMenuId = useId()

  const navTriggerRef = useRef<HTMLButtonElement>(null)
  const navPopoverRef = useRef<HTMLDivElement>(null)
  const profileTriggerRef = useRef<HTMLButtonElement>(null)
  const profilePopoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!navMenuOpen && !profileOpen) return
    function onPointerDownCapture(e: PointerEvent) {
      const t = e.target as Node | null
      if (!t) return
      if (navPopoverRef.current?.contains(t) || navTriggerRef.current?.contains(t)) return
      if (profilePopoverRef.current?.contains(t) || profileTriggerRef.current?.contains(t)) return
      setNavMenuOpen(false)
      setProfileOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDownCapture, true)
    return () => document.removeEventListener('pointerdown', onPointerDownCapture, true)
  }, [navMenuOpen, profileOpen])

  useEffect(() => {
    if (!navMenuOpen && !profileOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setNavMenuOpen(false)
        setProfileOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navMenuOpen, profileOpen])

  const { t } = useTranslation()

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `app-sidebar-link ${isActive ? 'active' : ''}`

  return (
    <div className="app-shell app-shell--wc26">
      <div className="app-main-column">
        <header className="app-topbar">
          <div className="app-topbar-menu-wrap">
            <button
              ref={navTriggerRef}
              type="button"
              className="app-topbar-menu-btn"
              onClick={() => {
                setProfileOpen(false)
                setNavMenuOpen((o) => !o)
              }}
              aria-label={t('nav.openMenu')}
              aria-expanded={navMenuOpen}
              aria-haspopup="menu"
              aria-controls={navMenuId}
            >
              ☰
            </button>
            {navMenuOpen ? (
              <div
                ref={navPopoverRef}
                id={navMenuId}
                className="app-nav-dropdown"
                role="menu"
                aria-label={t('nav.menuLabel')}
              >
                <nav className="app-nav-dropdown-nav">
                  <NavLink to="/inicio" end className={navClass} role="menuitem" onClick={() => setNavMenuOpen(false)}>
                    <span className="app-sidebar-icon" aria-hidden>
                      ⌂
                    </span>
                    <span className="app-sidebar-label">{t('nav.home')}</span>
                  </NavLink>
                  <NavLink to="/salas" className={navClass} role="menuitem" onClick={() => setNavMenuOpen(false)}>
                    <span className="app-sidebar-icon" aria-hidden>
                      ⊞
                    </span>
                    <span className="app-sidebar-label">{t('nav.rooms')}</span>
                  </NavLink>
                  <NavLink
                    to="/room/global/standings"
                    className={navClass}
                    role="menuitem"
                    onClick={() => setNavMenuOpen(false)}
                  >
                    <span className="app-sidebar-icon" aria-hidden>
                      ◎
                    </span>
                    <span className="app-sidebar-label">{t('nav.globalRoom')}</span>
                  </NavLink>
                  <NavLink to="/rooms" className={navClass} role="menuitem" onClick={() => setNavMenuOpen(false)}>
                    <span className="app-sidebar-icon" aria-hidden>
                      +
                    </span>
                    <span className="app-sidebar-label">{t('nav.createOrJoin')}</span>
                  </NavLink>
                  <NavLink
                    to="/reglamento"
                    end
                    className={navClass}
                    role="menuitem"
                    onClick={() => setNavMenuOpen(false)}
                  >
                    <span className="app-sidebar-icon" aria-hidden>
                      §
                    </span>
                    <span className="app-sidebar-label">{t('nav.rules')}</span>
                  </NavLink>
                </nav>
              </div>
            ) : null}
          </div>
          <h1 className="app-topbar-title">{t('topbar.title')}</h1>
          <div className="app-topbar-spacer" />
          <div className="app-topbar-profile-wrap">
            <button
              ref={profileTriggerRef}
              type="button"
              className="app-profile-trigger"
              onClick={() => {
                setNavMenuOpen(false)
                setProfileOpen((o) => !o)
              }}
              aria-expanded={profileOpen}
              aria-haspopup="dialog"
              aria-controls={profileMenuId}
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt=""
                  className="app-profile-trigger-avatar"
                  width={36}
                  height={36}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="app-profile-trigger-avatar-fallback">
                  {publicDisplayName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="app-profile-trigger-name">{publicDisplayName}</span>
            </button>
            {profileOpen ? (
              <div
                ref={profilePopoverRef}
                id={profileMenuId}
                className="app-profile-popover"
                role="dialog"
                aria-label={t('nav.profileDialog')}
              >
                <ProfilePanel ctx={accountOutletContext} onClose={() => setProfileOpen(false)} />
              </div>
            ) : null}
          </div>
        </header>

        <main className="app-main">
          {accountOutletContext.authError ? (
            <p className="auth-error" role="alert" style={{ marginBottom: 12 }}>
              {accountOutletContext.authError}
            </p>
          ) : null}
          {accountOutletContext.info ? (
            <p className="auth-info" role="status" style={{ marginBottom: 12 }}>
              {accountOutletContext.info}
            </p>
          ) : null}
          <Outlet context={accountOutletContext} />
        </main>
      </div>
    </div>
  )
}
