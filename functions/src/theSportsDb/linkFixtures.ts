import type { Firestore } from 'firebase-admin/firestore'
import { Timestamp } from 'firebase-admin/firestore'
import * as logger from 'firebase-functions/logger'
import type { MatchDoc } from '../lib/types/predictions'
import { TSDB_FREE_KEY, TSDB_WC_LEAGUE_ID, TSDB_SEASON, KICKOFF_TOLERANCE_MS } from './constants'
import { tsdbGet, eventsOrEmpty } from './client'
import type { TsdbEventItem } from './types'
import { iso3FromTsdb } from './teamCodes'
import { kickoffMs } from '../apiSports/matchWindow'

/**
 * Convierte el strTimestamp de TSDB (UTC sin 'Z') a milisegundos epoch.
 * "2026-06-11T19:00:00" → timestamp ms
 */
function tsdbTimestampToMs(strTimestamp: string): number | null {
  if (!strTimestamp) return null
  const normalized = strTimestamp.endsWith('Z') ? strTimestamp : `${strTimestamp}Z`
  const ms = Date.parse(normalized)
  return Number.isFinite(ms) ? ms : null
}

function findFirestoreMatchId(
  matches: { id: string; data: MatchDoc }[],
  homeIso: string,
  awayIso: string,
  fixtureKickoffMs: number,
): string | null {
  let best: { id: string; delta: number } | null = null
  for (const m of matches) {
    const d = m.data
    if (d.teamHomeId !== homeIso || d.teamAwayId !== awayIso) continue
    const scheduled = kickoffMs(d.scheduledAt)
    if (scheduled == null) continue
    const delta = Math.abs(scheduled - fixtureKickoffMs)
    if (delta > KICKOFF_TOLERANCE_MS) continue
    if (!best || delta < best.delta) best = { id: m.id, delta }
  }
  return best?.id ?? null
}

function sleep(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms))
}

/** Genera todas las fechas en [start, end] en formato YYYY-MM-DD */
function dateRange(startIso: string, endIso: string): string[] {
  const dates: string[] = []
  const cur = new Date(startIso)
  const end = new Date(endIso)
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return dates
}

async function fetchAllTsdbEvents(apiKey: string): Promise<TsdbEventItem[]> {
  const all = new Map<string, TsdbEventItem>()

  // 1) Temporada completa (15 eventos en Free)
  const seasonResp = await tsdbGet(apiKey, 'eventsseason.php', {
    id: TSDB_WC_LEAGUE_ID,
    s: TSDB_SEASON,
  })
  for (const ev of eventsOrEmpty(seasonResp)) all.set(ev.idEvent, ev)
  logger.info(`[tsdb:link] eventsseason: ${all.size} eventos`)

  // 2) Por día: June 11 → July 19, 100 ms de delay entre llamadas
  const days = dateRange('2026-06-11', '2026-07-19')
  for (const day of days) {
    await sleep(100)
    const dayResp = await tsdbGet(apiKey, 'eventsday.php', {
      d: day,
      l: TSDB_WC_LEAGUE_ID,
    })
    const dayEvents = eventsOrEmpty(dayResp).filter((e) => String(e.idLeague) === String(TSDB_WC_LEAGUE_ID))
    for (const ev of dayEvents) all.set(ev.idEvent, ev)
  }

  logger.info(`[tsdb:link] total eventos únicos: ${all.size}`)
  return Array.from(all.values())
}

export async function linkTsdbFixtures(
  db: Firestore,
  apiKey = TSDB_FREE_KEY,
): Promise<{ linked: number; skipped: number; updated: number }> {
  const events = await fetchAllTsdbEvents(apiKey)

  const snap = await db.collection('matches').get()
  const firestoreMatches = snap.docs.map((d) => ({ id: d.id, data: d.data() as MatchDoc }))

  let linked = 0
  let skipped = 0
  let updated = 0
  const writer = db.bulkWriter()

  for (const item of events) {
    const homeIso = iso3FromTsdb(item.idHomeTeam, item.strHomeTeam)
    const awayIso = iso3FromTsdb(item.idAwayTeam, item.strAwayTeam)

    if (!homeIso || !awayIso) {
      logger.warn(`[tsdb:link] sin ISO-3: ${item.strHomeTeam} (${item.idHomeTeam}) vs ${item.strAwayTeam} (${item.idAwayTeam})`)
      skipped += 1
      continue
    }

    const eventKickoffMs = tsdbTimestampToMs(item.strTimestamp)
    if (!eventKickoffMs) {
      skipped += 1
      continue
    }

    const matchId = findFirestoreMatchId(firestoreMatches, homeIso, awayIso, eventKickoffMs)
    if (!matchId) {
      logger.warn(`[tsdb:link] sin match Firestore: ${homeIso} vs ${awayIso} @ ${item.strTimestamp}`)
      skipped += 1
      continue
    }

    const ref = db.collection('matches').doc(matchId)
    writer.set(
      ref,
      {
        theSportsDbEventId: item.idEvent,
        // Corregir scheduledAt con el tiempo exacto de TSDB
        scheduledAt: Timestamp.fromDate(new Date(`${item.strTimestamp}Z`)),
      },
      { merge: true },
    )
    linked += 1

    // Actualizar el objeto en memoria para que el corrected scheduledAt no afecte búsquedas futuras
    const entry = firestoreMatches.find((m) => m.id === matchId)
    if (entry) {
      updated += 1
    }
  }

  await writer.close()
  logger.info(`[tsdb:link] linked=${linked} skipped=${skipped} total_events=${events.length}`)
  return { linked, skipped, updated }
}

/** Ping de conectividad: pide el próximo partido del Mundial 2026 */
export async function pingTsdb(apiKey = TSDB_FREE_KEY): Promise<boolean> {
  const resp = await tsdbGet(apiKey, 'eventsnextleague.php', { id: TSDB_WC_LEAGUE_ID })
  return Array.isArray(resp.events)
}
