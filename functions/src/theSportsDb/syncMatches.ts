import type { Firestore } from 'firebase-admin/firestore'
import * as logger from 'firebase-functions/logger'
import type { MatchDoc } from '../lib/types/predictions'
import { TSDB_FREE_KEY } from './constants'
import { tsdbGet, eventsOrEmpty } from './client'
import { linkTsdbFixtures } from './linkFixtures'
import { isMatchInPollingWindow, shouldRunScheduledSync } from '../apiSports/matchWindow'
import { mapEventToMatchUpdate, matchUpdateChanged } from './mapEventToUpdate'

export interface SyncTsdbResult {
  ran: boolean
  inWindow: number
  updated: number
  linked?: number
}

export async function syncMatchesFromTsdb(
  db: Firestore,
  apiKey = TSDB_FREE_KEY,
): Promise<SyncTsdbResult> {
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

  // Si algún match en ventana no tiene theSportsDbEventId, relinkear
  const missingId = inWindow.some((d) => !d.data.theSportsDbEventId)
  let linked: number | undefined
  if (missingId) {
    const linkResult = await linkTsdbFixtures(db, apiKey)
    linked = linkResult.linked
    const refreshed = await db.collection('matches').get()
    for (const d of inWindow) {
      const fresh = refreshed.docs.find((x) => x.id === d.id)
      if (fresh) d.data = fresh.data() as MatchDoc
    }
  }

  let updated = 0
  const writer = db.bulkWriter()

  for (const { id: matchId, data: current } of inWindow) {
    const tsdbId = current.theSportsDbEventId
    if (!tsdbId) continue

    // 1 llamada por partido en ventana (máx ~8 = muy bajo de 30/min)
    const resp = await tsdbGet(apiKey, 'lookupevent.php', { id: tsdbId })
    const events = eventsOrEmpty(resp)
    if (events.length === 0) continue

    const item = events[0]
    const next = mapEventToMatchUpdate(item)

    if (!matchUpdateChanged(current, next)) continue

    writer.set(db.collection('matches').doc(matchId), next, { merge: true })
    updated += 1
  }

  await writer.close()
  logger.info(`[tsdb:sync] inWindow=${inWindow.length} updated=${updated}`)
  return { ran: true, inWindow: inWindow.length, updated, linked }
}
