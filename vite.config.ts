import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

function normalizeBase(raw: string | undefined): string {
  const t = raw?.trim()
  if (!t || t === '/') return '/'
  const withSlash = t.startsWith('/') ? t : `/${t}`
  return withSlash.endsWith('/') ? withSlash : `${withSlash}/`
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: normalizeBase(process.env.VITE_BASE_PATH),
  // Honrar el puerto asignado por el entorno (p.ej. preview/autoPort vía PORT env);
  // Vite no lee PORT por defecto. Sin PORT usa el default (5173) en local.
  server: process.env.PORT ? { port: Number(process.env.PORT) } : undefined,
  plugins: [
    react(),
    mode === 'analyze' &&
      visualizer({
        filename: 'dist/stats.html',
        gzipSize: true,
        brotliSize: true,
        open: true,
      }),
  ].filter(Boolean),
}))
