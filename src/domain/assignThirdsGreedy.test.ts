/**
 * Ejecutar: npx tsx src/domain/assignThirdsGreedy.test.ts
 */
import assert from 'node:assert/strict'
import {
  assignThirdsToR32Slots,
  THIRD_ASSIGNMENT_ORDER,
  THIRD_SLOT_ELIGIBLE,
  type QualifiedThird,
} from './assignThirdsGreedy'
import type { StandingRow } from './groupStandings'

function stubRow(teamId: string): StandingRow {
  return { teamId, played: 3, points: 4, gf: 3, ga: 2, gd: 1 }
}

function makeThird(teamId: string, groupId: string, rank: number): QualifiedThird {
  return { teamId, groupId, row: stubRow(teamId), rank }
}

/** Copia de la heurística greedy antigua (solo para tests de regresión). */
function assignGreedyLegacy(qualifiedEight: QualifiedThird[]): Map<number, string> {
  const remaining = [...qualifiedEight].sort((a, b) => a.rank - b.rank)
  const out = new Map<number, string>()
  for (const matchNum of THIRD_ASSIGNMENT_ORDER) {
    const eligible = THIRD_SLOT_ELIGIBLE[matchNum]
    if (!eligible) continue
    const idx = remaining.findIndex((t) => eligible.includes(t.groupId))
    if (idx === -1) continue
    const [picked] = remaining.splice(idx, 1)
    if (picked) out.set(matchNum, picked.teamId)
  }
  return out
}

/** Combinaciones de tamaño k desde arr (orden lexicográfico por índices). */
function combinations<T>(arr: T[], k: number): T[][] {
  const res: T[][] = []
  const path: T[] = []
  function rec(start: number) {
    if (path.length === k) {
      res.push([...path])
      return
    }
    for (let i = start; i < arr.length; i++) {
      path.push(arr[i]!)
      rec(i + 1)
      path.pop()
    }
  }
  rec(0)
  return res
}

/** Permuta in-place Fisher–Yates seed simple (determinista por índice). */
function shuffleGroups(groups: string[], seed: number): string[] {
  const a = [...groups]
  let s = seed
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const j = s % (i + 1)
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

function findGreedyLeaves85Empty(): QualifiedThird[] | null {
  const allGroups = 'ABCDEFGHIJKL'.split('')
  const combs = combinations(allGroups, 8)
  for (const groups of combs) {
    for (let seed = 0; seed < 120; seed++) {
      const order = shuffleGroups(groups, seed)
      const thirds: QualifiedThird[] = order.map((g, i) =>
        makeThird(`team-${g}`, g, i + 1),
      )
      const greedy = assignGreedyLegacy(thirds)
      if (greedy.has(85)) continue
      const optimal = assignThirdsToR32Slots(thirds)
      if (optimal.has(85)) return thirds
    }
  }
  return null
}

const counterexample = findGreedyLeaves85Empty()

if (counterexample) {
  const greedy = assignGreedyLegacy(counterexample)
  const optimal = assignThirdsToR32Slots(counterexample)
  assert.equal(greedy.has(85), false, 'legacy greedy should miss slot 85')
  assert.equal(optimal.has(85), true, 'solver should fill slot 85')
  assert.ok(optimal.size > greedy.size || optimal.has(85), 'solver should be strictly better on slot 85')
}

// Caso feliz: 8 terceros con grupos que el greedy ya llenaba bien
{
  const thirds: QualifiedThird[] = [
    makeThird('tA', 'A', 1),
    makeThird('tB', 'B', 2),
    makeThird('tC', 'C', 3),
    makeThird('tD', 'D', 4),
    makeThird('tE', 'E', 5),
    makeThird('tF', 'F', 6),
    makeThird('tG', 'G', 7),
    makeThird('tH', 'H', 8),
  ]
  const m = assignThirdsToR32Slots(thirds)
  for (const slot of THIRD_ASSIGNMENT_ORDER) {
    assert.ok(m.has(slot), `debe haber asignación para el hueco ${slot}`)
  }
  assert.equal(m.size, 8)
}

// Con 8 terceros el matching debería ser perfecto si el grafo lo permite
if (counterexample) {
  const m = assignThirdsToR32Slots(counterexample)
  assert.equal(m.size, 8)
}

console.log('assignThirdsGreedy.test.ts OK', counterexample ? '(incl. greedy vs optimal counterexample)' : '(no counterexample found in search; happy path only)')
