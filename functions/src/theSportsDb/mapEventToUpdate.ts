import * as admin from 'firebase-admin'
import type { MatchDoc, MatchStatus } from '../lib/types/predictions'
import type { TsdbEventItem } from './types'
import { mapTsdbStatus } from './mapStatus'

export interface MatchFirestoreUpdate {
  goalsHome: number | null
  goalsAway: number | null
  status: MatchStatus
  wentToPenalties: boolean | null
  penaltiesWinnerHome: boolean | null
  finishedAt?: admin.firestore.FieldValue
  theSportsDbEventId: string
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

  const update: MatchFirestoreUpdate = {
    theSportsDbEventId: item.idEvent,
    goalsHome: homeGoals,
    goalsAway: awayGoals,
    status,
    wentToPenalties,
    penaltiesWinnerHome,
  }

  if (status === 'finished') {
    update.finishedAt = admin.firestore.FieldValue.serverTimestamp()
  }

  return update
}

export function matchUpdateChanged(current: MatchDoc, next: MatchFirestoreUpdate): boolean {
  if ((current.theSportsDbEventId ?? null) !== next.theSportsDbEventId) return true
  if (current.goalsHome !== next.goalsHome) return true
  if (current.goalsAway !== next.goalsAway) return true
  if (current.status !== next.status) return true
  if ((current.wentToPenalties ?? null) !== next.wentToPenalties) return true
  if ((current.penaltiesWinnerHome ?? null) !== next.penaltiesWinnerHome) return true
  return false
}
