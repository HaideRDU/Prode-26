import type { ReactNode } from 'react'

export function LandingBadge({
  children,
  variant = 'gold',
}: {
  children: ReactNode
  variant?: 'gold' | 'lime' | 'emerald' | 'slate'
}) {
  return <span className={`landing-badge landing-badge--${variant}`}>{children}</span>
}
