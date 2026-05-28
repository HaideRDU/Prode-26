import { DEFAULT_RULESET, type KnockoutRoundId } from './ruleset'
import { WC26_KO_MATCHES, koMatchDocId } from '../data/wc2026/knockoutBracket'
import { propagateKoWinners, resolveKoMatchTeams } from './bracketResolve'
import type { MatchPredictionPayload, MatchDoc } from './types/predictions'
import { computeGroupStandings, orderedGroupIds, topEightThirds } from './groupStandings'
import { assignThirdsToR32Slots } from './assignThirdsGreedy'

export type AdvancementRoundKey = 'toR32' | 'toR16' | 'toQf' | 'toSf' | 'toFinal'

const KO_ROUND_TO_ADVANCEMENT: Partial<Record<KnockoutRoundId, AdvancementRoundKey>> = {
  r32: 'toR32',
  r16: 'toR16',
  qf: 'toQf',
  sf: 'toSf',
  final: 'toFinal',
}

const ADVANCEMENT_ORDER: AdvancementRoundKey[] = ['toR32', 'toR16', 'toQf', 'toSf', 'toFinal']

function teamIdsFromMatch(m: Pick<MatchDoc, 'teamAId' | 'teamBId' | 'teamHomeId' | 'teamAwayId'>): string[] {
  const a = m.teamAId ?? m.teamHomeId
  const b = m.teamBId ?? m.teamAwayId
  return [a, b].filter((id): id is string => typeof id === 'string' && id.length > 0)
}

export function officialTeamsByAdvancementRound(
  matchesById: Map<string, MatchDoc & { id?: string }>,
): Map<AdvancementRoundKey, Set<string>> {
  const out = new Map<AdvancementRoundKey, Set<string>>()
  for (const key of ADVANCEMENT_ORDER) out.set(key, new Set())

  for (const m of WC26_KO_MATCHES) {
    const adv = KO_ROUND_TO_ADVANCEMENT[m.round]
    if (!adv) continue
    const doc = matchesById.get(koMatchDocId(m.matchNum))
    if (!doc) continue
    for (const tid of teamIdsFromMatch(doc)) {
      out.get(adv)!.add(tid)
    }
  }
  return out
}

export function predictedTeamsByAdvancementRound(
  groupPredByMatchId: Map<string, MatchPredictionPayload>,
  koPredByMatchId: Map<string, MatchPredictionPayload>,
): Map<AdvancementRoundKey, Set<string>> {
  const out = new Map<AdvancementRoundKey, Set<string>>()
  for (const key of ADVANCEMENT_ORDER) out.set(key, new Set())

  const tablesByGroup = new Map<string, ReturnType<typeof computeGroupStandings>>()
  for (const g of orderedGroupIds()) {
    tablesByGroup.set(g, computeGroupStandings(g, groupPredByMatchId))
  }
  const thirds = topEightThirds(groupPredByMatchId)
  const thirdByMatchNum = assignThirdsToR32Slots(thirds)
  const winnerByMatchNum = propagateKoWinners(koPredByMatchId, tablesByGroup, thirdByMatchNum)

  for (const m of WC26_KO_MATCHES) {
    const adv = KO_ROUND_TO_ADVANCEMENT[m.round]
    if (!adv) continue
    const { homeId, awayId } = resolveKoMatchTeams(
      m.matchNum,
      tablesByGroup,
      thirdByMatchNum,
      winnerByMatchNum,
    )
    if (homeId) out.get(adv)!.add(homeId)
    if (awayId) out.get(adv)!.add(awayId)
  }
  return out
}

export function scoreBracketAdvancement(
  predicted: Map<AdvancementRoundKey, Set<string>>,
  official: Map<AdvancementRoundKey, Set<string>>,
): number {
  let total = 0
  for (const key of ADVANCEMENT_ORDER) {
    const pts = DEFAULT_RULESET.points.advancement[key]
    const pred = predicted.get(key) ?? new Set()
    const off = official.get(key) ?? new Set()
    for (const tid of pred) {
      if (off.has(tid)) total += pts
    }
  }
  return total
}

export function extractGroupAndKoPredMaps(
  predictions: { scope: string; matchId?: string; payload: unknown }[],
): {
  groupPredByMatchId: Map<string, MatchPredictionPayload>
  koPredByMatchId: Map<string, MatchPredictionPayload>
} {
  const groupPredByMatchId = new Map<string, MatchPredictionPayload>()
  const koPredByMatchId = new Map<string, MatchPredictionPayload>()
  for (const pr of predictions) {
    if (pr.scope !== 'match' || !pr.matchId) continue
    const p = pr.payload as MatchPredictionPayload
    if (!p || typeof p.goalsHome !== 'number') continue
    if (pr.matchId.startsWith('wc26-ko-')) {
      koPredByMatchId.set(pr.matchId, p)
    } else if (pr.matchId.startsWith('wc26-')) {
      groupPredByMatchId.set(pr.matchId, p)
    }
  }
  return { groupPredByMatchId, koPredByMatchId }
}
