import './rank-position-badge.css'

const MEDAL_LABEL: Record<1 | 2 | 3, string> = {
  1: '1.er puesto',
  2: '2.º puesto',
  3: '3.er puesto',
}

const MEDAL_ICON: Record<1 | 2 | 3, string> = {
  1: '🏆',
  2: '🥈',
  3: '🥉',
}

type Props = {
  rank: number
  /** Clase para posiciones 4+ (número). */
  numberClassName?: string
}

export function RankPositionBadge({
  rank,
  numberClassName = 'standings-rank-pos',
}: Props) {
  if (rank >= 1 && rank <= 3) {
    const r = rank as 1 | 2 | 3
    return (
      <span className="rank-position-medal" aria-label={MEDAL_LABEL[r]} title={MEDAL_LABEL[r]}>
        {MEDAL_ICON[r]}
      </span>
    )
  }
  if (!Number.isFinite(rank) || rank < 1) {
    return <span className={numberClassName}>—</span>
  }
  return <span className={numberClassName}>{rank}</span>
}
