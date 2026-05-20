import { TSDB_BASE } from './constants'
import type {
  TsdbEventsResponse,
  TsdbEventsLastResponse,
  TsdbEventItem,
  TsdbLineupResponse,
  TsdbLineupItem,
  TsdbPlayersResponse,
  TsdbPlayerItem,
  TsdbTeamSearchResponse,
  TsdbTeamSearchItem,
} from './types'

export class TsdbError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'TsdbError'
  }
}

const MAX_RETRIES = 4
const RETRY_BASE_MS = 2000

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * GET a TheSportsDB V1 endpoint con reintentos ante 429 / 5xx / Cloudflare.
 */
export async function tsdbGetJson<T>(
  apiKey: string,
  endpoint: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const url = new URL(`${TSDB_BASE}/${apiKey}/${endpoint}`)
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue
    url.searchParams.set(k, String(v))
  }

  let lastErr: Error | null = null
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(RETRY_BASE_MS * attempt)

    try {
      const res = await fetch(url.toString())
      const text = await res.text()

      if (!res.ok) {
        const retryable = res.status === 429 || res.status >= 500
        lastErr = new TsdbError(`TheSportsDB HTTP ${res.status} en ${endpoint}`, res.status)
        if (retryable && attempt < MAX_RETRIES - 1) continue
        throw lastErr
      }

      if (text.includes('error code: 1015') || text.trim().startsWith('<')) {
        lastErr = new TsdbError(`TheSportsDB rate limit / HTML en ${endpoint}`, 429)
        if (attempt < MAX_RETRIES - 1) continue
        throw lastErr
      }

      return JSON.parse(text) as T
    } catch (e) {
      if (e instanceof TsdbError) {
        lastErr = e
        if (attempt < MAX_RETRIES - 1 && (e.status === 429 || (e.status ?? 0) >= 500)) continue
        throw e
      }
      if (e instanceof SyntaxError) {
        lastErr = new TsdbError(`TheSportsDB JSON inválido en ${endpoint}`, 502)
        if (attempt < MAX_RETRIES - 1) continue
        throw lastErr
      }
      throw e
    }
  }
  throw lastErr ?? new TsdbError(`TheSportsDB falló en ${endpoint}`)
}

/** @deprecated Prefer tsdbGetJson; mantiene compatibilidad con módulos de partidos */
export async function tsdbGet(
  apiKey: string,
  endpoint: string,
  params: Record<string, string | number | undefined> = {},
): Promise<TsdbEventsResponse> {
  return tsdbGetJson<TsdbEventsResponse>(apiKey, endpoint, params)
}

export function eventsOrEmpty(response: TsdbEventsResponse) {
  return response.events ?? []
}

export function playersOrEmpty(response: TsdbPlayersResponse): TsdbPlayerItem[] {
  const p = response.player
  if (p == null) return []
  return Array.isArray(p) ? p : [p]
}

export function teamsSearchOrEmpty(response: TsdbTeamSearchResponse): TsdbTeamSearchItem[] {
  return response.teams ?? []
}

export async function lookupAllPlayers(
  apiKey: string,
  idTeam: string,
): Promise<TsdbPlayerItem[]> {
  const json = await tsdbGetJson<TsdbPlayersResponse>(apiKey, 'lookup_all_players.php', { id: idTeam })
  return playersOrEmpty(json)
}

export async function searchTeam(
  apiKey: string,
  teamName: string,
): Promise<TsdbTeamSearchItem[]> {
  const json = await tsdbGetJson<TsdbTeamSearchResponse>(apiKey, 'searchteams.php', { t: teamName })
  return teamsSearchOrEmpty(json)
}

export function lineupOrEmpty(response: TsdbLineupResponse): TsdbLineupItem[] {
  const rows = response.lineup
  if (rows == null) return []
  return Array.isArray(rows) ? rows : [rows]
}

export async function eventsNextForTeam(
  apiKey: string,
  idTeam: string,
): Promise<TsdbEventItem[]> {
  const json = await tsdbGetJson<TsdbEventsResponse>(apiKey, 'eventsnext.php', { id: idTeam })
  return eventsOrEmpty(json)
}

export async function eventsLastForTeam(
  apiKey: string,
  idTeam: string,
): Promise<TsdbEventItem[]> {
  const json = await tsdbGetJson<TsdbEventsLastResponse>(apiKey, 'eventslast.php', { id: idTeam })
  return json.results ?? []
}

export async function lookupEventLineup(
  apiKey: string,
  idEvent: string,
): Promise<TsdbLineupItem[]> {
  const json = await tsdbGetJson<TsdbLineupResponse>(apiKey, 'lookuplineup.php', { id: idEvent })
  return lineupOrEmpty(json)
}
