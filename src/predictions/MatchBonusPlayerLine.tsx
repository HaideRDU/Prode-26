export function MatchBonusPlayerLine({ playerLabel }: { playerLabel?: string | null }) {
  if (!playerLabel?.trim()) return null
  return (
    <p className="pred-match-card__bonus-player app-muted">
      Jugador bonus: <strong>{playerLabel}</strong>
    </p>
  )
}
