type Props = {
  delta: number
  size?: 'sm' | 'lg'
}

export function RankMovementBadge({ delta, size = 'sm' }: Props) {
  const base = size === 'lg' ? 'standings-move standings-move--lg' : 'standings-move'

  if (delta > 0) {
    return (
      <span className={`${base} standings-move--up`} aria-label={`Subió ${delta} puestos`}>
        ↑ {delta}
      </span>
    )
  }
  if (delta < 0) {
    const down = Math.abs(delta)
    return (
      <span className={`${base} standings-move--down`} aria-label={`Bajó ${down} puestos`}>
        ↓ {down}
      </span>
    )
  }
  return (
    <span className={`${base} standings-move--flat`} aria-label="Sin cambio de puesto">
      — 0
    </span>
  )
}

export function rankMovementSummary(delta: number): string {
  if (delta > 0) {
    return `Subiste ${delta} ${delta === 1 ? 'posición' : 'posiciones'} desde la última actualización.`
  }
  if (delta < 0) {
    const down = Math.abs(delta)
    return `Bajaste ${down} ${down === 1 ? 'posición' : 'posiciones'} desde la última actualización.`
  }
  return 'Te mantuviste en el mismo puesto desde la última actualización.'
}

export function formatRankOrdinal(rank: number): string {
  if (!Number.isFinite(rank) || rank < 1) return '—'
  return `${rank}° lugar`
}
