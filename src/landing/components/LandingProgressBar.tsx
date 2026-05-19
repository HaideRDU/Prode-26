export function LandingProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div
      className="landing-progress"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="landing-progress__fill" style={{ width: `${pct}%` }} />
    </div>
  )
}
