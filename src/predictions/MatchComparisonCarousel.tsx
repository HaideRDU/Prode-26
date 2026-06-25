import { useEffect, useMemo, useRef, useState } from 'react'
import { toDate } from '../config/ruleset'
import { getPredictedKoLineupForMatch } from '../domain/koPredictedLineup'
import { matchTeamAId, matchTeamBId } from '../domain/matchFields'
import { useMatchList } from '../hooks/useMatchList'
import { useRoomPredictions } from '../hooks/useRoomMatchPredictions'
import { useRoomMembers } from '../hooks/useRoomMembers'
import { subscribeTeamPlayers, playerDocToKey } from '../services/teamsService'
import { scoreMatchPrediction, scorePlayerPerMatchPick } from '../services/scoring'
import { useTeamLabels } from '../hooks/useTeamLabels'
import { useMatchTimeFormatters } from '../hooks/useUserTimeZone'
import type {
  MatchDoc,
  MatchPredictionPayload,
  PlayerPerMatchPayload,
  PredictionDoc,
  TeamPlayerDoc,
} from '../types/predictions'
import { isMatchLiveForDisplay } from '../utils/playerPerMatchWindows'
import { scorersForTeamSide } from '../utils/matchScorerDisplay'
import { TeamFlagName } from './TeamFlagName'

type PlayerInfo = { name: string; theSportsDbPlayerId?: string }
type ProjectedKoLineup = { predictedTeamAId: string | null; predictedTeamBId: string | null }

// Cache compartida de plantillas por equipo: un único listener por teamId,
// reutilizado al cambiar de partido en el carrusel para evitar llamadas repetidas.
const teamPlayersCache = new Map<string, (TeamPlayerDoc & { id: string })[]>()
const teamPlayersListeners = new Map<string, Set<(players: (TeamPlayerDoc & { id: string })[]) => void>>()
const teamPlayersUnsubs = new Map<string, () => void>()

function ensureTeamPlayersSubscription(teamId: string) {
  if (teamPlayersUnsubs.has(teamId)) return
  const unsub = subscribeTeamPlayers(
    teamId,
    (players) => {
      teamPlayersCache.set(teamId, players)
      teamPlayersListeners.get(teamId)?.forEach((cb) => cb(players))
    },
    () => {},
  )
  if (unsub) teamPlayersUnsubs.set(teamId, unsub)
}

function isMatchPayload(p: unknown): p is MatchPredictionPayload {
  return typeof p === 'object' && p !== null && typeof (p as MatchPredictionPayload).goalsTeamA === 'number'
}

function isPlayerPickPayload(p: unknown): p is PlayerPerMatchPayload {
  return (
    typeof p === 'object' &&
    p !== null &&
    (p as PlayerPerMatchPayload).kind === 'player_match_pick' &&
    typeof (p as PlayerPerMatchPayload).playerKey === 'string'
  )
}

function phaseLabel(match: MatchDoc): string {
  if (match.phase === 'group' && match.groupId) return `Grupo ${match.groupId}`
  if (match.round) return match.round.toUpperCase()
  return match.phase === 'knockout' ? 'Eliminatorias' : 'Partido'
}

function matchKickoffMs(match: MatchDoc): number {
  return toDate(match.scheduledAt)?.getTime() ?? Number.MAX_SAFE_INTEGER
}

/** Encuentra el partido más cercano: en juego primero, luego el próximo por jugar, sino el último finalizado. */
function findNearestMatchIndex(matches: (MatchDoc & { id: string })[], nowMs: number): number {
  const liveIdx = matches.findIndex((m) => isMatchLiveForDisplay(m, nowMs))
  if (liveIdx !== -1) return liveIdx

  let upcomingIdx = -1
  let upcomingMs = Number.MAX_SAFE_INTEGER
  matches.forEach((m, i) => {
    if (m.status !== 'scheduled') return
    const k = matchKickoffMs(m)
    if (k >= nowMs && k < upcomingMs) {
      upcomingMs = k
      upcomingIdx = i
    }
  })
  if (upcomingIdx !== -1) return upcomingIdx

  let lastFinishedIdx = -1
  matches.forEach((m, i) => {
    if (m.status === 'finished') lastFinishedIdx = i
  })
  if (lastFinishedIdx !== -1) return lastFinishedIdx

  return matches.length > 0 ? matches.length - 1 : -1
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function koLineupStatus(
  lineup: ProjectedKoLineup | null,
  actualTeamAId: string | null,
  actualTeamBId: string | null,
): 'same' | 'inverted' | 'different' | 'unknown' {
  if (!lineup?.predictedTeamAId || !lineup.predictedTeamBId || !actualTeamAId || !actualTeamBId) {
    return 'unknown'
  }
  if (lineup.predictedTeamAId === actualTeamAId && lineup.predictedTeamBId === actualTeamBId) {
    return 'same'
  }
  if (lineup.predictedTeamAId === actualTeamBId && lineup.predictedTeamBId === actualTeamAId) {
    return 'inverted'
  }
  return 'different'
}

function koLineupStatusLabel(status: ReturnType<typeof koLineupStatus>): string {
  switch (status) {
    case 'same':
      return 'Coincide'
    case 'inverted':
      return 'Mismos equipos'
    case 'different':
      return 'Cruce distinto'
    default:
      return 'Sin datos'
  }
}

function ProjectedKoCell({
  lineup,
  actualTeamAId,
  actualTeamBId,
  teamLabel,
}: {
  lineup: ProjectedKoLineup | null
  actualTeamAId: string | null
  actualTeamBId: string | null
  teamLabel: (id: string) => string
}) {
  const status = koLineupStatus(lineup, actualTeamAId, actualTeamBId)
  if (!lineup?.predictedTeamAId || !lineup.predictedTeamBId) {
    return <span className="match-comparison-table__empty">Sin cruce</span>
  }
  return (
    <div className="match-comparison-table__projected-ko">
      <span className="match-comparison-table__projected-teams">
        {teamLabel(lineup.predictedTeamAId)} vs {teamLabel(lineup.predictedTeamBId)}
      </span>
      <span className={`match-comparison-table__ko-badge match-comparison-table__ko-badge--${status}`}>
        {koLineupStatusLabel(status)}
      </span>
    </div>
  )
}

function MatchCard({
  match,
  teamLabel,
  isSelected,
  formatMatchTime,
  onSelect,
}: {
  match: MatchDoc & { id: string }
  teamLabel: (id: string) => string
  isSelected: boolean
  formatMatchTime: (scheduledAt: unknown) => string
  onSelect: () => void
}) {
  const teamAId = matchTeamAId(match)
  const teamBId = matchTeamBId(match)
  const rawA = match.goalsTeamA ?? match.goalsHome
  const rawB = match.goalsTeamB ?? match.goalsAway
  const hasScore = rawA !== null && rawA !== undefined && rawB !== null && rawB !== undefined
  const scorersA = scorersForTeamSide(match.scorers, 'teamA')
  const scorersB = scorersForTeamSide(match.scorers, 'teamB')
  const showScorers = match.status === 'live' || match.status === 'finished'
  const cardClass = [
    'match-comparison-card',
    isSelected ? 'match-comparison-card--selected' : '',
    match.status === 'live' || isMatchLiveForDisplay(match) ? 'match-comparison-card--live' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button type="button" className={cardClass} onClick={onSelect} aria-pressed={isSelected}>
      <div className="match-comparison-card__meta">
        <span className="match-comparison-card__phase">{phaseLabel(match)}</span>
        {match.status === 'live' || isMatchLiveForDisplay(match) ? (
          <span className="match-comparison-card__status match-comparison-card__status--live">En juego</span>
        ) : (
          <span className="match-comparison-card__time">{formatMatchTime(match.scheduledAt)}</span>
        )}
      </div>
      <div className="match-comparison-card__teams">
        <div className="match-comparison-card__team">
          <TeamFlagName teamId={teamAId ?? ''} name={teamLabel(teamAId ?? '')} layout="stack" />
          {showScorers && scorersA.length > 0 ? (
            <ul className="match-comparison-card__scorers" aria-label="Goles local">
              {scorersA.map((g) => (
                <li key={g.key}>
                  {g.minute != null ? `${g.minute}' ` : ''}
                  {g.name}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="match-comparison-card__score">
          {hasScore ? (
            <>
              <span>{rawA}</span>
              <span className="match-comparison-card__score-sep">-</span>
              <span>{rawB}</span>
            </>
          ) : (
            <span className="match-comparison-card__score-vs">vs</span>
          )}
        </div>
        <div className="match-comparison-card__team">
          <TeamFlagName teamId={teamBId ?? ''} name={teamLabel(teamBId ?? '')} layout="stack" />
          {showScorers && scorersB.length > 0 ? (
            <ul className="match-comparison-card__scorers" aria-label="Goles visitante">
              {scorersB.map((g) => (
                <li key={g.key}>
                  {g.minute != null ? `${g.minute}' ` : ''}
                  {g.name}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </button>
  )
}

function MatchPredictionsTable({
  roomId,
  match,
  teamLabel,
  predictions,
  predictionsLoading,
}: {
  roomId: string | undefined
  match: MatchDoc & { id: string }
  teamLabel: (id: string) => string
  predictions: PredictionDoc[]
  predictionsLoading: boolean
}) {
  const { members, loading: membersLoading } = useRoomMembers(roomId)
  const [playerByKey, setPlayerByKey] = useState<Record<string, PlayerInfo>>({})
  const [playersLoaded, setPlayersLoaded] = useState(false)

  const teamAId = matchTeamAId(match)
  const teamBId = matchTeamBId(match)

  useEffect(() => {
    const teamIds = [teamAId, teamBId].filter((id): id is string => Boolean(id))
    if (teamIds.length === 0) {
      setPlayerByKey({})
      setPlayersLoaded(true)
      return
    }
    let cancelled = false

    const recompute = () => {
      const players: Record<string, PlayerInfo> = {}
      for (const teamId of teamIds) {
        const roster = teamPlayersCache.get(teamId)
        if (!roster) continue
        for (const p of roster) {
          players[playerDocToKey(p)] = { name: p.name, theSportsDbPlayerId: p.theSportsDbPlayerId }
        }
      }
      if (!cancelled) setPlayerByKey(players)
    }

    setPlayersLoaded(teamIds.every((id) => teamPlayersCache.has(id)))
    recompute()

    const cb = () => {
      setPlayersLoaded(teamIds.every((id) => teamPlayersCache.has(id)))
      recompute()
    }
    for (const teamId of teamIds) {
      let set = teamPlayersListeners.get(teamId)
      if (!set) {
        set = new Set()
        teamPlayersListeners.set(teamId, set)
      }
      set.add(cb)
      ensureTeamPlayersSubscription(teamId)
    }
    return () => {
      cancelled = true
      for (const teamId of teamIds) {
        teamPlayersListeners.get(teamId)?.delete(cb)
      }
    }
  }, [teamAId, teamBId])

  const matchPredictions = useMemo(
    () => predictions.filter((p) => p.matchId === match.id),
    [predictions, match.id],
  )

  const byUserId = useMemo(() => {
    const map = new Map<string, { score?: MatchPredictionPayload; bonus?: string }>()
    for (const pred of matchPredictions) {
      const entry = map.get(pred.userId) ?? {}
      if (pred.scope === 'match' && isMatchPayload(pred.payload)) {
        entry.score = pred.payload
      } else if (pred.scope === 'player_per_match' && isPlayerPickPayload(pred.payload)) {
        entry.bonus = pred.payload.playerKey
      }
      map.set(pred.userId, entry)
    }
    return map
  }, [matchPredictions])

  const isFinished = match.status === 'finished'
  const isKnockout = match.phase === 'knockout'

  const rows = useMemo(() => {
    return members
      .map((member) => {
        const entry = byUserId.get(member.userId)
        const score = entry?.score
        const bonusKey = entry?.bonus
        const bonusPlayer = bonusKey ? playerByKey[bonusKey] : undefined
        const bonusName = bonusKey ? bonusPlayer?.name ?? bonusKey : null
        const userPredictions = isKnockout ? predictions.filter((p) => p.userId === member.userId) : []
        const predictedLineup = isKnockout
          ? getPredictedKoLineupForMatch(userPredictions, match.id)
          : null
        let points: number | null = null
        if (isFinished && playersLoaded) {
          const matchPts = scoreMatchPrediction(match, score ?? null, predictedLineup)
          const bonusPts = bonusKey
            ? scorePlayerPerMatchPick(match, bonusKey, {
                playerKey: bonusKey,
                name: bonusPlayer?.name,
                theSportsDbPlayerId: bonusPlayer?.theSportsDbPlayerId,
              })
            : 0
          points = matchPts + bonusPts
        }
        return {
          userId: member.userId,
          displayName: member.displayName || 'Jugador',
          score,
          bonusName,
          predictedLineup,
          points,
        }
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'))
  }, [members, byUserId, playerByKey, playersLoaded, isFinished, isKnockout, match, predictions])

  if (predictionsLoading || membersLoading) {
    return <p className="match-comparison-table__hint">Cargando predicciones…</p>
  }

  if (rows.length === 0) {
    return <p className="match-comparison-table__hint">Esta sala todavía no tiene miembros.</p>
  }

  return (
    <div className="match-comparison-table-wrap">
      <table className="match-comparison-table">
        <thead>
          <tr>
            <th scope="col">Usuario</th>
            <th scope="col">Predicción</th>
            {isKnockout ? <th scope="col">Cruce pronosticado</th> : null}
            <th scope="col">Jugador bonus</th>
            {isFinished ? <th scope="col">Puntos</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.userId}>
              <td>
                <div className="match-comparison-table__user">
                  <span className="match-comparison-table__avatar" aria-hidden>
                    {initialsFromName(row.displayName)}
                  </span>
                  <span className="match-comparison-table__name">{row.displayName}</span>
                </div>
              </td>
              <td>
                {row.score ? (
                  <span className="match-comparison-table__score">
                    {row.score.goalsTeamA} - {row.score.goalsTeamB}
                  </span>
                ) : (
                  <span className="match-comparison-table__empty">Sin predicción</span>
                )}
              </td>
              {isKnockout ? (
                <td>
                  <ProjectedKoCell
                    lineup={row.predictedLineup}
                    actualTeamAId={teamAId}
                    actualTeamBId={teamBId}
                    teamLabel={teamLabel}
                  />
                </td>
              ) : null}
              <td>
                {row.bonusName ? (
                  <span className="match-comparison-table__bonus">{row.bonusName}</span>
                ) : (
                  <span className="match-comparison-table__empty">Sin elegir</span>
                )}
              </td>
              {isFinished ? (
                <td>
                  {row.points == null ? (
                    <span className="match-comparison-table__points match-comparison-table__points--pending">
                      …
                    </span>
                  ) : (
                    <span className="match-comparison-table__points">
                      {row.points > 0 ? `+${row.points}` : row.points}
                    </span>
                  )}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="match-comparison-table__caption">
        {teamLabel(matchTeamAId(match) ?? '')} vs {teamLabel(matchTeamBId(match) ?? '')}
      </p>
    </div>
  )
}

export function MatchComparisonCarousel({ roomId }: { roomId: string | undefined }) {
  const { matches, loading } = useMatchList()
  const { predictions, loading: predictionsLoading } = useRoomPredictions(roomId)
  const { label: teamLabel } = useTeamLabels()
  const { formatMatchTime } = useMatchTimeFormatters()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const sortedMatches = useMemo(
    () => [...matches].sort((a, b) => matchKickoffMs(a) - matchKickoffMs(b)),
    [matches],
  )

  const nearestId = useMemo(() => {
    const idx = findNearestMatchIndex(sortedMatches, Date.now())
    return idx >= 0 ? sortedMatches[idx].id : null
  }, [sortedMatches])

  const effectiveSelectedId = selectedId ?? nearestId

  useEffect(() => {
    if (!effectiveSelectedId) return
    const el = cardRefs.current.get(effectiveSelectedId)
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [effectiveSelectedId, sortedMatches.length])

  if (loading) return null
  if (sortedMatches.length === 0) return null

  const selectedMatch = sortedMatches.find((m) => m.id === effectiveSelectedId)

  return (
    <section className="match-comparison-section pred-wc26" aria-label="Comparación de partidos">
      <h2 className="pred-section-title match-comparison-section__title">Comparación de partidos</h2>
      <div className="match-comparison-carousel" ref={trackRef}>
        {sortedMatches.map((m) => (
          <div
            key={m.id}
            className="match-comparison-carousel__item"
            ref={(el) => {
              if (el) cardRefs.current.set(m.id, el)
              else cardRefs.current.delete(m.id)
            }}
          >
            <MatchCard
              match={m}
              teamLabel={teamLabel}
              isSelected={m.id === effectiveSelectedId}
              formatMatchTime={formatMatchTime}
              onSelect={() => setSelectedId(m.id)}
            />
          </div>
        ))}
      </div>
      {selectedMatch ? (
        <MatchPredictionsTable
          roomId={roomId}
          match={selectedMatch}
          teamLabel={teamLabel}
          predictions={predictions}
          predictionsLoading={predictionsLoading}
        />
      ) : null}
    </section>
  )
}
