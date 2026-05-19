export function LandingTooltip({ label, tip }: { label: string; tip: string }) {
  return (
    <span className="landing-tip-wrap">
      {label}
      <button type="button" className="landing-tip-btn" aria-label={tip}>
        ?
      </button>
      <span className="landing-tip-panel" role="tooltip">
        {tip}
      </span>
    </span>
  )
}
