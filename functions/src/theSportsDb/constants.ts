/** TheSportsDB — FIFA World Cup 2026 (Free plan, clave pública 123) */
export const TSDB_BASE = 'https://www.thesportsdb.com/api/v1/json'
export const TSDB_FREE_KEY = '123'
export const TSDB_WC_LEAGUE_ID = 4429
export const TSDB_SEASON = '2026'

/** Empieza a consultar 15 min antes del pitido inicial */
export const POLL_BEFORE_KICKOFF_MS = 15 * 60 * 1000
/** Sigue consultando hasta 3.5 h después (prórroga + penales) */
export const POLL_AFTER_KICKOFF_MS = 3.5 * 60 * 60 * 1000

export const TOURNAMENT_WINDOW_START_MS = Date.parse('2026-06-10T00:00:00.000Z')
export const TOURNAMENT_WINDOW_END_MS = Date.parse('2026-07-21T00:00:00.000Z')

/** Tolerancia máxima para emparejar kickoff TSDB ↔ Firestore */
export const KICKOFF_TOLERANCE_MS = 3 * 60 * 60 * 1000

/** Mínimo de jugadores en lookup_all_players para considerar plantel "publicado" */
export const MIN_ROSTER_SIZE = 5

/** Pausa entre lookup_all_players (Free ~30 req/min → ~2.5 s) */
export const ROSTER_SYNC_DELAY_MS = 2500
