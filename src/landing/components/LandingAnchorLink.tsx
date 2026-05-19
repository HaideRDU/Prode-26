import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { handleLandingAnchorClick } from '../scrollToLandingSection'

export function LandingAnchorLink({
  href,
  className,
  children,
  ...rest
}: {
  href: string
  className?: string
  children: ReactNode
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'className' | 'children'>) {
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => handleLandingAnchorClick(e, href)}
      {...rest}
    >
      {children}
    </a>
  )
}
