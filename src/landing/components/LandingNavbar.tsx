import { LanguageSwitch } from '../../components/LanguageSwitch'
import { ThemeSwitch } from '../../components/ThemeSwitch'
import { useTranslation } from '../../i18n/LocaleContext'
import type { UiControl } from '../../theme/uiControl'
import { ParticiparLink } from './ParticiparLink'
import { LandingAnchorLink } from './LandingAnchorLink'
import { handleLandingBrandClick } from '../scrollToLandingSection'

const NAV_LINK_KEYS = [
  { href: '#como-jugar', key: 'landing.nav.howItWorks' as const },
  { href: '#puntos', key: 'landing.nav.points' as const },
  { href: '#fixture', key: 'landing.nav.fixtures' as const },
  { href: '#ranking', key: 'landing.nav.ranking' as const },
]

export function LandingNavbar({ uiControl }: { uiControl?: UiControl }) {
  const { t } = useTranslation()

  return (
    <header className="landing-nav">
      <div className="landing-container landing-nav__inner">
        <a
          href="/"
          className="landing-nav__brand"
          aria-label={t('landing.nav.brand')}
          onClick={handleLandingBrandClick}
        >
          <span aria-hidden>🏆</span> Prode <span>26</span>
        </a>
        <nav className="landing-nav__links" aria-label={t('landing.nav.sections')}>
          {NAV_LINK_KEYS.map((l) => (
            <LandingAnchorLink key={l.href} href={l.href} className="landing-nav__link">
              {t(l.key)}
            </LandingAnchorLink>
          ))}
        </nav>
        <div className="landing-nav__actions">
          {uiControl ? (
            <>
              <ThemeSwitch
                value={uiControl.theme}
                onChange={uiControl.onThemeChange}
                className="landing-nav__theme"
              />
              <LanguageSwitch
                value={uiControl.locale}
                onChange={uiControl.onLocaleChange}
                className="landing-nav__lang"
              />
            </>
          ) : null}
          <ParticiparLink />
        </div>
      </div>
    </header>
  )
}
