import { FieldValue } from 'firebase-admin/firestore'
import { GROUP_STAGE_SCHEDULE } from '../../src/data/wc2026/groupStageSchedule.ts'
import { WC26_KO_MATCHES, koMatchDocId } from '../../src/data/wc2026/knockoutBracket.ts'
import type { MatchDoc } from '../../src/types/predictions.ts'

const scheduleById = new Map(GROUP_STAGE_SCHEDULE.map((r) => [r.matchId, r]))

/** Borra marcadores, penales y estado de cierre; vuelve a `scheduled`. */
export const CLEAR_RESULT_FIELDS: Record<string, unknown> = {
  status: 'scheduled',
  goalsTeamA: null,
  goalsTeamB: null,
  wentToPenalties: FieldValue.delete(),
  penaltiesWinnerTeamA: FieldValue.delete(),
  penaltiesWinnerTeamB: FieldValue.delete(),
  finishedAt: FieldValue.delete(),
  scorers: FieldValue.delete(),
  goalsHome: FieldValue.delete(),
  goalsAway: FieldValue.delete(),
  penaltiesWinnerHome: FieldValue.delete(),
  penaltiesWinnerAway: FieldValue.delete(),
  teamHomeId: FieldValue.delete(),
  teamAwayId: FieldValue.delete(),
}

export type ClearPhase = 'all' | 'group' | 'knockout'

export function matchIdsForPhase(phase: ClearPhase): Set<string> | null {
  if (phase === 'all') return null
  if (phase === 'group') return new Set(GROUP_STAGE_SCHEDULE.map((r) => r.matchId))
  return new Set(WC26_KO_MATCHES.map((m) => koMatchDocId(m.matchNum)))
}

export function clearPatchForMatch(
  matchId: string,
  data: MatchDoc,
): Record<string, unknown> | null {
  const isGroup = data.phase === 'group' || scheduleById.has(matchId)
  const isKo = data.phase === 'knockout' || matchId.startsWith('wc26-ko-')

  const patch: Record<string, unknown> = { ...CLEAR_RESULT_FIELDS }

  if (isGroup) {
    const row = scheduleById.get(matchId)
    if (row) {
      patch.teamAId = row.teamHomeId
      patch.teamBId = row.teamAwayId
      patch.phase = 'group'
      patch.groupId = row.groupId
    } else if (data.teamAId && data.teamBId) {
      patch.teamAId = data.teamAId
      patch.teamBId = data.teamBId
    }
    return patch
  }

  if (isKo) {
    const koDef = WC26_KO_MATCHES.find((m) => koMatchDocId(m.matchNum) === matchId)
    patch.phase = 'knockout'
    if (koDef) patch.round = koDef.round
    patch.teamAId = null
    patch.teamBId = null
    return patch
  }

  return patch
}

export function wasFinished(data: MatchDoc): boolean {
  return data.status === 'finished' || data.status === 'live'
}
