/**
 * Asigna los terceros clasificados a los huecos R32 (M74, M77, … M87).
 * Restricciones: `THIRD_SLOT_ELIGIBLE` (FIFA / Wikipedia 2026).
 *
 * Usa matching bipartito (cardinalidad máxima; con 8 terceros se busca matching perfecto)
 * y desempate determinista por suma mínima de `rank` + orden lexicográfico de asignación.
 */
import type { StandingRow } from './groupStandings'

export type QualifiedThird = {
  teamId: string
  groupId: string
  row: StandingRow
  rank: number
}

/** Grupos elegibles para el tercero en cada partido (FIFA / Wikipedia 2026). */
export const THIRD_SLOT_ELIGIBLE: Readonly<Record<number, readonly string[]>> = {
  74: ['A', 'B', 'C', 'D', 'F'],
  77: ['C', 'D', 'F', 'G', 'H'],
  79: ['C', 'E', 'F', 'H', 'I'],
  80: ['E', 'H', 'I', 'J', 'K'],
  81: ['B', 'E', 'F', 'I', 'J'],
  82: ['A', 'E', 'H', 'I', 'J'],
  85: ['E', 'F', 'G', 'I', 'J'],
  87: ['D', 'E', 'I', 'J', 'L'],
}

export const THIRD_ASSIGNMENT_ORDER = [74, 77, 79, 80, 81, 82, 85, 87] as const

function rankSumForMap(
  m: Map<number, string>,
  teamsById: Map<string, QualifiedThird>,
): number {
  let s = 0
  for (const teamId of m.values()) {
    s += teamsById.get(teamId)?.rank ?? 0
  }
  return s
}

/** Clave lexicográfica estable para desempatar matchings con misma cardinalidad y suma de ranks */
function lexKey(m: Map<number, string>): string {
  return [...m.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([slot, tid]) => `${slot}:${tid}`)
    .join('|')
}

function isBetterCandidate(
  cand: Map<number, string>,
  best: Map<number, string> | null,
  teamsById: Map<string, QualifiedThird>,
): boolean {
  if (!best) return true
  const c = cand.size
  const b = best.size
  if (c !== b) return c > b
  const rsC = rankSumForMap(cand, teamsById)
  const rsB = rankSumForMap(best, teamsById)
  if (rsC !== rsB) return rsC < rsB
  return lexKey(cand) < lexKey(best)
}

/**
 * matchNum → teamId del tercero asignado a ese cruce.
 * Cardinalidad máxima posible; con 8 terceros y grafo válido, 8 asignaciones.
 */
export function assignThirdsToR32Slots(qualifiedEight: QualifiedThird[]): Map<number, string> {
  const teams = [...qualifiedEight].sort((a, b) => a.rank - b.rank)
  const nT = teams.length
  const nS = THIRD_ASSIGNMENT_ORDER.length
  if (nT === 0) return new Map()

  const teamsById = new Map(teams.map((t) => [t.teamId, t]))
  const used: boolean[] = new Array(nT).fill(false)

  let best: Map<number, string> | null = null

  function maxAdditionalMatches(si: number, curSize: number): number {
    let unused = 0
    for (let i = 0; i < nT; i++) if (!used[i]) unused++
    const slotsLeft = nS - si
    return curSize + Math.min(slotsLeft, unused)
  }

  function dfs(si: number, cur: Map<number, string>) {
    if (best && maxAdditionalMatches(si, cur.size) < best.size) return

    if (si >= nS) {
      if (isBetterCandidate(cur, best, teamsById)) best = new Map(cur)
      return
    }

    const matchNum = THIRD_ASSIGNMENT_ORDER[si]
    const eligible = THIRD_SLOT_ELIGIBLE[matchNum]
    if (!eligible) {
      dfs(si + 1, cur)
      return
    }

    dfs(si + 1, cur)

    for (let ti = 0; ti < nT; ti++) {
      if (used[ti]) continue
      if (!eligible.includes(teams[ti].groupId)) continue
      used[ti] = true
      cur.set(matchNum, teams[ti].teamId)
      dfs(si + 1, cur)
      cur.delete(matchNum)
      used[ti] = false
    }
  }

  dfs(0, new Map())

  const out = best ?? new Map()

  const devDiag = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production'
  if (devDiag && nT === nS) {
    const missing = THIRD_ASSIGNMENT_ORDER.filter((mn) => !out.has(mn))
    if (missing.length > 0) {
      console.warn(
        '[assignThirdsToR32Slots] 8 terceros pero matching incompleto; huecos sin asignar:',
        missing.join(', '),
        '— revisar THIRD_SLOT_ELIGIBLE o datos de entrada.',
      )
    }
  }

  return out
}
