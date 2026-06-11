import * as admin from 'firebase-admin'
import { Timestamp } from 'firebase-admin/firestore'
import { penaltiesWinnerFlagsForTeamA } from '../lib/matchPenalties'
import type { MatchDoc, MatchScorerEntry, MatchStatus } from '../lib/types/predictions'
import type { TsdbEventItem } from './types'
import { scorersChanged } from './fetchScorers'
import { mapTsdbStatus } from './mapStatus'

export interface MatchFirestoreUpdate {
  goalsTeamA: number | null
  goalsTeamB: number | null
  status: MatchStatus
  wentToPenalties: boolean | null
  penaltiesWinnerTeamA: boolean | null
  penaltiesWinnerTeamB: boolean | null
  finishedAt?: admin.firestore.FieldValue
  theSportsDbEventId: string
  scheduledAt?: Timestamp
  scorers?: MatchScorerEntry[]
  goalsHome?: admin.firestore.FieldValue
  goalsAway?: admin.firestore.FieldValue
  penaltiesWinnerHome?: admin.firestore.FieldValue
  penaltiesWinnerAway?: admin.firestore.FieldValue
}

function parseScore(val: string | null | undefined): number | null {
  if (val == null || val === '') return null
  const n = parseInt(val, 10)
  return Number.isFinite(n) ? n : null
}

/**
 * Intenta detectar penales a partir del campo strResult de texto libre.
 * Ejemplos: "1-1 (4-3 pens)", "0-0 aet (5-4 pen)", "aet"
 */
function parsePenalties(
  item: TsdbEventItem,
  status: MatchStatus,
  homeGoals: number | null,
  awayGoals: number | null,
): { wentToPenalties: boolean | null; penaltiesWinnerHome: boolean | null } {
  if (status !== 'finished') {
    return { wentToPenalties: null, penaltiesWinnerHome: null }
  }

  const result = (item.strResult ?? '').toLowerCase()
  const hasPen = result.includes('pen') || result.includes('pso')

  if (!hasPen) {
    return { wentToPenalties: null, penaltiesWinnerHome: null }
  }

  // Intentar parsear el marcador de penales desde strResult: "(X-Y pens)" o "(X-Y pen)"
  const penMatch = result.match(/\((\d+)-(\d+)\s*pen/)
  if (penMatch) {
    const homeP = parseInt(penMatch[1], 10)
    const awayP = parseInt(penMatch[2], 10)
    if (Number.isFinite(homeP) && Number.isFinite(awayP) && homeP !== awayP) {
      return {
        wentToPenalties: true,
        penaltiesWinnerHome: homeP > awayP,
      }
    }
  }

  // Sin parseo exitoso: reportamos que hubo penales pero ganador desconocido
  // Fallback: si los goles regulares están empatados, sabemos que hubo penales
  if (homeGoals != null && awayGoals != null && homeGoals === awayGoals) {
    return { wentToPenalties: true, penaltiesWinnerHome: null }
  }

  return { wentToPenalties: true, penaltiesWinnerHome: null }
}

export function mapEventToMatchUpdate(item: TsdbEventItem): MatchFirestoreUpdate {
  const status = mapTsdbStatus(item.strStatus)
  const homeGoals = parseScore(item.intHomeScore)
  const awayGoals = parseScore(item.intAwayScore)
  const { wentToPenalties, penaltiesWinnerHome } = parsePenalties(item, status, homeGoals, awayGoals)

  const penFlags =
    penaltiesWinnerHome === null
      ? { penaltiesWinnerTeamA: null as boolean | null, penaltiesWinnerTeamB: null as boolean | null }
      : penaltiesWinnerFlagsForTeamA(penaltiesWinnerHome)

  const update: MatchFirestoreUpdate = {
    theSportsDbEventId: item.idEvent,
    goalsTeamA: homeGoals,
    goalsTeamB: awayGoals,
    status,
    wentToPenalties,
    ...penFlags,
    goalsHome: admin.firestore.FieldValue.delete(),
    goalsAway: admin.firestore.FieldValue.delete(),
    penaltiesWinnerHome: admin.firestore.FieldValue.delete(),
    penaltiesWinnerAway: admin.firestore.FieldValue.delete(),
  }

  if (item.strTimestamp) {
    const normalized = item.strTimestamp.endsWith('Z') ? item.strTimestamp : `${item.strTimestamp}Z`
    const ms = Date.parse(normalized)
    if (Number.isFinite(ms)) update.scheduledAt = Timestamp.fromMillis(ms)
  }

  if (status === 'finished') {
    update.finishedAt = admin.firestore.FieldValue.serverTimestamp()
  }

  return update
}

export function matchUpdateChanged(current: MatchDoc, next: MatchFirestoreUpdate): boolean {
  if ((current.theSportsDbEventId ?? null) !== next.theSportsDbEventId) return true
  if ((current.goalsTeamA ?? current.goalsHome ?? null) !== next.goalsTeamA) return true
  if ((current.goalsTeamB ?? current.goalsAway ?? null) !== next.goalsTeamB) return true
  if (current.status !== next.status) return true
  if ((current.wentToPenalties ?? null) !== next.wentToPenalties) return true
  if ((current.penaltiesWinnerTeamA ?? current.penaltiesWinnerHome ?? null) !== next.penaltiesWinnerTeamA) return true
  if ((current.penaltiesWinnerTeamB ?? current.penaltiesWinnerAway ?? null) !== next.penaltiesWinnerTeamB) return true
  // Detectar corrección de horario
  if (next.scheduledAt) {
    const curMs = typeof current.scheduledAt === 'object' && current.scheduledAt !== null && 'toDate' in current.scheduledAt
      ? (current.scheduledAt as { toDate(): Date }).toDate().getTime()
      : typeof current.scheduledAt === 'string'
        ? Date.parse(current.scheduledAt)
        : null
    if (curMs !== null && Math.abs(curMs - next.scheduledAt.toMillis()) > 60_000) return true
  }
  if (scorersChanged(current.scorers, next.scorers ?? [])) return true
  return false
}
