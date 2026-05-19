import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function ParticiparLink({
  className = 'landing-btn landing-btn--gold',
  children = 'Participar',
}: {
  className?: string
  children?: ReactNode
}) {
  return (
    <Link to="/login" className={className}>
      {children}
    </Link>
  )
}
