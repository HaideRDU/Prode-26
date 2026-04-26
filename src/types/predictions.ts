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
}

/** Partido en Firestore: matches/{matchId} */
export interface MatchDoc {
  teamHomeId: string
  teamAwayId: string
  goalsHome: number | null
  goalsAway: number | null
  phase: MatchPhase
  groupId?: string
  round?: string
  scheduledAt: unknown
  status: MatchStatus
  finishedAt?: unknown
  /** Solo KO: hubo tanda de penales tras empate (resultado oficial) */
  wentToPenalties?: boolean | null
  /** true = local ganó penales (si wentToPenalties) */
  penaltiesWinnerHome?: boolean | null
}

/** Predicción de marcador para un partido */
export interface MatchPredictionPayload {
  goalsHome: number
  goalsAway: number
  /** Eliminatorias: empate en 90’/prórroga predicho → desempate por penales */
  wentToPenalties?: boolean
  /** Obligatorio si wentToPenalties y empate en goles */
  penaltiesWinnerHome?: boolean
}

export type PredictionScope = 'match' | 'tournament'

/** Predicción atómica: predictions/{id} */
export interface PredictionDoc {
  id?: string
  userId: string
  roomId: string
  scope: PredictionScope
  matchId?: string
  questionId?: string
  payload: TournamentPredictionPayload | MatchPredictionPayload
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

/** rooms/{roomId} */
export interface RoomDoc {
  name: string
  description?: string
  inviteCode: string
  maxMembers: RoomMaxMembers
  createdBy: string
  createdAt: unknown
  type: RoomType
  /** Preguntas habilitadas para la sala privada (si falta, se asume todas). */
  enabledQuestionIds?: string[]
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
  breakdown?: PointsBreakdown
  updatedAt?: unknown
}

export interface PointsBreakdown {
  matchPoints: number
  tournamentPoints: number
}
