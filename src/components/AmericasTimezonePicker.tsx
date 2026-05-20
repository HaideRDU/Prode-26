import {
  AMERICAS_TIMEZONE_GROUPS,
  getZonesForRegion,
  normalizeAmericasTimeZone,
  type AmericasRegion,
} from '../data/americasTimezones'
import { useTranslation } from '../i18n/LocaleContext'
import './americas-timezone-picker.css'

type Props = {
  region: AmericasRegion
  timeZone: string
  onRegionChange: (region: AmericasRegion) => void
  onTimeZoneChange: (timeZone: string) => void
  disabled?: boolean
  variant?: 'auth' | 'profile'
  idPrefix?: string
}

import type { MessageKey } from '../i18n/messages'

const REGION_LABEL_KEYS: Record<AmericasRegion, MessageKey> = {
  north: 'tz.regionNorth',
  central: 'tz.regionCentral',
  south: 'tz.regionSouth',
}

export function AmericasTimezonePicker({
  region,
  timeZone,
  onRegionChange,
  onTimeZoneChange,
  disabled = false,
  variant = 'profile',
  idPrefix = 'tz',
}: Props) {
  const { t } = useTranslation()
  const zones = getZonesForRegion(region)
  const inputClass = variant === 'auth' ? 'auth-wc26-input' : 'field-input americas-tz-picker__select'

  function handleRegionChange(nextRegion: AmericasRegion) {
    onRegionChange(nextRegion)
    const nextZones = getZonesForRegion(nextRegion)
    const currentInRegion = nextZones.some((z) => z.id === timeZone)
    if (!currentInRegion && nextZones[0]) {
      onTimeZoneChange(nextZones[0].id)
    }
  }

  return (
    <div className={`americas-tz-picker americas-tz-picker--${variant}`}>
      <div className="americas-tz-picker__field">
        <label className="americas-tz-picker__label" htmlFor={`${idPrefix}-region`}>
          {t('tz.region')}
        </label>
        <select
          id={`${idPrefix}-region`}
          className={inputClass}
          value={region}
          disabled={disabled}
          onChange={(e) => handleRegionChange(e.target.value as AmericasRegion)}
        >
          {AMERICAS_TIMEZONE_GROUPS.map((g) => (
            <option key={g.id} value={g.id}>
              {t(REGION_LABEL_KEYS[g.id])}
            </option>
          ))}
        </select>
      </div>
      <div className="americas-tz-picker__field">
        <label className="americas-tz-picker__label" htmlFor={`${idPrefix}-zone`}>
          {t('tz.city')}
        </label>
        <select
          id={`${idPrefix}-zone`}
          className={inputClass}
          value={normalizeAmericasTimeZone(timeZone, region)}
          disabled={disabled}
          onChange={(e) => onTimeZoneChange(e.target.value)}
        >
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.labelEs}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
