/** Mundial FIFA — API-Sports / API-Football v3 */
export const API_SPORTS_BASE = 'https://v3.football.api-sports.io'
export const WC_LEAGUE_ID = 1
export const WC_SEASON = 2026

/** Empieza a consultar 15 min antes del pitido inicial */
export const POLL_BEFORE_KICKOFF_MS = 15 * 60 * 1000
/** Sigue consultando hasta 3.5 h después (prórroga + penales) */
export const POLL_AFTER_KICKOFF_MS = 3.5 * 60 * 60 * 1000

export const TOURNAMENT_WINDOW_START_MS = Date.parse('2026-06-10T00:00:00.000Z')
export const TOURNAMENT_WINDOW_END_MS = Date.parse('2026-07-21T00:00:00.000Z')

/** Máximo de IDs por petición fixtures?ids=… */
export const FIXTURE_IDS_BATCH_SIZE = 20
