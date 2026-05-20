import type { ReactNode } from 'react'

export function LandingSection({
  id,
  tone,
  compactEdge,
  children,
}: {
  id?: string
  tone: 'navy' | 'cream'
  /** Menos padding arriba o abajo al borde con la sección vecina. */
  compactEdge?: 'top' | 'bottom' | 'both'
  children: ReactNode
}) {
  const edgeClass =
    compactEdge === 'top'
      ? ' landing-section--compact-top'
      : compactEdge === 'bottom'
        ? ' landing-section--compact-bottom'
        : compactEdge === 'both'
          ? ' landing-section--compact-top landing-section--compact-bottom'
          : ''

  return (
    <section id={id} className={`landing-section landing-section--${tone}${edgeClass}`}>
      <div className="landing-container">{children}</div>
    </section>
  )
}
