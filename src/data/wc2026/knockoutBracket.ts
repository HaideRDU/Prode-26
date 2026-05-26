/**
 * Cuadro eliminatorio FIFA Mundial 2026 (R32 → final + 3º puesto).
 * Números de partido oficiales 73–104; IDs Firestore/predicción: wc26-ko-{n}.
 *
 * Emparejamientos R32 y árbol R16+ según Wikipedia / calendario FIFA (feb 2024 schedule).
 * Asignación de terceros a cruces: ver `assignThirdsGreedy.ts` (heurística orden FIFA).
 */
export type KoSideDef =
  | { kind: 'group_winner'; group: string }
  | { kind: 'group_runner'; group: string }
  | { kind: 'third_slot'; matchNum: number }

export type KoBracketSide = KoSideDef | { kind: 'winner_of'; matchNum: number } | { kind: 'loser_of'; matchNum: number }

export interface KoMatchTemplate {
  /** 73–104 */
  matchNum: number
  round: 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final'
  home: KoBracketSide
  away: KoBracketSide
}

export function koMatchDocId(matchNum: number): string {
  return `wc26-ko-${matchNum}`
}

/** R32: lados según secciones oficiales (Equipo A = primera columna en FIFA). */
export const WC26_KO_MATCHES: readonly KoMatchTemplate[] = [
  { matchNum: 73, round: 'r32', home: { kind: 'group_runner', group: 'A' }, away: { kind: 'group_runner', group: 'B' } },
  { matchNum: 74, round: 'r32', home: { kind: 'group_winner', group: 'E' }, away: { kind: 'third_slot', matchNum: 74 } },
  { matchNum: 75, round: 'r32', home: { kind: 'group_winner', group: 'F' }, away: { kind: 'group_runner', group: 'C' } },
  { matchNum: 76, round: 'r32', home: { kind: 'group_winner', group: 'C' }, away: { kind: 'group_runner', group: 'F' } },
  { matchNum: 77, round: 'r32', home: { kind: 'group_winner', group: 'I' }, away: { kind: 'third_slot', matchNum: 77 } },
  { matchNum: 78, round: 'r32', home: { kind: 'group_runner', group: 'E' }, away: { kind: 'group_runner', group: 'I' } },
  { matchNum: 79, round: 'r32', home: { kind: 'group_winner', group: 'A' }, away: { kind: 'third_slot', matchNum: 79 } },
  { matchNum: 80, round: 'r32', home: { kind: 'group_winner', group: 'L' }, away: { kind: 'third_slot', matchNum: 80 } },
  { matchNum: 81, round: 'r32', home: { kind: 'group_winner', group: 'D' }, away: { kind: 'third_slot', matchNum: 81 } },
  { matchNum: 82, round: 'r32', home: { kind: 'group_winner', group: 'G' }, away: { kind: 'third_slot', matchNum: 82 } },
  { matchNum: 83, round: 'r32', home: { kind: 'group_runner', group: 'K' }, away: { kind: 'group_runner', group: 'L' } },
  { matchNum: 84, round: 'r32', home: { kind: 'group_winner', group: 'H' }, away: { kind: 'group_runner', group: 'J' } },
  { matchNum: 85, round: 'r32', home: { kind: 'group_winner', group: 'B' }, away: { kind: 'third_slot', matchNum: 85 } },
  { matchNum: 86, round: 'r32', home: { kind: 'group_winner', group: 'J' }, away: { kind: 'group_runner', group: 'H' } },
  { matchNum: 87, round: 'r32', home: { kind: 'group_winner', group: 'K' }, away: { kind: 'third_slot', matchNum: 87 } },
  { matchNum: 88, round: 'r32', home: { kind: 'group_runner', group: 'D' }, away: { kind: 'group_runner', group: 'G' } },

  { matchNum: 89, round: 'r16', home: { kind: 'winner_of', matchNum: 74 }, away: { kind: 'winner_of', matchNum: 77 } },
  { matchNum: 90, round: 'r16', home: { kind: 'winner_of', matchNum: 73 }, away: { kind: 'winner_of', matchNum: 75 } },
  { matchNum: 91, round: 'r16', home: { kind: 'winner_of', matchNum: 76 }, away: { kind: 'winner_of', matchNum: 78 } },
  { matchNum: 92, round: 'r16', home: { kind: 'winner_of', matchNum: 79 }, away: { kind: 'winner_of', matchNum: 80 } },
  { matchNum: 93, round: 'r16', home: { kind: 'winner_of', matchNum: 83 }, away: { kind: 'winner_of', matchNum: 84 } },
  { matchNum: 94, round: 'r16', home: { kind: 'winner_of', matchNum: 81 }, away: { kind: 'winner_of', matchNum: 82 } },
  { matchNum: 95, round: 'r16', home: { kind: 'winner_of', matchNum: 86 }, away: { kind: 'winner_of', matchNum: 88 } },
  { matchNum: 96, round: 'r16', home: { kind: 'winner_of', matchNum: 85 }, away: { kind: 'winner_of', matchNum: 87 } },

  { matchNum: 97, round: 'qf', home: { kind: 'winner_of', matchNum: 89 }, away: { kind: 'winner_of', matchNum: 90 } },
  { matchNum: 98, round: 'qf', home: { kind: 'winner_of', matchNum: 93 }, away: { kind: 'winner_of', matchNum: 94 } },
  { matchNum: 99, round: 'qf', home: { kind: 'winner_of', matchNum: 91 }, away: { kind: 'winner_of', matchNum: 92 } },
  { matchNum: 100, round: 'qf', home: { kind: 'winner_of', matchNum: 95 }, away: { kind: 'winner_of', matchNum: 96 } },

  { matchNum: 101, round: 'sf', home: { kind: 'winner_of', matchNum: 97 }, away: { kind: 'winner_of', matchNum: 98 } },
  { matchNum: 102, round: 'sf', home: { kind: 'winner_of', matchNum: 99 }, away: { kind: 'winner_of', matchNum: 100 } },

  { matchNum: 103, round: 'third', home: { kind: 'loser_of', matchNum: 101 }, away: { kind: 'loser_of', matchNum: 102 } },
  { matchNum: 104, round: 'final', home: { kind: 'winner_of', matchNum: 101 }, away: { kind: 'winner_of', matchNum: 102 } },
] as const

export const WC26_KO_BY_NUM = new Map(WC26_KO_MATCHES.map((m) => [m.matchNum, m]))
