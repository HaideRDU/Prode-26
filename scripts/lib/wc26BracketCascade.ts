import type { MatchPredictionPayload } from '../../src/types/predictions.ts'
import { WC26_KO_MATCHES, koMatchDocId } from '../../src/data/wc2026/knockoutBracket.ts'
import { resolveKoMatchTeams } from '../../src/domain/bracketResolve.ts'
import { buildKoPredictionsContext } from '../../src/domain/koRoundSaveGate.ts'

export type ScoreLike = Pick<MatchPredictionPayload, 'goalsHome' | 'goalsAway'>

export function groupScoresMapFromFinished(
  matches: Array<{
    id: string
    phase?: string
    status?: string
    goalsHome?: number | null
    goalsAway?: number | null
    goalsTeamA?: number | null
    goalsTeamB?: number | null
  }>,
): Map<string, ScoreLike> {
  const out = new Map<string, ScoreLike>()
  for (const m of matches) {
    if (m.phase !== 'group' || m.status !== 'finished') continue
    const gh = m.goalsTeamA ?? m.goalsHome
    const ga = m.goalsTeamB ?? m.goalsAway
    if (typeof gh !== 'number' || typeof ga !== 'number') continue
    out.set(m.id, { goalsHome: gh, goalsAway: ga })
  }
  return out
}

export type ResolvedKoSlot = {
  matchNum: number
  matchId: string
  round: string
  homeId: string
  awayId: string
}

/**
 * Recorre KO 73→104 en orden: en cada paso solo resuelve cruces cuyos equipos
 * ya están definidos por tablas de grupos + ganadores de KO anteriores (misma lógica que la UI).
 */
export function cascadeKoMatches(
  groupScores: Map<string, ScoreLike | MatchPredictionPayload>,
  onResolvable: (slot: ResolvedKoSlot) => MatchPredictionPayload | null | undefined,
  initialKoScores: Map<string, MatchPredictionPayload> = new Map(),
): { koScores: Map<string, MatchPredictionPayload>; resolvedCount: number } {
  const koScores = new Map(initialKoScores)
  const sorted = [...WC26_KO_MATCHES].sort((a, b) => a.matchNum - b.matchNum)
  let resolvedCount = 0

  for (const def of sorted) {
    const matchId = koMatchDocId(def.matchNum)
    const ctx = buildKoPredictionsContext(groupScores, koScores)
    const { homeId, awayId } = resolveKoMatchTeams(
      def.matchNum,
      ctx.tablesByGroup,
      ctx.thirdByMatchNum,
      ctx.winnerByMatchNum,
    )
    if (!homeId || !awayId) continue

    const payload = onResolvable({
      matchNum: def.matchNum,
      matchId,
      round: def.round,
      homeId,
      awayId,
    })
    if (!payload) continue
    koScores.set(matchId, payload)
    resolvedCount++
  }

  return { koScores, resolvedCount }
}
