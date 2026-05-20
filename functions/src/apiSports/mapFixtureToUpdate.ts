import * as admin from 'firebase-admin'
import type { MatchDoc, MatchStatus } from '../lib/types/predictions'
import type { ApiSportsFixtureItem } from './types'
import { mapApiStatusShort } from './mapStatus'

export interface MatchFirestoreUpdate {
  goalsHome: number | null
  goalsAway: number | null
  status: MatchStatus
  wentToPenalties: boolean | null
  penaltiesWinnerHome: boolean | null
  finishedAt?: admin.firestore.FieldValue
  apiSportsFixtureId: number
}

function pickGoals(item: ApiSportsFixtureItem, status: MatchStatus): { home: number | null; away: number | null } {
  const g = item.goals
  const ft = item.score?.fulltime
  if (status === 'finished' && ft?.home != null && ft?.away != null) {
    return { home: ft.home, away: ft.away }
  }
  if (g.home != null && g.away != null) return { home: g.home, away: g.away }
  return { home: null, away: null }
}

function pickPenalties(item: ApiSportsFixtureItem): {
  wentToPenalties: boolean | null
  penaltiesWinnerHome: boolean | null
} {
  const pen = item.score?.penalty
  if (pen?.home == null || pen?.away == null) {
    return { wentToPenalties: null, penaltiesWinnerHome: null }
  }
  if (pen.home === 0 && pen.away === 0) {
    return { wentToPenalties: null, penaltiesWinnerHome: null }
  }
  const wentToPenalties = true
  let penaltiesWinnerHome: boolean | null = null
  if (pen.home > pen.away) penaltiesWinnerHome = true
  else if (pen.away > pen.home) penaltiesWinnerHome = false
  return { wentToPenalties, penaltiesWinnerHome }
}

export function mapFixtureToMatchUpdate(item: ApiSportsFixtureItem): MatchFirestoreUpdate {
  const short = item.fixture.status.short
  const status = mapApiStatusShort(short)
  const goals = pickGoals(item, status)
  const pen = pickPenalties(item)

  const update: MatchFirestoreUpdate = {
    apiSportsFixtureId: item.fixture.id,
    goalsHome: goals.home,
    goalsAway: goals.away,
    status,
    wentToPenalties: pen.wentToPenalties,
    penaltiesWinnerHome: pen.penaltiesWinnerHome,
  }
  if (status === 'finished') {
    update.finishedAt = admin.firestore.FieldValue.serverTimestamp()
  }
  return update
}

export function matchUpdateChanged(current: MatchDoc, next: MatchFirestoreUpdate): boolean {
  if (current.apiSportsFixtureId !== next.apiSportsFixtureId) return true
  if (current.goalsHome !== next.goalsHome) return true
  if (current.goalsAway !== next.goalsAway) return true
  if (current.status !== next.status) return true
  if ((current.wentToPenalties ?? null) !== next.wentToPenalties) return true
  if ((current.penaltiesWinnerHome ?? null) !== next.penaltiesWinnerHome) return true
  return false
}
