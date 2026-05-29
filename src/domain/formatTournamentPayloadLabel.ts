import type { TournamentPredictionPayload } from '../types/predictions'

export function formatTournamentPayloadLabel(
  payload: TournamentPredictionPayload | null | undefined,
  teamLabel: (id: string) => string,
): string {
  if (!payload) return '—'
  switch (payload.kind) {
    case 'team':
      return teamLabel(payload.teamId)
    case 'player':
      return payload.playerId
    case 'text':
      return payload.value.trim() || '—'
    case 'boolean':
      return payload.value ? 'Sí' : 'No'
    case 'group':
      return `Grupo ${payload.groupId}`
    case 'match_ref':
      return payload.matchId
    case 'range':
      return payload.rangeId
    default:
      return '—'
  }
}
