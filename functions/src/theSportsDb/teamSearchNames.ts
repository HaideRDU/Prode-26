import { TSDB_ID_TO_ISO3, TSDB_NAME_TO_ISO3 } from './teamCodes'

/** ISO-3 → idTeam TheSportsDB (mapa inverso de eventos WC 2026) */
export const ISO3_TO_TSDB_TEAM_ID: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(TSDB_ID_TO_ISO3).map(([id, iso]) => [iso, id]),
)

/**
 * ISO-3 → nombre en inglés para searchteam.php.
 * Se toma la primera clave de TSDB_NAME_TO_ISO3 por cada ISO-3 (nombres canónicos).
 */
export const ISO3_TO_TSDB_SEARCH_NAME: Readonly<Record<string, string>> = (() => {
  const out: Record<string, string> = {}
  for (const [name, iso] of Object.entries(TSDB_NAME_TO_ISO3)) {
    if (out[iso] == null) out[iso] = name
  }
  return out
})()

export function tsdbSearchNameForIso3(teamId: string): string | null {
  return ISO3_TO_TSDB_SEARCH_NAME[teamId] ?? null
}

export function tsdbTeamIdFromMap(teamId: string): string | null {
  return ISO3_TO_TSDB_TEAM_ID[teamId] ?? null
}
