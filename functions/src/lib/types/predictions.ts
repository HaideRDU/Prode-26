/**
 * Tipos de dominio (copia alineada con src/types/predictions.ts del cliente).
 */
export type MatchPhase = 'group' | 'knockout'

export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled'

export interface TeamDoc {
  teamId: string
  groupId: string
  nameEs: string
  /** idTeam en TheSportsDB; lo rellena seed:tsdb-rosters */
  theSportsDbTeamId?: string
  /** id numérico en API-Football; lo rellena seed:apisports-rosters */
  apiSportsTeamId?: number
  rosterSyncedAt?: unknown
  rosterPlayerCount?: number
  rosterSource?: 'apisports' | 'thesportsdb' | 'mixed' | 'panini' | 'manual'
}

/** Jugador en teams/{teamId}/players/{playerId} */
export interface TeamPlayerDoc {
  theSportsDbPlayerId?: string
  apiSportsPlayerId?: number
  paniniStickerCode?: string
  paniniSlot?: number
  name: string
  position?: string
  number?: string
  thumbUrl?: string
  photoUrl?: string
  syncedAt?: unknown
}

export interface MatchScorerEntry {
  playerKey: string
  /** Goles en este evento (1 por entrada en timeline; scoring suma por jugador). */
  goals: number
  includesPenalties?: boolean
  /** Nombre legible desde timeline TSDB o plantilla; evita mostrar solo el id. */
  playerName?: string
  /** Minuto del gol (90'+prórroga). */
  minute?: number
  /** Equipo que anotó: A = local / teamAId. */
  teamSide?: 'teamA' | 'teamB'
}

export interface MatchDoc {
  teamAId: string
  teamBId: string
  teamHomeId?: string
  teamAwayId?: string
  /** @deprecated Usar goalsTeamA */
  goalsHome: number | null
  /** @deprecated Usar goalsTeamB */
  goalsAway: number | null
  goalsTeamA?: number | null
  goalsTeamB?: number | null
  phase: MatchPhase
  groupId?: string
  round?: string
  scheduledAt: unknown
  status: MatchStatus
  finishedAt?: unknown
  wentToPenalties?: boolean | null
  penaltiesWinnerHome?: boolean | null
  penaltiesWinnerAway?: boolean | null
  penaltiesWinnerTeamA?: boolean | null
  penaltiesWinnerTeamB?: boolean | null
  scorers?: MatchScorerEntry[]
  /** ID de evento en TheSportsDB (league 4429); lo rellena el sync. */
  theSportsDbEventId?: string
  /** @deprecated Reemplazado por theSportsDbEventId */
  apiSportsFixtureId?: number
}

export interface MatchPredictionPayload {
  goalsTeamA: number
  goalsTeamB: number
  wentToPenalties?: boolean
  penaltiesWinnerTeamA?: boolean
  penaltiesWinnerTeamB?: boolean
  goalsHome?: number
  goalsAway?: number
  penaltiesWinnerHome?: boolean
  penaltiesWinnerAway?: boolean
}

export type PredictionScope = 'match' | 'tournament' | 'player_per_match'

export interface PlayerPerMatchPayload {
  kind: 'player_match_pick'
  playerKey: string
}

export interface PredictionDoc {
  id?: string
  userId: string
  roomId: string
  scope: PredictionScope
  matchId?: string
  questionId?: string
  payload: TournamentPredictionPayload | MatchPredictionPayload | PlayerPerMatchPayload
  updatedAt?: unknown
}

export type TournamentPredictionPayload =
  | { kind: 'team'; teamId: string }
  | { kind: 'player'; playerId: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'range'; rangeId: string }
  | { kind: 'group'; groupId: string }
  | { kind: 'match_ref'; matchId: string }
  | { kind: 'text'; value: string }

export interface TournamentResultDoc {
  questionId: string
  resolved: boolean
  answer: TournamentPredictionPayload | null
  updatedAt?: unknown
}

export interface RoomDoc {
  name: string
  description?: string
  inviteCode: string
  maxMembers: 20 | 30 | 40 | 50 | 100
  createdBy: string
  createdAt: unknown
  type: 'private' | 'global'
  enabledQuestionIds?: string[]
}
