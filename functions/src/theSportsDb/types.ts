/** Evento (partido) retornado por TheSportsDB V1 */
export interface TsdbEventItem {
  idEvent: string
  strEvent: string
  strHomeTeam: string
  strAwayTeam: string
  idHomeTeam: string
  idAwayTeam: string
  /** Marcador local — null si no jugado; string con número si jugado */
  intHomeScore: string | null
  /** Marcador visitante — null si no jugado; string con número si jugado */
  intAwayScore: string | null
  /**
   * Timestamp UTC sin 'Z', ej. "2026-06-11T19:00:00".
   * Añadir 'Z' al parsear: new Date(strTimestamp + 'Z')
   */
  strTimestamp: string
  strTime: string
  /** "Not Started" | "In Progress" | "Match Finished" | "Postponed" | "Cancelled" | "1H" | "HT" | "2H" | "ET" | "Penalties" */
  strStatus: string
  /** "yes" | "no" */
  strPostponed: string
  /** Resultado en texto: "" | "aet" | "1-1 (4-3 pens)" */
  strResult?: string | null
  strSeason?: string
  idLeague?: string
  intRound?: string
}

export interface TsdbEventsResponse {
  events: TsdbEventItem[] | null
}

export interface TsdbEventLookupResponse {
  events: TsdbEventItem[] | null
}

/** Jugador retornado por lookup_all_players.php */
export interface TsdbPlayerItem {
  idPlayer: string
  strPlayer: string
  strPosition?: string | null
  strNumber?: string | null
  strThumb?: string | null
  strCutout?: string | null
  strTeam?: string | null
  idTeam?: string | null
  strStatus?: string | null
  strSport?: string | null
}

export interface TsdbPlayersResponse {
  player: TsdbPlayerItem[] | null
}

/** Resultado de searchteam.php */
export interface TsdbTeamSearchItem {
  idTeam: string
  strTeam: string
  strTeamBadge?: string | null
  strSport?: string | null
}

export interface TsdbTeamSearchResponse {
  teams: TsdbTeamSearchItem[] | null
}

/** eventslast.php devuelve `results`, no `events` */
export interface TsdbEventsLastResponse {
  results: TsdbEventItem[] | null
}

/** Fila de lookuplineup.php (strTeam = club del jugador, no la selección) */
export interface TsdbLineupItem {
  idLineup?: string
  idEvent: string
  idPlayer: string
  strPlayer: string
  strPosition?: string | null
  intSquadNumber?: string | null
  /** "Yes" = local del partido; "No" = visitante */
  strHome?: string | null
  strSubstitute?: string | null
  idTeam?: string | null
  strTeam?: string | null
  strThumb?: string | null
  strCutout?: string | null
}

export interface TsdbLineupResponse {
  lineup: TsdbLineupItem[] | null
}
