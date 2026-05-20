/**
 * Tipos de dominio (copia alineada con src/types/predictions.ts del cliente).
 */
export type MatchPhase = 'group' | 'knockout'

export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled'

export interface TeamDoc {
  teamId: string
  groupId: string
  nameEs: string
}

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
  wentToPenalties?: boolean | null
  penaltiesWinnerHome?: boolean | null
  apiSportsFixtureId?: number
}

export interface MatchPredictionPayload {
  goalsHome: number
  goalsAway: number
  wentToPenalties?: boolean
  penaltiesWinnerHome?: boolean
}

export type PredictionScope = 'match' | 'tournament'

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
