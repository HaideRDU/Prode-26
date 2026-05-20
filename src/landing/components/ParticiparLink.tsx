import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function ParticiparLink({
  className = 'landing-btn landing-btn--gold',
  children = 'Participar',
  to = '/login',
}: {
  className?: string
  children?: ReactNode
  to?: string
}) {
  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  )
}
