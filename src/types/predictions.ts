/**
 * Tipos de dominio para predicciones, partidos, salas y clasificación.
 */

export type MatchPhase = 'group' | 'knockout'

export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled'

/** Selección en Firestore: teams/{teamId} — ISO-3 = id del documento */
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
  /** Código sticker Panini (ej. MEX15); doc id en seed Panini */
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
  goals: number
  includesPenalties?: boolean
  /** Autogol: cuenta para el marcador del equipo rival, pero NO para el bonus "jugador por partido". */
  ownGoal?: boolean
  playerName?: string
  theSportsDbPlayerId?: string
  minute?: number
  teamSide?: 'teamA' | 'teamB'
}

/** Partido en Firestore: matches/{matchId} */
export interface MatchDoc {
  teamAId: string
  teamBId: string
  /** @deprecated Solo lectura de documentos antiguos */
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
  /** Solo KO: hubo tanda de penales tras empate (resultado oficial) */
  wentToPenalties?: boolean | null
  /**
   * Penales tras empate en KO. Convención: en el ganador va `true`, en el perdedor `false`.
   * `penaltiesWinnerTeamA` / `penaltiesWinnerHome` = ganó Equipo A / local.
   * `penaltiesWinnerTeamB` / `penaltiesWinnerAway` = ganó Equipo B / visitante.
   */
  penaltiesWinnerHome?: boolean | null
  penaltiesWinnerAway?: boolean | null
  penaltiesWinnerTeamA?: boolean | null
  penaltiesWinnerTeamB?: boolean | null
  /**
   * Contrato futuro para "Jugador por Partido" (90' + prórroga, sin tandas).
   * Se mantiene opcional hasta definir fuente oficial de plantillas/eventos.
   */
  scorers?: MatchScorerEntry[]
  /** ID de evento en TheSportsDB (league 4429); lo rellena el sync en backend. */
  theSportsDbEventId?: string
  /** @deprecated Reemplazado por theSportsDbEventId */
  apiSportsFixtureId?: number
}

/** Predicción de marcador para un partido (canónico: Equipo A / Equipo B). */
export interface MatchPredictionPayload {
  goalsTeamA: number
  goalsTeamB: number
  /** Eliminatorias: empate en 90’/prórroga predicho → desempate por penales */
  wentToPenalties?: boolean
  /** Penales: true = ganó ese lado, false = perdió. */
  penaltiesWinnerTeamA?: boolean
  penaltiesWinnerTeamB?: boolean
  /** @deprecated Solo lectura de documentos antiguos */
  goalsHome?: number
  goalsAway?: number
  penaltiesWinnerHome?: boolean
  penaltiesWinnerAway?: boolean
}

export type PredictionScope = 'match' | 'tournament' | 'player_per_match'

export interface PlayerPerMatchPayload {
  kind: 'player_match_pick'
  /**
   * Identificador o nombre normalizado del jugador.
   * Queda flexible hasta tener la fuente oficial de plantillas.
   */
  playerKey: string
}

/** Predicción atómica: predictions/{id} */
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

/** Valores posibles para extras y preguntas (equipo, jugador, booleano, rango, etc.) */
export type TournamentPredictionPayload =
  | { kind: 'team'; teamId: string }
  | { kind: 'player'; playerId: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'range'; rangeId: string }
  | { kind: 'group'; groupId: string }
  | { kind: 'match_ref'; matchId: string }
  /** Texto libre (jugador, marcador, etc.) — comparación normalizada al resolver */
  | { kind: 'text'; value: string }

/** Resultado oficial de una pregunta de torneo: tournamentResults/{questionId} */
export interface TournamentResultDoc {
  questionId: string
  resolved: boolean
  /** Misma forma que payload de predicción cuando corresponde */
  answer: TournamentPredictionPayload | null
  updatedAt?: unknown
}

export type RoomType = 'private' | 'global'

export type RoomMaxMembers = 20 | 30 | 40 | 50 | 100

/** Premios para el podio en salas privadas (texto libre). */
export interface PrivateRoomPodiumPrizes {
  first?: string
  second?: string
  third?: string
}

/** rooms/{roomId} */
export interface RoomDoc {
  name: string
  description?: string
  inviteCode: string
  maxMembers: RoomMaxMembers
  createdBy: string
  createdAt: unknown
  type: RoomType
  rulesetId?: string
  /** Preguntas habilitadas para la sala privada (si falta, se asume todas). */
  enabledQuestionIds?: string[]
  /** Premios 1.º / 2.º / 3.º (solo salas privadas). */
  podiumPrizes?: PrivateRoomPodiumPrizes
}

/** roomMembers: id = "{roomId}_{userId}" */
export interface RoomMemberDoc {
  roomId: string
  userId: string
  joinedAt: unknown
  displayName: string
}

/** standings/{roomId}/users/{userId} */
export interface StandingUserDoc {
  userId: string
  displayName?: string
  points: number
  rank: number
  /** Posiciones ganadas desde el último recálculo (positivo = subió). */
  rankDelta?: number
  breakdown?: PointsBreakdown
  tieBreak?: TieBreakStats
  updatedAt?: unknown
}

export interface PointsBreakdown {
  matchPoints: number
  tournamentPoints: number
  advancementPoints?: number
  specialsPoints?: number
  playerPickPoints?: number
}

export interface TieBreakStats {
  exactScoreHits: number
  specialQuestionHits: number
  championHit: boolean
}
