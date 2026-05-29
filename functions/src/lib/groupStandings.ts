/**
 * Tablas de fase de grupos a partir de marcadores predichos (o reales).
 * Desempates: puntos, diferencia global, goles a favor; si dos empatan en todo,
 * mini-liga directa entre ambos; si persisten, orden por teamId.
 */
import { GROUP_STAGE_SCHEDULE } from '../data/wc2026/groupStageSchedule'
import { WC2026_TEAMS_BY_GROUP } from '../data/wc2026/teamsByGroup'
import type { MatchPredictionPayload } from './types/predictions'

export interface StandingRow {
  teamId: string
  played: number
  points: number
  gf: number
  ga: number
  gd: number
}

const GROUP_ORDER = 'ABCDEFGHIJKL'.split('')

function goalsFromPred(pred: MatchPredictionPayload | undefined): { h: number; a: number } {
  if (!pred) return { h: 0, a: 0 }
  return {
    h: pred.goalsTeamA ?? pred.goalsHome ?? 0,
    a: pred.goalsTeamB ?? pred.goalsAway ?? 0,
  }
}

function headToHeadTwo(
  a: string,
  b: string,
  matchRows: { home: string; away: string; gh: number; ga: number }[],
): number {
  for (const row of matchRows) {
    if (row.home === a && row.away === b) {
      if (row.gh > row.ga) return 1
      if (row.gh < row.ga) return -1
      return 0
    }
    if (row.home === b && row.away === a) {
      if (row.ga > row.gh) return 1
      if (row.ga < row.gh) return -1
      return 0
    }
  }
  return 0
}

/** Tabla de un grupo (4 equipos) ordenada 1º→4º según predicciones de los 6 partidos del grupo */
export function computeGroupStandings(
  groupId: string,
  predByMatchId: Map<string, MatchPredictionPayload>,
): StandingRow[] {
  const teams = WC2026_TEAMS_BY_GROUP.filter((t) => t.groupId === groupId).map((t) => t.teamId)
  if (teams.length !== 4) return []

  const rows = new Map<string, StandingRow>()
  for (const t of teams) {
    rows.set(t, { teamId: t, played: 0, points: 0, gf: 0, ga: 0, gd: 0 })
  }

  const matchRows: { home: string; away: string; gh: number; ga: number }[] = []

  for (const row of GROUP_STAGE_SCHEDULE) {
    if (row.groupId !== groupId) continue
    const pr = goalsFromPred(predByMatchId.get(row.matchId))
    const gh = pr.h
    const ga = pr.a
    matchRows.push({ home: row.teamHomeId, away: row.teamAwayId, gh, ga })

    const home = rows.get(row.teamHomeId)!
    const away = rows.get(row.teamAwayId)!
    home.played++
    away.played++
    home.gf += gh
    home.ga += ga
    away.gf += ga
    away.ga += gh
    if (gh > ga) home.points += 3
    else if (gh < ga) away.points += 3
    else {
      home.points += 1
      away.points += 1
    }
  }

  for (const r of rows.values()) r.gd = r.gf - r.ga

  const list = [...rows.values()]
  return list.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.gd !== a.gd) return b.gd - a.gd
    if (b.gf !== a.gf) return b.gf - a.gf
    const h2h = headToHeadTwo(a.teamId, b.teamId, matchRows)
    if (h2h !== 0) return -h2h
    return a.teamId.localeCompare(b.teamId)
  })
}

export function orderedGroupIds(): string[] {
  return GROUP_ORDER.filter((g) => WC2026_TEAMS_BY_GROUP.some((t) => t.groupId === g))
}

/** Terceros de todos los grupos con su fila de clasificación (posición 3 en cada grupo) */
export function collectThirdPlaced(
  predByMatchId: Map<string, MatchPredictionPayload>,
): { teamId: string; groupId: string; row: StandingRow }[] {
  const out: { teamId: string; groupId: string; row: StandingRow }[] = []
  for (const g of orderedGroupIds()) {
    const table = computeGroupStandings(g, predByMatchId)
    if (table.length >= 3) {
      const row = table[2]!
      out.push({ teamId: row.teamId, groupId: g, row })
    }
  }
  return out
}

/** Los 8 mejores terceros (FIFA: puntos, DG, GF entre los 12 terceros) */
export function rankThirdPlaced(
  thirds: { teamId: string; groupId: string; row: StandingRow }[],
): { teamId: string; groupId: string; row: StandingRow; rank: number }[] {
  const sorted = [...thirds].sort((a, b) => {
    if (b.row.points !== a.row.points) return b.row.points - a.row.points
    if (b.row.gd !== a.row.gd) return b.row.gd - a.row.gd
    if (b.row.gf !== a.row.gf) return b.row.gf - a.row.gf
    return a.teamId.localeCompare(b.teamId)
  })
  return sorted.map((t, i) => ({ ...t, rank: i + 1 }))
}

export function topEightThirds(
  predByMatchId: Map<string, MatchPredictionPayload>,
): { teamId: string; groupId: string; row: StandingRow; rank: number }[] {
  const ranked = rankThirdPlaced(collectThirdPlaced(predByMatchId))
  return ranked.slice(0, 8)
}
