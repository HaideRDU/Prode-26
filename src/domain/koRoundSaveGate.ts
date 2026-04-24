import type { MatchPredictionPayload } from '../types/predictions'
import { WC26_KO_BY_NUM, WC26_KO_MATCHES, koMatchDocId } from '../data/wc2026/knockoutBracket'
import { computeGroupStandings, orderedGroupIds, topEightThirds } from './groupStandings'
import { assignThirdsToR32Slots } from './assignThirdsGreedy'
import { propagateKoWinners, resolveKoMatchTeams } from './bracketResolve'
import { isCompleteMatchPredictionForPicker } from './matchPredictionComplete'

export type KoBracketPredictionsContext = {
  tablesByGroup: Map<string, ReturnType<typeof computeGroupStandings>>
  thirdByMatchNum: Map<number, string>
  winnerByMatchNum: Map<number, string>
}

/** Misma construcción que en KnockoutSection (clasificados + ganadores propagados). */
export function buildKoPredictionsContext(
  groupPredByMatchId: Map<string, MatchPredictionPayload>,
  koPredByMatchId: Map<string, MatchPredictionPayload>,
): KoBracketPredictionsContext {
  const tablesByGroup = new Map<string, ReturnType<typeof computeGroupStandings>>()
  for (const g of orderedGroupIds()) {
    tablesByGroup.set(g, computeGroupStandings(g, groupPredByMatchId))
  }
  const thirds = topEightThirds(groupPredByMatchId)
  const thirdByMatchNum = assignThirdsToR32Slots(thirds)
  const winnerByMatchNum = propagateKoWinners(koPredByMatchId, tablesByGroup, thirdByMatchNum)
  return { tablesByGroup, thirdByMatchNum, winnerByMatchNum }
}

const PREV_ROUND: Record<
  'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final',
  'r32' | 'r16' | 'qf' | 'sf' | null
> = {
  r32: null,
  r16: 'r32',
  qf: 'r16',
  sf: 'qf',
  third: 'sf',
  final: 'sf',
}

const ROUND_LABEL_PREV: Record<'r32' | 'r16' | 'qf' | 'sf', string> = {
  r32: 'dieciseisavos de final',
  r16: 'octavos de final',
  qf: 'cuartos de final',
  sf: 'semifinales',
}

const ROUND_LABEL_TARGET: Record<'r16' | 'qf' | 'sf' | 'third' | 'final', string> = {
  r16: 'octavos',
  qf: 'cuartos',
  sf: 'semifinales',
  third: 'tercer puesto',
  final: 'la final',
}

export function parseKoMatchNumFromDocId(matchId: string): number | null {
  if (!matchId.startsWith('wc26-ko-')) return null
  const n = Number(matchId.slice('wc26-ko-'.length))
  return Number.isFinite(n) ? n : null
}

function prevRoundIncompleteMessage(
  prevRound: 'r32' | 'r16' | 'qf' | 'sf',
  targetRound: 'r16' | 'qf' | 'sf' | 'third' | 'final',
): string {
  return `Completá y guardá todos los partidos de ${ROUND_LABEL_PREV[prevRound]} antes de guardar ${ROUND_LABEL_TARGET[targetRound]}.`
}

/**
 * No guardar partidos de la ronda R si falta algún partido de la ronda anterior
 * con ambos equipos ya definidos y predicción KO incompleta.
 */
export function canSaveKoMatch(args: {
  matchNum: number
  ctx: KoBracketPredictionsContext
  koPredByMatchId: Map<string, MatchPredictionPayload>
}): { ok: true } | { ok: false; message: string } {
  const { matchNum, ctx, koPredByMatchId } = args
  const row = WC26_KO_BY_NUM.get(matchNum)
  if (!row) return { ok: true }

  const prev = PREV_ROUND[row.round]
  if (!prev) return { ok: true }

  const prevMatches = WC26_KO_MATCHES.filter((m) => m.round === prev)
  for (const m of prevMatches) {
    const { homeId, awayId } = resolveKoMatchTeams(
      m.matchNum,
      ctx.tablesByGroup,
      ctx.thirdByMatchNum,
      ctx.winnerByMatchNum,
    )
    if (!homeId || !awayId) continue
    const pred = koPredByMatchId.get(koMatchDocId(m.matchNum))
    if (!isCompleteMatchPredictionForPicker(pred, 'knockout')) {
      const targetRound = row.round as 'r16' | 'qf' | 'sf' | 'third' | 'final'
      return {
        ok: false,
        message: prevRoundIncompleteMessage(prev, targetRound),
      }
    }
  }
  return { ok: true }
}

export function koSaveBlockedReason(
  matchNum: number,
  ctx: KoBracketPredictionsContext,
  koPredByMatchId: Map<string, MatchPredictionPayload>,
): string | null {
  const r = canSaveKoMatch({ matchNum, ctx, koPredByMatchId })
  return r.ok ? null : r.message
}
