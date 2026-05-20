import * as logger from 'firebase-functions/logger'
import { tsdbTeamIdFromMap } from './teamSearchNames'

/**
 * Resuelve idTeam de TheSportsDB para una selección (ISO-3).
 * Solo mapa estático + caché opcional desde eventos WC (sin searchteams: resultados no fiables).
 */
export function resolveTsdbTeamId(
  iso3: string,
  eventTeamIds?: Map<string, string>,
): string | null {
  const fromEvents = eventTeamIds?.get(iso3)
  if (fromEvents) return fromEvents

  const fromMap = tsdbTeamIdFromMap(iso3)
  if (fromMap) return fromMap

  logger.warn(
    `[tsdb:roster] sin idTeam en mapa para ${iso3} — añadir a TSDB_ID_TO_ISO3 en teamCodes.ts`,
  )
  return null
}
