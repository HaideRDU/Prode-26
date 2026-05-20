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

export type LandingBracketMatchData = {
  home: string
  away: string
  score: string
  /** Marcador de penales, p. ej. "4-3" (solo si el tiempo reglamentario empata). */
  penalties?: string
}

export type LandingBracketMatchWithDate = LandingBracketMatchData & {
  date: string
}

export const LANDING_BRACKET_QF_LEFT: LandingBracketMatchWithDate[] = [
  { date: '05 JUL', home: 'NED', away: 'ARG', score: '0-2' },
  { date: '05 JUL', home: 'USA', away: 'MEX', score: '0-0', penalties: '3-4' },
  { date: '06 JUL', home: 'URU', away: 'GHA', score: '1-1', penalties: '4-2' },
  { date: '06 JUL', home: 'COL', away: 'JPN', score: '2-1' },
]

export const LANDING_BRACKET_QF_RIGHT: LandingBracketMatchWithDate[] = [
  { date: '05 JUL', home: 'ENG', away: 'SUI', score: '2-1' },
  { date: '05 JUL', home: 'MAR', away: 'POR', score: '1-0' },
  { date: '06 JUL', home: 'CRO', away: 'BEL', score: '1-1', penalties: '3-4' },
  { date: '06 JUL', home: 'ESP', away: 'GER', score: '1-1', penalties: '2-1' },
]

export const LANDING_BRACKET_SEMIS: LandingBracketMatchData[] = [
  { home: 'BRA', away: 'ESP', score: '2-1' },
  { home: 'FRA', away: 'ARG', score: '1-1', penalties: '4-3' },
]

export const LANDING_BRACKET_THIRD_MATCH: LandingBracketMatchData = {
  home: 'ESP',
  away: 'ARG',
  score: '—',
}

export const LANDING_BRACKET_FINAL_MATCH: LandingBracketMatchData = {
  home: 'BRA',
  away: 'FRA',
  score: '2-1',
}

export const LANDING_BRACKET_FINAL_META = {
  date: '19 Jul',
  venue: 'MetLife Stadium',
}

export const LANDING_HOW_TO_PLAY = [
  {
    title: 'Regístrate o ingresa',
    desc: 'Crea tu usuario y entra al panel de pronósticos.',
  },
  {
    title: 'Revisa el fixture',
    desc: 'Navega por fase: grupos, ronda de 32, octavos, cuartos, semis y final.',
  },
  {
    title: 'Ingresa marcadores',
    desc: 'Usa campos grandes, banderas y estados de guardado visibles.',
  },
  {
    title: 'Guarda antes del cierre',
    desc: 'Los pronósticos generales se bloquean antes del torneo; jugador/partido cierra 1 hora antes.',
  },
  {
    title: 'Acumula puntos',
    desc: 'Cada partido muestra desglose: marcador, ganador, avance y bonus.',
  },
  {
    title: 'Consulta el ranking',
    desc: 'Mira tu puesto, puntos extra y criterios de desempate.',
  },
] as const

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
