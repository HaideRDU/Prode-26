import { useEffect, useState } from 'react'
import { flagImageUrl } from '../data/wc2026/teamFlagAlpha2'

type FlagWidth = 20 | 24 | 40

export function TeamFlagName({
  teamId,
  name,
  size = 40,
  compact = false,
  layout = 'inline',
}: {
  teamId: string
  name: string
  size?: 24 | 40
  /** Fila densa: bandera pequeña y texto truncado (solo modo inline). */
  compact?: boolean
  /** `stack`: bandera arriba, nombre completo debajo (grupos). */
  layout?: 'inline' | 'stack'
}) {
  const isStack = layout === 'stack'
  const effSize: FlagWidth = isStack ? 40 : compact ? 24 : size
  const src = flagImageUrl(teamId, effSize)
  const [imgBroken, setImgBroken] = useState(false)

  useEffect(() => {
    setImgBroken(false)
  }, [teamId, src])

  const imgW = effSize
  const imgH = Math.round(effSize * 0.75)
  const showImg = Boolean(src) && !imgBroken

  const rootClass = [
    'team-flag-name',
    compact && !isStack ? 'team-flag-name--compact' : '',
    isStack ? 'team-flag-name--stack' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <span className={rootClass}>
      {showImg ? (
        <img
          className="team-flag-name__flag"
          src={src}
          alt=""
          width={imgW}
          height={imgH}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImgBroken(true)}
        />
      ) : (
        <span className="team-flag-name__placeholder" aria-hidden />
      )}
      <span className="team-flag-name__text">{name}</span>
    </span>
  )
}
