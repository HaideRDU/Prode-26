import { Link } from 'react-router-dom'
import { ReglamentoPage } from './ReglamentoPage'

/** Reglamento para visitantes sin sesión (landing); usuarios autenticados usan la ruta dentro de MainLayout. */
export function ReglamentoPublicPage() {
  return (
    <div className="reglamento-public-shell">
      <header className="reglamento-public-bar">
        <Link to="/" className="btn-secondary reglamento-public-back">
          ← Volver al inicio
        </Link>
      </header>
      <main className="reglamento-public-main">
        <ReglamentoPage />
      </main>
    </div>
  )
}
