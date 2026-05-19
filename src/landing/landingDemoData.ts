import { WC2026_TEAMS_BY_GROUP } from '../data/wc2026/teamsByGroup'
import { GROUP_STAGE_SCHEDULE } from '../data/wc2026/groupStageSchedule'

export const TEAM_NAME_ES: Record<string, string> = Object.fromEntries(
  WC2026_TEAMS_BY_GROUP.map((t) => [t.teamId, t.nameEs]),
)

export const LANDING_FIXTURE_MATCHES = GROUP_STAGE_SCHEDULE.slice(0, 8).map((m, i) => ({
  ...m,
  city: ['Nueva York', 'Los Ángeles', 'Dallas', 'Miami', 'Atlanta', 'Seattle', 'Houston', 'Boston'][i % 8],
  status: i % 3 === 0 ? ('pendiente' as const) : ('guardado' as const),
  potentialPts: i % 3 === 0 ? 5 : 6,
  predHome: i % 2 === 0 ? 2 : 1,
  predAway: i % 2 === 0 ? 1 : 0,
}))

export const LANDING_RANKING = [
  { rank: 1, name: 'carlos_mx', pts: 248, exact: 12, trend: '+18' },
  { rank: 2, name: 'ana_prode', pts: 231, exact: 10, trend: '+12' },
  { rank: 3, name: 'tú (demo)', pts: 214, exact: 9, trend: '+24', highlight: true },
  { rank: 4, name: 'diego_ko', pts: 198, exact: 8, trend: '+6' },
  { rank: 5, name: 'lucia_26', pts: 187, exact: 7, trend: '+3' },
]

export const LANDING_BRACKET_ROUNDS = [
  {
    id: 'sf',
    label: 'Semifinales',
    matches: [
      { home: 'BRA', away: 'ESP', score: '2-1' },
      { home: 'FRA', away: 'ARG', score: '1-1' },
    ],
  },
  {
    id: 'final',
    label: 'Final',
    matches: [{ home: 'BRA', away: 'FRA', score: '—', champion: 'BRA' }],
  },
]

export const LANDING_STEPS = [
  { title: 'Unite', desc: 'Crea o únete a una sala con código de invitación.', progress: 100 },
  { title: 'Predice', desc: 'Marcadores, llaves y preguntas especiales antes del pitazo.', progress: 68 },
  { title: 'Compite', desc: 'Suma puntos en vivo cuando cierran los partidos.', progress: 42 },
  { title: 'Sube en el ranking', desc: 'Desempate por exactos, especiales y campeón.', progress: 24 },
]

export const LANDING_FEATURES = [
  {
    icon: '🏟️',
    title: 'Salas privadas',
    desc: 'Juega con amigos, familia o la oficina. Cada sala tiene su clasificación.',
  },
  {
    icon: '⚽',
    title: 'Predicciones completas',
    desc: 'Fase de grupos, eliminatorias, avance y extras del Mundial 2026.',
  },
  {
    icon: '📊',
    title: 'Ranking en vivo',
    desc: 'Puntos actualizados automáticamente. Siempre sabes tu posición.',
  },
]
