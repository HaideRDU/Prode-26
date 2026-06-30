/**
 * Simula el bracket R32 con los resultados reales de grupos del Mundial 2026.
 * Uso: npx tsx scripts/simulate-r32-bracket.ts
 */
import { WC26_KO_MATCHES } from '../src/data/wc2026/knockoutBracket.js'
import { WC2026_TEAMS_BY_GROUP } from '../src/data/wc2026/teamsByGroup.js'
import { assignThirdsToR32Slots, THIRD_SLOT_ELIGIBLE } from '../src/domain/assignThirdsGreedy.js'
import type { StandingRow } from '../src/domain/groupStandings.js'

// ── Resultados reales de fase de grupos ─────────────────────────────────────
const GROUP_RESULTS: Record<string, { teamId: string; pts: number; gf: number; ga: number }[]> = {
  A: [
    { teamId: 'MEX', pts: 9, gf: 6, ga: 0 },
    { teamId: 'RSA', pts: 4, gf: 2, ga: 3 },
    { teamId: 'KOR', pts: 3, gf: 2, ga: 3 },
    { teamId: 'CZE', pts: 1, gf: 2, ga: 6 },
  ],
  B: [
    { teamId: 'SUI', pts: 7, gf: 7, ga: 3 },
    { teamId: 'CAN', pts: 4, gf: 8, ga: 3 },
    { teamId: 'BIH', pts: 4, gf: 5, ga: 6 },
    { teamId: 'QAT', pts: 1, gf: 2, ga: 10 },
  ],
  C: [
    { teamId: 'BRA', pts: 7, gf: 7, ga: 1 },
    { teamId: 'MAR', pts: 7, gf: 6, ga: 3 },
    { teamId: 'SCO', pts: 3, gf: 1, ga: 4 },
    { teamId: 'HAI', pts: 0, gf: 2, ga: 8 },
  ],
  D: [
    { teamId: 'USA', pts: 6, gf: 8, ga: 4 },
    { teamId: 'AUS', pts: 4, gf: 2, ga: 2 },
    { teamId: 'PAR', pts: 4, gf: 2, ga: 4 },
    { teamId: 'TUR', pts: 3, gf: 3, ga: 5 },
  ],
  E: [
    { teamId: 'GER', pts: 6, gf: 10, ga: 4 },
    { teamId: 'CIV', pts: 6, gf: 4, ga: 2 },
    { teamId: 'ECU', pts: 4, gf: 2, ga: 2 },
    { teamId: 'CUW', pts: 1, gf: 1, ga: 9 },
  ],
  F: [
    { teamId: 'NED', pts: 7, gf: 10, ga: 4 },
    { teamId: 'JPN', pts: 5, gf: 7, ga: 3 },
    { teamId: 'SWE', pts: 4, gf: 7, ga: 7 },
    { teamId: 'TUN', pts: 0, gf: 2, ga: 12 },
  ],
  G: [
    { teamId: 'BEL', pts: 5, gf: 6, ga: 2 },
    { teamId: 'EGY', pts: 5, gf: 5, ga: 3 },
    { teamId: 'IRN', pts: 3, gf: 3, ga: 3 },
    { teamId: 'NZL', pts: 1, gf: 4, ga: 10 },
  ],
  H: [
    { teamId: 'ESP', pts: 7, gf: 5, ga: 0 },
    { teamId: 'CPV', pts: 3, gf: 2, ga: 2 },
    { teamId: 'URU', pts: 2, gf: 3, ga: 4 },
    { teamId: 'KSA', pts: 2, gf: 1, ga: 5 },
  ],
  I: [
    { teamId: 'FRA', pts: 9, gf: 10, ga: 2 },
    { teamId: 'NOR', pts: 6, gf: 8, ga: 7 },
    { teamId: 'SEN', pts: 3, gf: 8, ga: 6 },
    { teamId: 'IRQ', pts: 0, gf: 1, ga: 12 },
  ],
  J: [
    { teamId: 'ARG', pts: 9, gf: 8, ga: 1 },
    { teamId: 'AUT', pts: 4, gf: 6, ga: 6 },
    { teamId: 'ALG', pts: 4, gf: 5, ga: 7 },
    { teamId: 'JOR', pts: 0, gf: 3, ga: 8 },
  ],
  K: [
    { teamId: 'COL', pts: 7, gf: 4, ga: 1 },
    { teamId: 'POR', pts: 5, gf: 6, ga: 1 },
    { teamId: 'COD', pts: 4, gf: 4, ga: 3 },
    { teamId: 'UZB', pts: 0, gf: 2, ga: 11 },
  ],
  L: [
    { teamId: 'ENG', pts: 7, gf: 6, ga: 2 },
    { teamId: 'CRO', pts: 6, gf: 5, ga: 5 },
    { teamId: 'GHA', pts: 4, gf: 2, ga: 2 },
    { teamId: 'PAN', pts: 0, gf: 0, ga: 4 },
  ],
}

// Nombres para mostrar
const NAMES: Record<string, string> = {
  MEX:'México', RSA:'Sudáfrica', KOR:'Corea del Sur', CZE:'Chequia',
  SUI:'Suiza', CAN:'Canadá', BIH:'Bosnia', QAT:'Catar',
  BRA:'Brasil', MAR:'Marruecos', SCO:'Escocia', HAI:'Haití',
  USA:'EE.UU.', AUS:'Australia', PAR:'Paraguay', TUR:'Turquía',
  GER:'Alemania', CIV:'Costa de Marfil', ECU:'Ecuador', CUW:'Curazao',
  NED:'Países Bajos', JPN:'Japón', SWE:'Suecia', TUN:'Túnez',
  BEL:'Bélgica', EGY:'Egipto', IRN:'Irán', NZL:'Nueva Zelanda',
  ESP:'España', CPV:'Cabo Verde', URU:'Uruguay', KSA:'Arabia Saudí',
  FRA:'Francia', NOR:'Noruega', SEN:'Senegal', IRQ:'Irak',
  ARG:'Argentina', AUT:'Austria', ALG:'Argelia', JOR:'Jordania',
  COL:'Colombia', POR:'Portugal', COD:'RD Congo', UZB:'Uzbekistán',
  ENG:'Inglaterra', CRO:'Croacia', GHA:'Ghana', PAN:'Panamá',
}
const n = (id: string) => NAMES[id] ?? id

// ── Extraer 1ro, 2do y 3ro de cada grupo ─────────────────────────────────────
const winners: Record<string, string> = {}
const runners: Record<string, string> = {}
const thirds: { teamId: string; groupId: string; row: StandingRow; rank: number }[] = []

for (const [g, teams] of Object.entries(GROUP_RESULTS)) {
  winners[g] = teams[0].teamId
  runners[g] = teams[1].teamId
  const t = teams[2]
  thirds.push({
    teamId: t.teamId,
    groupId: g,
    row: { teamId: t.teamId, played: 3, points: t.pts, gf: t.gf, ga: t.ga, gd: t.gf - t.ga },
    rank: 0,
  })
}

// Rankear los 12 terceros
thirds.sort((a, b) => {
  if (b.row.points !== a.row.points) return b.row.points - a.row.points
  if (b.row.gd !== a.row.gd) return b.row.gd - a.row.gd
  if (b.row.gf !== a.row.gf) return b.row.gf - a.row.gf
  return a.teamId.localeCompare(b.teamId)
})
thirds.forEach((t, i) => (t.rank = i + 1))

console.log('\n══ RANKING DE LOS 12 TERCEROS ══')
thirds.forEach((t) =>
  console.log(
    `  ${t.rank.toString().padStart(2)}. ${n(t.teamId).padEnd(18)} Grupo ${t.groupId}  ${t.row.points}pts  DG${t.row.gd >= 0 ? '+' : ''}${t.row.gd}  GF${t.row.gf}  ${t.rank <= 8 ? '✅ CLASIFICA' : '❌'}`,
  ),
)

// Top 8
const top8 = thirds.slice(0, 8)

// Asignar 3eros a slots R32
const thirdBySlot = assignThirdsToR32Slots(top8)

console.log('\n══ ASIGNACIÓN DE TERCEROS A SLOTS ══')
for (const [slot, teamId] of [...thirdBySlot.entries()].sort((a, b) => a[0] - b[0])) {
  const eligible = THIRD_SLOT_ELIGIBLE[slot]?.join(',') ?? '?'
  const team = thirds.find((t) => t.teamId === teamId)!
  console.log(`  M${slot} ← ${n(teamId).padEnd(18)} (Grupo ${team.groupId}) | slots elegibles del grupo: [${eligible}]`)
}

// ── Resolver todos los cruces R32 ────────────────────────────────────────────
function resolveTeam(side: { kind: string; group?: string; matchNum?: number }): string {
  if (side.kind === 'group_winner') return winners[side.group!] ?? '?'
  if (side.kind === 'group_runner') return runners[side.group!] ?? '?'
  if (side.kind === 'third_slot') return thirdBySlot.get(side.matchNum!) ?? '(sin 3ro)'
  return '?'
}

const r32 = WC26_KO_MATCHES.filter((m) => m.round === 'r32')

console.log('\n══ CRUCES R32 ══════════════════════════════')
for (const m of r32) {
  const a = resolveTeam(m.home as { kind: string; group?: string; matchNum?: number })
  const b = resolveTeam(m.away as { kind: string; group?: string; matchNum?: number })
  const homeLabel = m.home.kind === 'group_winner' ? `1° Gpo ${(m.home as { group: string }).group}` :
                    m.home.kind === 'group_runner' ? `2° Gpo ${(m.home as { group: string }).group}` : `3° slot`
  const awayLabel = m.away.kind === 'group_winner' ? `1° Gpo ${(m.away as { group: string }).group}` :
                    m.away.kind === 'group_runner' ? `2° Gpo ${(m.away as { group: string }).group}` : `3° slot`
  console.log(`  M${m.matchNum}  ${n(a).padEnd(18)} [${homeLabel}]  vs  ${n(b).padEnd(18)} [${awayLabel}]`)
}
