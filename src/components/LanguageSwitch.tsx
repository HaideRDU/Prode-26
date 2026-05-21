import './LanguageSwitch.css'
import { I18N_UI_ENABLED, type AppLocale } from '../i18n/appLocale'
import { useTranslation } from '../i18n/LocaleContext'

function LangLabel({ code, active }: { code: string; active: boolean }) {
  return (
    <span className={`lang-switch__label${active ? ' lang-switch__label--active' : ''}`} aria-hidden>
      {code}
    </span>
  )
}

export function LanguageSwitch({
  value,
  onChange,
  className = '',
  variant = 'default',
}: {
  value: AppLocale
  onChange: (locale: AppLocale) => void
  className?: string
  variant?: 'default' | 'auth'
}) {
  const { t } = useTranslation()
  if (!I18N_UI_ENABLED) return null

  const isEn = value === 'en'
  const rootClass = ['lang-switch', variant === 'auth' ? 'lang-switch--auth' : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={rootClass} data-locale={value}>
      <button
        type="button"
        className="lang-switch__btn"
        role="switch"
        aria-checked={isEn}
        aria-label={isEn ? t('lang.switchToEs') : t('lang.switchToEn')}
        onClick={() => onChange(isEn ? 'es' : 'en')}
      >
        <span className="lang-switch__thumb" aria-hidden />
        <span className="lang-switch__track-inner">
          <LangLabel code="ES" active={!isEn} />
          <LangLabel code="ENG" active={isEn} />
        </span>
      </button>
    </div>
  )
}
