import type { MatchPredictionPayload } from '../types/predictions'
import { WC26_KO_BY_NUM, type KoBracketSide, koMatchDocId } from '../data/wc2026/knockoutBracket'
import type { StandingRow } from './groupStandings'
import { computeGroupStandings, orderedGroupIds, topEightThirds } from './groupStandings'
import { assignThirdsToR32Slots } from './assignThirdsGreedy'

const FINAL_MATCH_NUM = 104
const THIRD_PLACE_MATCH_NUM = 103

export function koWinnerSide(
  pred: MatchPredictionPayload | undefined,
): 'home' | 'away' | null {
  if (!pred) return null
  if (pred.goalsHome > pred.goalsAway) return 'home'
  if (pred.goalsHome < pred.goalsAway) return 'away'
  if (!pred.wentToPenalties) return null
  if (pred.penaltiesWinnerHome === undefined) return null
  return pred.penaltiesWinnerHome ? 'home' : 'away'
}

function teamAtPlace(table: StandingRow[] | undefined, place1Based: number): string | null {
  if (!table || table.length < place1Based) return null
  return table[place1Based - 1]!.teamId
}

function resolveSide(
  side: KoBracketSide,
  tablesByGroup: Map<string, StandingRow[]>,
  thirdByMatchNum: Map<number, string>,
  winnerByMatchNum: Map<number, string>,
): string | null {
  if (side.kind === 'group_winner') return teamAtPlace(tablesByGroup.get(side.group), 1)
  if (side.kind === 'group_runner') return teamAtPlace(tablesByGroup.get(side.group), 2)
  if (side.kind === 'third_slot') return thirdByMatchNum.get(side.matchNum) ?? null
  if (side.kind === 'winner_of') return winnerByMatchNum.get(side.matchNum) ?? null
  if (side.kind === 'loser_of') {
    const m = WC26_KO_BY_NUM.get(side.matchNum)
    const w = winnerByMatchNum.get(side.matchNum)
    if (!m || !w) return null
    const hid = resolveSide(m.home, tablesByGroup, thirdByMatchNum, winnerByMatchNum)
    const aid = resolveSide(m.away, tablesByGroup, thirdByMatchNum, winnerByMatchNum)
    if (!hid || !aid) return null
    return w === hid ? aid : hid
  }
  return null
}

/** Propaga ganadores 73→104 en orden numérico */
export function propagateKoWinners(
  predByKoId: Map<string, MatchPredictionPayload>,
  tablesByGroup: Map<string, StandingRow[]>,
  thirdByMatchNum: Map<number, string>,
): Map<number, string> {
  const winnerByMatchNum = new Map<number, string>()
  const sortedNums = [...WC26_KO_BY_NUM.keys()].sort((a, b) => a - b)
  for (const num of sortedNums) {
    const m = WC26_KO_BY_NUM.get(num)
    if (!m) continue
    const hid = resolveSide(m.home, tablesByGroup, thirdByMatchNum, winnerByMatchNum)
    const aid = resolveSide(m.away, tablesByGroup, thirdByMatchNum, winnerByMatchNum)
    if (!hid || !aid) continue
    const pred = predByKoId.get(koMatchDocId(num))
    const side = koWinnerSide(pred)
    if (!side) continue
    winnerByMatchNum.set(num, side === 'home' ? hid : aid)
  }
  return winnerByMatchNum
}

export function resolveKoMatchTeams(
  matchNum: number,
  tablesByGroup: Map<string, StandingRow[]>,
  thirdByMatchNum: Map<number, string>,
  winnerByMatchNum: Map<number, string>,
): { homeId: string | null; awayId: string | null } {
  const m = WC26_KO_BY_NUM.get(matchNum)
  if (!m) return { homeId: null, awayId: null }
  return {
    homeId: resolveSide(m.home, tablesByGroup, thirdByMatchNum, winnerByMatchNum),
    awayId: resolveSide(m.away, tablesByGroup, thirdByMatchNum, winnerByMatchNum),
  }
}

/**
 * Campeón y subcampeón según el cuadro predicho (misma lógica que KnockoutSection).
 * Final = partido 104 (`wc26-ko-104`).
 */
export function getChampionAndRunnerUpFromPredictions(
  groupPredByMatchId: Map<string, MatchPredictionPayload>,
  koPredByMatchId: Map<string, MatchPredictionPayload>,
): { championId: string | null; runnerUpId: string | null } {
  const tablesByGroup = new Map<string, StandingRow[]>()
  for (const g of orderedGroupIds()) {
    tablesByGroup.set(g, computeGroupStandings(g, groupPredByMatchId))
  }
  const thirds = topEightThirds(groupPredByMatchId)
  const thirdByMatchNum = assignThirdsToR32Slots(thirds)
  const winnerByMatchNum = propagateKoWinners(koPredByMatchId, tablesByGroup, thirdByMatchNum)
  const { homeId, awayId } = resolveKoMatchTeams(
    FINAL_MATCH_NUM,
    tablesByGroup,
    thirdByMatchNum,
    winnerByMatchNum,
  )
  if (!homeId || !awayId) return { championId: null, runnerUpId: null }
  const pred = koPredByMatchId.get(koMatchDocId(FINAL_MATCH_NUM))
  const side = koWinnerSide(pred)
  if (!side) return { championId: null, runnerUpId: null }
  const championId = side === 'home' ? homeId : awayId
  const runnerUpId = side === 'home' ? awayId : homeId
  return { championId, runnerUpId }
}

/** 3º y 4º según el partido por el tercer puesto (103): ganador = 3º, perdedor = 4º. */
export function getThirdAndFourthFromPredictions(
  groupPredByMatchId: Map<string, MatchPredictionPayload>,
  koPredByMatchId: Map<string, MatchPredictionPayload>,
): { thirdId: string | null; fourthId: string | null } {
  const tablesByGroup = new Map<string, StandingRow[]>()
  for (const g of orderedGroupIds()) {
    tablesByGroup.set(g, computeGroupStandings(g, groupPredByMatchId))
  }
  const thirds = topEightThirds(groupPredByMatchId)
  const thirdByMatchNum = assignThirdsToR32Slots(thirds)
  const winnerByMatchNum = propagateKoWinners(koPredByMatchId, tablesByGroup, thirdByMatchNum)
  const { homeId, awayId } = resolveKoMatchTeams(
    THIRD_PLACE_MATCH_NUM,
    tablesByGroup,
    thirdByMatchNum,
    winnerByMatchNum,
  )
  if (!homeId || !awayId) return { thirdId: null, fourthId: null }
  const pred = koPredByMatchId.get(koMatchDocId(THIRD_PLACE_MATCH_NUM))
  const side = koWinnerSide(pred)
  if (!side) return { thirdId: null, fourthId: null }
  const thirdId = side === 'home' ? homeId : awayId
  const fourthId = side === 'home' ? awayId : homeId
  return { thirdId, fourthId }
}
