import { Link } from 'react-router-dom'
import type { User } from 'firebase/auth'
import { PrivateRoomsList } from '../rooms/PrivateRoomsList'

export function SalasPage({ user }: { user: User }) {
  return (
    <div>
      <div className="app-page-header-row">
        <h1 className="app-page-title">Salas</h1>
        <Link to="/rooms" className="btn-secondary app-salas-create-link">
          + Crear o unirse
        </Link>
      </div>
      <p className="auth-lead" style={{ textAlign: 'left', marginBottom: '20px' }}>
        Tus salas privadas de predicción. La sala global está en su propia sección del menú.
      </p>
      <PrivateRoomsList user={user} />
    </div>
  )
}
