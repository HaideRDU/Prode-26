import { createPortal } from 'react-dom'
import { useEffect, type ReactNode } from 'react'
import './modal-portal.css'

type Props = {
  children: ReactNode
  /** Bloquea scroll del fondo mientras el modal está abierto. */
  lockScroll?: boolean
}

/** Renderiza modales en document.body para cubrir topbar y evitar recortes de overflow. */
export function ModalPortal({ children, lockScroll = true }: Props) {
  useEffect(() => {
    if (!lockScroll) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [lockScroll])

  return createPortal(children, document.body)
}
