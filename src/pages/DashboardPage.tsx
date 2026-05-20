import type { User } from 'firebase/auth'
import { InicioHomeHero } from '../inicio/InicioHomeHero'

export function DashboardPage({ user: _user }: { user: User }) {
  return <InicioHomeHero />
}
