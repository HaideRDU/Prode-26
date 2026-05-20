import { TSDB_WC_LEAGUE_ID, TSDB_SEASON } from './constants'
import { tsdbGet, eventsOrEmpty } from './client'
import type { TsdbEventItem } from './types'
import { iso3FromTsdb } from './teamCodes'

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms))
}

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

/**
 * idTeam por ISO-3 sin recorrer eventsday (1 llamada + mapa estático).
 * Suficiente para plantillas; evita rate limit del plan Free.
 */
export async function buildWc2026TeamIdMapLight(apiKey: string): Promise<Map<string, string>> {
  const seasonResp = await tsdbGet(apiKey, 'eventsseason.php', {
    id: TSDB_WC_LEAGUE_ID,
    s: TSDB_SEASON,
  })
  const events = eventsOrEmpty(seasonResp)
  return buildIso3ToTsdbTeamIdFromEvents(events)
}

/** Todos los eventos WC 2026 en TSDB (eventsseason + eventsday). */
export async function fetchAllWc2026Events(apiKey: string): Promise<TsdbEventItem[]> {
  const all = new Map<string, TsdbEventItem>()

  const seasonResp = await tsdbGet(apiKey, 'eventsseason.php', {
    id: TSDB_WC_LEAGUE_ID,
    s: TSDB_SEASON,
  })
  for (const ev of eventsOrEmpty(seasonResp)) all.set(ev.idEvent, ev)

  const days = dateRange('2026-06-11', '2026-07-19')
  for (const day of days) {
    await sleep(350)
    const dayResp = await tsdbGet(apiKey, 'eventsday.php', {
      d: day,
      l: TSDB_WC_LEAGUE_ID,
    })
    const dayEvents = eventsOrEmpty(dayResp).filter((e) => String(e.idLeague) === String(TSDB_WC_LEAGUE_ID))
    for (const ev of dayEvents) all.set(ev.idEvent, ev)
  }

  return Array.from(all.values())
}

/** ISO-3 → idTeam extraído de partidos del Mundial (más fiable que searchteam). */
export function buildIso3ToTsdbTeamIdFromEvents(events: TsdbEventItem[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const ev of events) {
    const homeIso = iso3FromTsdb(ev.idHomeTeam, ev.strHomeTeam)
    const awayIso = iso3FromTsdb(ev.idAwayTeam, ev.strAwayTeam)
    if (homeIso && ev.idHomeTeam) map.set(homeIso, ev.idHomeTeam)
    if (awayIso && ev.idAwayTeam) map.set(awayIso, ev.idAwayTeam)
  }
  return map
}
