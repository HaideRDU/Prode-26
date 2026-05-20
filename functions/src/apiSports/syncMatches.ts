import type { Firestore } from 'firebase-admin/firestore'
import * as logger from 'firebase-functions/logger'
import type { MatchDoc } from '../lib/types/predictions'
import { FIXTURE_IDS_BATCH_SIZE } from './constants'
import { apiSportsGet } from './client'
import { linkApiSportsFixtures } from './linkFixtures'
import { isMatchInPollingWindow, shouldRunScheduledSync } from './matchWindow'
import { mapFixtureToMatchUpdate, matchUpdateChanged } from './mapFixtureToUpdate'
import type { ApiSportsFixtureItem } from './types'

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function fetchFixturesByIds(apiKey: string, ids: number[]): Promise<ApiSportsFixtureItem[]> {
  if (ids.length === 0) return []
  const joined = ids.join('-')
  const json = await apiSportsGet<ApiSportsFixtureItem>(apiKey, '/fixtures', { ids: joined })
  return json.response ?? []
}

export interface SyncLiveMatchesResult {
  ran: boolean
  inWindow: number
  updated: number
  linked?: number
}

export async function syncLiveMatches(db: Firestore, apiKey: string): Promise<SyncLiveMatchesResult> {
  const nowMs = Date.now()
  if (!shouldRunScheduledSync(nowMs)) {
    return { ran: false, inWindow: 0, updated: 0 }
  }

  const snap = await db.collection('matches').get()
  const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() as MatchDoc }))

  const inWindow = docs.filter((d) => isMatchInPollingWindow(d.data, nowMs))
  if (inWindow.length === 0) {
    return { ran: true, inWindow: 0, updated: 0 }
  }

  const missingFixtureId = inWindow.some((d) => d.data.apiSportsFixtureId == null)
  let linked: number | undefined
  if (missingFixtureId) {
    const linkResult = await linkApiSportsFixtures(db, apiKey)
    linked = linkResult.linked
    const refreshed = await db.collection('matches').get()
    for (const d of inWindow) {
      const fresh = refreshed.docs.find((x) => x.id === d.id)
      if (fresh) d.data = fresh.data() as MatchDoc
    }
  }

  const fixtureIds = [
    ...new Set(
      inWindow
        .map((d) => d.data.apiSportsFixtureId)
        .filter((id): id is number => typeof id === 'number' && id > 0),
    ),
  ]

  if (fixtureIds.length === 0) {
    logger.warn('syncLiveMatches: partidos en ventana sin apiSportsFixtureId tras enlace')
    return { ran: true, inWindow: inWindow.length, updated: 0, linked }
  }

  const fixtures: ApiSportsFixtureItem[] = []
  for (const batch of chunk(fixtureIds, FIXTURE_IDS_BATCH_SIZE)) {
    const rows = await fetchFixturesByIds(apiKey, batch)
    fixtures.push(...rows)
  }

  const byFixtureId = new Map<number, ApiSportsFixtureItem>()
  for (const f of fixtures) byFixtureId.set(f.fixture.id, f)

  let updated = 0
  const writer = db.bulkWriter()

  for (const { id: matchId, data: current } of inWindow) {
    const fixtureId = current.apiSportsFixtureId
    if (fixtureId == null) continue
    const item = byFixtureId.get(fixtureId)
    if (!item) continue

    const next = mapFixtureToMatchUpdate(item)
    if (!matchUpdateChanged(current, next)) continue

    writer.set(db.collection('matches').doc(matchId), next, { merge: true })
    updated += 1
  }

  await writer.close()
  logger.info(`syncLiveMatches: inWindow=${inWindow.length} updated=${updated}`)
  return { ran: true, inWindow: inWindow.length, updated, linked }
}
