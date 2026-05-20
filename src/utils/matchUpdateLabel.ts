import type { MatchDoc } from '../types/predictions'

const ROUND_TITLE: Record<string, string> = {
  r32: 'Dieciseisavos',
  r16: 'Octavos',
  qf: 'Cuartos',
  sf: 'Semifinales',
  third: 'Tercer puesto',
  final: 'Final',
}

function matchSortTime(m: MatchDoc): number {
  const raw = m.finishedAt ?? m.scheduledAt
  if (raw && typeof raw === 'object' && 'toMillis' in raw) {
    return (raw as { toMillis: () => number }).toMillis()
  }
  if (typeof raw === 'string') return new Date(raw).getTime()
  if (typeof raw === 'number') return raw
  return 0
}

function extractMatchNumber(matchId: string): string {
  const ko = matchId.match(/(\d+)\s*$/)
  if (ko) return ko[1]
  const group = matchId.match(/-(\d+)$/)
  if (group) return group[1]
  return matchId.slice(-4)
}

export function formatMatchUpdateLabel(match: MatchDoc & { id: string }): string {
  const partido = extractMatchNumber(match.id)
  if (match.phase === 'group') {
    const group = match.groupId ? `Grupo ${match.groupId}` : 'Fase de grupos'
    return `${group} · Partido ${partido}`
  }
  const round = match.round ? (ROUND_TITLE[match.round] ?? match.round) : 'Eliminatorias'
  return `${round} · Partido ${partido}`
}

export function pickLatestFinishedMatch(
  matches: (MatchDoc & { id: string })[],
): (MatchDoc & { id: string }) | null {
  const finished = matches.filter((m) => m.status === 'finished')
  if (finished.length === 0) return null
  return finished.reduce((best, m) => (matchSortTime(m) > matchSortTime(best) ? m : best))
}

export function tournamentProgressPercent(matches: (MatchDoc & { id: string })[]): number {
  if (matches.length === 0) return 0
  const done = matches.filter((m) => m.status === 'finished').length
  return Math.round((done / matches.length) * 100)
}
