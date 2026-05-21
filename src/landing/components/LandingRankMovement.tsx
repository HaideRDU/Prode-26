type Props = {
  delta: number
}

export function LandingRankMovement({ delta }: Props) {
  if (delta > 0) {
    return (
      <span className="landing-rank-move landing-rank-move--up" aria-label={`Subió ${delta} puestos`}>
        ↑ {delta}
      </span>
    )
  }
  if (delta < 0) {
    const down = Math.abs(delta)
    return (
      <span className="landing-rank-move landing-rank-move--down" aria-label={`Bajó ${down} puestos`}>
        ↓ {down}
      </span>
    )
  }
  return (
    <span className="landing-rank-move landing-rank-move--flat" aria-label="Sin cambio de puesto">
      — 0
    </span>
  )
}
