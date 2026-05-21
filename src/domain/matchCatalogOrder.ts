import { GROUP_STAGE_SCHEDULE } from '../data/wc2026/groupStageSchedule'
import type { MatchDoc } from '../types/predictions'
import { orderedGroupIds } from './groupStandings'

/** Orden FIFA del calendario (grupo A→L, luego -01…-06 dentro de cada grupo). */
export const scheduleOrder = new Map(GROUP_STAGE_SCHEDULE.map((r, i) => [r.matchId, i]))

/** Clave de orden para UI: catálogo del torneo, no `scheduledAt` de Firestore. */
export function tournamentCatalogSortKey(m: MatchDoc & { id: string }): number {
  if (m.phase === 'group' && m.groupId) {
    const gIdx = orderedGroupIds().indexOf(m.groupId)
    const ord = scheduleOrder.get(m.id) ?? 999
    return (gIdx >= 0 ? gIdx : 99) * 1000 + ord
  }
  if (m.id.startsWith('wc26-ko-')) {
    const n = Number(m.id.slice('wc26-ko-'.length))
    return 100_000 + (Number.isFinite(n) ? n : 999)
  }
  return 200_000
}

export function sortByTournamentCatalog<T extends MatchDoc & { id: string }>(matches: T[]): T[] {
  return [...matches].sort((a, b) => tournamentCatalogSortKey(a) - tournamentCatalogSortKey(b))
}
