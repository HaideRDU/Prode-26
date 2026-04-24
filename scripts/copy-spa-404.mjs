import { copyFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const dist = join(process.cwd(), 'dist')
const indexHtml = join(dist, 'index.html')
const notFoundHtml = join(dist, '404.html')

if (!existsSync(indexHtml)) {
  console.error('[copy-spa-404] dist/index.html no existe. Ejecutá vite build antes.')
  process.exit(1)
}

copyFileSync(indexHtml, notFoundHtml)
console.log('[copy-spa-404] Copiado dist/index.html → dist/404.html (fallback SPA para GitHub Pages).')
