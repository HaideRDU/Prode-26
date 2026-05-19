import type { ReactNode } from 'react'

export function LandingSection({
  id,
  tone,
  children,
}: {
  id?: string
  tone: 'navy' | 'cream'
  children: ReactNode
}) {
  return (
    <section id={id} className={`landing-section landing-section--${tone}`}>
      <div className="landing-container">{children}</div>
    </section>
  )
}
