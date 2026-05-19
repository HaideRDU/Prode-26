const SCROLL_END_FALLBACK_MS = 650

let scrollGeneration = 0
let scrollEndFallbackId: ReturnType<typeof setTimeout> | null = null
let scrollEndListener: (() => void) | null = null

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function clearScrollEndListeners(): void {
  if (scrollEndFallbackId !== null) {
    clearTimeout(scrollEndFallbackId)
    scrollEndFallbackId = null
  }
  if (scrollEndListener) {
    window.removeEventListener('scrollend', scrollEndListener)
    scrollEndListener = null
  }
}

function scheduleScrollEndCleanup(generation: number): void {
  const finish = () => {
    if (generation !== scrollGeneration) return
    clearScrollEndListeners()
  }

  if ('onscrollend' in window) {
    scrollEndListener = () => finish()
    window.addEventListener('scrollend', scrollEndListener, { once: true })
  }

  scrollEndFallbackId = setTimeout(finish, SCROLL_END_FALLBACK_MS)
}

/** Scroll suave a una sección (sin overlay ni fade de opacidad en el bloque). */
export function scrollToLandingSection(hash: string): void {
  const id = hash.replace(/^#/, '')
  if (!id) return

  const target = document.getElementById(id)
  if (!target) return

  const generation = ++scrollGeneration
  clearScrollEndListeners()

  const behavior = prefersReducedMotion() ? 'auto' : 'smooth'
  target.scrollIntoView({ behavior, block: 'start' })

  scheduleScrollEndCleanup(generation)
}

/** Vuelve al inicio de la landing sin salto brusco. */
export function scrollToLandingTop(): void {
  const generation = ++scrollGeneration
  clearScrollEndListeners()

  const behavior = prefersReducedMotion() ? 'auto' : 'smooth'
  window.scrollTo({ top: 0, behavior })

  scheduleScrollEndCleanup(generation)
}

export function handleLandingAnchorClick(
  e: { preventDefault: () => void },
  href: string,
): void {
  if (!href.startsWith('#') || href.length < 2) return
  e.preventDefault()
  scrollToLandingSection(href)
  if (typeof history !== 'undefined' && history.pushState) {
    history.pushState(null, '', href)
  }
}

export function handleLandingBrandClick(e: { preventDefault: () => void }): void {
  e.preventDefault()
  scrollToLandingTop()
  if (typeof history !== 'undefined' && history.pushState) {
    history.pushState(null, '', window.location.pathname + window.location.search)
  }
}
