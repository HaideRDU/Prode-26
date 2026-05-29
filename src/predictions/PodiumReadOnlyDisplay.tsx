/** Podio en solo lectura — sin efectos ni escrituras a Firestore. */
export function PodiumReadOnlyDisplay({
  teamLabel,
  firstId,
  secondId,
  thirdId,
  fourthId,
  sectionIndex = 1,
}: {
  teamLabel: (id: string | null | undefined) => string
  firstId: string | null
  secondId: string | null
  thirdId: string | null
  fourthId: string | null
  sectionIndex?: number
}) {
  function name(id: string | null) {
    return id ? teamLabel(id) : '—'
  }

  return (
    <section className="pred-podium-section">
      <h2 className="pred-section-title">{sectionIndex} · Podio</h2>
      <div className="pred-podium-grid pred-podium-grid--readonly">
        <div className="pred-podium-slot">
          <span className="pred-podium-rank">1º</span>
          <span className="pred-podium-name">{name(firstId)}</span>
        </div>
        <div className="pred-podium-slot">
          <span className="pred-podium-rank">2º</span>
          <span className="pred-podium-name">{name(secondId)}</span>
        </div>
        <div className="pred-podium-slot">
          <span className="pred-podium-rank">3º</span>
          <span className="pred-podium-name">{name(thirdId)}</span>
        </div>
        <div className="pred-podium-slot">
          <span className="pred-podium-rank">4º</span>
          <span className="pred-podium-name">{name(fourthId)}</span>
        </div>
      </div>
    </section>
  )
}
