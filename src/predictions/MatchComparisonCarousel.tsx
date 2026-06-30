import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_RULESET, toDate, type KnockoutRoundId } from '../config/ruleset'
import { getPredictedKoLineupForMatch } from '../domain/koPredictedLineup'
import { matchTeamAId, matchTeamBId } from '../domain/matchFields'
import { penaltiesWinnerIsTeamAFromPayload } from '../domain/matchPenalties'
import { useMatchList } from '../hooks/useMatchList'
import { useRoomPredictions } from '../hooks/useRoomMatchPredictions'
import { useRoomMembers } from '../hooks/useRoomMembers'
import { subscribeTeamPlayers, playerDocToKey } from '../services/teamsService'
import { scoreMatchPredictionDetails, scorePlayerPerMatchPick, type MatchScoreDetails } from '../services/scoring'
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

type RowPointsBreakdownItem = {
  label: string
  points: number
}

type RowPointsBreakdown = {
  matchPoints: number
  bonusPoints: number
  total: number
  items: RowPointsBreakdownItem[]
  ariaLabel: string
}

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

function matchWinnerSide(match: MatchDoc): 'teamA' | 'teamB' | null {
  if (match.status !== 'finished') return null
  const rawA = match.goalsTeamA ?? match.goalsHome
  const rawB = match.goalsTeamB ?? match.goalsAway
  if (rawA == null || rawB == null) return null
  if (rawA > rawB) return 'teamA'
  if (rawB > rawA) return 'teamB'
  if (match.phase !== 'knockout') return null
  const pensWinnerIsTeamA = penaltiesWinnerIsTeamAFromPayload(match)
  if (pensWinnerIsTeamA === true) return 'teamA'
  if (pensWinnerIsTeamA === false) return 'teamB'
  return null
}

function penaltyWinnerLabel(match: MatchDoc, teamLabel: (id: string) => string): string | null {
  if (match.phase !== 'knockout' || match.status !== 'finished' || match.wentToPenalties !== true) return null
  const winnerSide = matchWinnerSide(match)
  const winnerId = winnerSide === 'teamA' ? matchTeamAId(match) : winnerSide === 'teamB' ? matchTeamBId(match) : null
  return winnerId ? `${teamLabel(winnerId)} ganó por penales` : 'Definido por penales'
}

function matchKickoffMs(match: MatchDoc): number {
  return toDate(match.scheduledAt)?.getTime() ?? Number.MAX_SAFE_INTEGER
}

function normalizeKoRoundId(round: string | undefined): KnockoutRoundId {
  switch (round) {
    case 'r32':
    case 'round32':
    case 'round_of_32':
    case '1/16':
      return 'r32'
    case 'r16':
    case 'round16':
    case 'round_of_16':
    case 'octavos':
      return 'r16'
    case 'qf':
    case 'quarter':
    case 'quarters':
    case 'cuartos':
      return 'qf'
    case 'sf':
    case 'semi':
    case 'semis':
    case 'semifinal':
      return 'sf'
    case 'third':
    case 'third_place':
    case 'tercer':
      return 'third'
    case 'final':
      return 'final'
    default:
      return 'r32'
  }
}

function matchPointsRule(match: MatchDoc) {
  if (match.phase === 'group') return DEFAULT_RULESET.points.matchByPhase.group
  return DEFAULT_RULESET.points.matchByPhase.knockout[normalizeKoRoundId(match.round)]
}

function playerGoalPointsForMatch(match: MatchDoc): number {
  if (match.phase === 'group') return DEFAULT_RULESET.points.playerPerMatch.goalsPerGoalByRound.group
  return DEFAULT_RULESET.points.playerPerMatch.goalsPerGoalByRound[normalizeKoRoundId(match.round)]
}

function signedPoints(points: number): string {
  return points > 0 ? `+${points}` : `${points}`
}

function buildMatchPointsItems(
  match: MatchDoc,
  details: MatchScoreDetails,
  predictedLineup: ProjectedKoLineup | null,
  teamAId: string | null,
  teamBId: string | null,
  teamLabel: (id: string) => string,
): RowPointsBreakdownItem[] {
  if (details.points <= 0) return []
  const rule = matchPointsRule(match)
  if (details.exactScoreHit) {
    const exactScorePoints = rule.goalsTeamA + rule.goalsTeamB
    return [
      {
        label: match.phase === 'knockout' ? 'Ganador' : 'Ganador / empate',
        points: rule.winnerOrDraw,
      },
      { label: 'Marcador exacto', points: exactScorePoints },
    ].filter((item) => item.points > 0)
  }
  const predTeamA = predictedLineup?.predictedTeamAId ?? teamAId
  const predTeamB = predictedLineup?.predictedTeamBId ?? teamBId
  const items: RowPointsBreakdownItem[] = []
  if (details.winnerOrDrawHit) {
    items.push({
      label: match.phase === 'knockout' ? 'Ganador' : 'Ganador / empate',
      points: rule.winnerOrDraw,
    })
  }
  if (details.goalsAHit) {
    items.push({
      label: `Goles ${predTeamA ? teamLabel(predTeamA) : 'equipo A'}`,
      points: rule.goalsTeamA,
    })
  }
  if (details.goalsBHit) {
    items.push({
      label: `Goles ${predTeamB ? teamLabel(predTeamB) : 'equipo B'}`,
      points: rule.goalsTeamB,
    })
  }
  return items
}

function buildPointsBreakdown({
  match,
  details,
  bonusName,
  bonusPoints,
  predictedLineup,
  teamAId,
  teamBId,
  teamLabel,
}: {
  match: MatchDoc
  details: MatchScoreDetails
  bonusName: string | null
  bonusPoints: number
  predictedLineup: ProjectedKoLineup | null
  teamAId: string | null
  teamBId: string | null
  teamLabel: (id: string) => string
}): RowPointsBreakdown | null {
  const total = details.points + bonusPoints
  if (total <= 0) return null

  const items = buildMatchPointsItems(match, details, predictedLineup, teamAId, teamBId, teamLabel)
  if (bonusName && bonusPoints > 0) {
    const perGoal = playerGoalPointsForMatch(match)
    items.push({
      label: `Jugador bonus (${bonusName}, ${perGoal} por gol)`,
      points: bonusPoints,
    })
  }

  const ariaLabel = [
    ...items.map((item) => `${item.label}: ${signedPoints(item.points)}`),
    `Total: ${signedPoints(total)}`,
  ].join('. ')

  return {
    matchPoints: details.points,
    bonusPoints,
    total,
    items,
    ariaLabel,
  }
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

function ProjectedKoRow({
  lineup,
  score,
  actualTeamAId,
  actualTeamBId,
  actualScoreLabel,
  actualPenaltyLabel,
  teamLabel,
}: {
  lineup: ProjectedKoLineup | null
  score?: MatchPredictionPayload
  actualTeamAId: string | null
  actualTeamBId: string | null
  actualScoreLabel?: string | null
  actualPenaltyLabel?: string | null
  teamLabel: (id: string) => string
}) {
  const status = koLineupStatus(lineup, actualTeamAId, actualTeamBId)

  // Columna izquierda: cruce + marcador predicho
  const leftCell = lineup?.predictedTeamAId && lineup?.predictedTeamBId ? (
    <div className="match-comparison-table__ko-pred">
      <span className="match-comparison-table__projected-teams">
        {teamLabel(lineup.predictedTeamAId)} vs {teamLabel(lineup.predictedTeamBId)}
      </span>
      {score ? (
        <span className="match-comparison-table__score">
          {score.goalsTeamA} – {score.goalsTeamB}
        </span>
      ) : null}
    </div>
  ) : (
    <span className="match-comparison-table__empty">Sin cruce</span>
  )

  // Columna central: badge de estado
  const badgeCell = lineup?.predictedTeamAId ? (
    <span className={`match-comparison-table__ko-badge match-comparison-table__ko-badge--${status}`}>
      {koLineupStatusLabel(status)}
    </span>
  ) : null

  // Columna derecha: cruce real
  const rightCell = actualTeamAId && actualTeamBId ? (
    <div className="match-comparison-table__ko-pred">
      <span className="match-comparison-table__projected-teams match-comparison-table__projected-teams--actual">
        {teamLabel(actualTeamAId)} vs {teamLabel(actualTeamBId)}
      </span>
      {actualScoreLabel ? (
        <span className="match-comparison-table__score">{actualScoreLabel}</span>
      ) : null}
      {actualPenaltyLabel ? (
        <span className="match-comparison-table__pens">{actualPenaltyLabel}</span>
      ) : null}
    </div>
  ) : null

  return { leftCell, badgeCell, rightCell }
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
  const winnerSide = matchWinnerSide(match)
  const pensLabel = penaltyWinnerLabel(match, teamLabel)
  const scorersA = scorersForTeamSide(match.scorers, 'teamA', rawA, rawB)
  const scorersB = scorersForTeamSide(match.scorers, 'teamB', rawA, rawB)
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
          <span className="match-comparison-card__time">
            {match.status === 'finished' ? 'Finalizado' : formatMatchTime(match.scheduledAt)}
          </span>
        )}
      </div>
      <div className="match-comparison-card__teams">
        <div
          className={[
            'match-comparison-card__team',
            winnerSide === 'teamA' ? 'match-comparison-card__team--winner' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
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
        <div
          className={[
            'match-comparison-card__team',
            winnerSide === 'teamB' ? 'match-comparison-card__team--winner' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
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
      {pensLabel ? <p className="match-comparison-card__pens">{pensLabel}</p> : null}
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
  const actualRawA = match.goalsTeamA ?? match.goalsHome
  const actualRawB = match.goalsTeamB ?? match.goalsAway
  const actualScoreLabel =
    actualRawA != null && actualRawB != null ? `${actualRawA} - ${actualRawB}` : null
  const actualPenaltyLabel = penaltyWinnerLabel(match, teamLabel)

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
        let pointsBreakdown: RowPointsBreakdown | null = null
        if (isFinished && playersLoaded) {
          const matchDetails = scoreMatchPredictionDetails(match, score ?? null, predictedLineup)
          const bonusPts = bonusKey
            ? scorePlayerPerMatchPick(match, bonusKey, {
                playerKey: bonusKey,
                name: bonusPlayer?.name,
                theSportsDbPlayerId: bonusPlayer?.theSportsDbPlayerId,
              })
            : 0
          points = matchDetails.points + bonusPts
          pointsBreakdown = buildPointsBreakdown({
            match,
            details: matchDetails,
            bonusName,
            bonusPoints: bonusPts,
            predictedLineup,
            teamAId,
            teamBId,
            teamLabel,
          })
        }
        return {
          userId: member.userId,
          displayName: member.displayName || 'Jugador',
          score,
          bonusName,
          predictedLineup,
          points,
          pointsBreakdown,
        }
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'))
  }, [members, byUserId, playerByKey, playersLoaded, isFinished, isKnockout, match, predictions, teamAId, teamBId, teamLabel])

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
            {isKnockout ? <th scope="col">Predicción</th> : <th scope="col">Predicción</th>}
            {isKnockout ? <th scope="col" className="match-comparison-table__th--center" /> : null}
            {isKnockout ? <th scope="col">Partido real</th> : null}
            <th scope="col">Jugador bonus</th>
            {isFinished ? (
              <th scope="col">
                <span className="match-comparison-table__points-head">
                  Puntos
                  <span
                    className="match-comparison-table__info"
                    tabIndex={0}
                    role="button"
                    aria-label="Cómo se calculan estos puntos"
                  >
                    !
                    <span className="match-comparison-table__info-pop" role="tooltip">
                      Puntos del partido seleccionado: marcador, goles por equipo, ganador o
                      parciales en eliminatorias, y jugador bonus si anotó.
                    </span>
                  </span>
                </span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const ko = isKnockout
              ? ProjectedKoRow({
                  lineup: row.predictedLineup,
                  score: row.score ?? undefined,
	                  actualTeamAId: teamAId,
	                  actualTeamBId: teamBId,
	                  actualScoreLabel,
	                  actualPenaltyLabel,
	                  teamLabel,
	                })
              : null
            return (
              <tr key={row.userId}>
                <td data-label="Usuario">
                  <div className="match-comparison-table__user">
                    <span className="match-comparison-table__avatar" aria-hidden>
                      {initialsFromName(row.displayName)}
                    </span>
                    <span className="match-comparison-table__name">{row.displayName}</span>
                  </div>
                </td>
                <td data-label="Predicción">
                  {isKnockout ? (
                    ko?.leftCell ?? <span className="match-comparison-table__empty">Sin predicción</span>
                  ) : row.score ? (
                    <span className="match-comparison-table__score">
                      {row.score.goalsTeamA} - {row.score.goalsTeamB}
                    </span>
                  ) : (
                    <span className="match-comparison-table__empty">Sin predicción</span>
                  )}
                </td>
                {isKnockout ? (
                  <td className="match-comparison-table__td--center" data-label="Cruce">
                    {ko?.badgeCell}
                  </td>
                ) : null}
                {isKnockout ? (
                  <td data-label="Partido real">{ko?.rightCell}</td>
                ) : null}
                <td data-label="Jugador bonus">
                  {row.bonusName ? (
                    <span className="match-comparison-table__bonus">{row.bonusName}</span>
                  ) : (
                    <span className="match-comparison-table__empty">Sin elegir</span>
                  )}
                </td>
                {isFinished ? (
                  <td data-label="Puntos">
                    {row.points == null ? (
                      <span className="match-comparison-table__points match-comparison-table__points--pending">
                        …
                      </span>
                    ) : (
                      <span className="match-comparison-table__points-cell">
                        <span className="match-comparison-table__points">
                          {row.points > 0 ? `+${row.points}` : row.points}
                        </span>
                        {row.pointsBreakdown ? (
                          <span
                            className="match-comparison-table__info match-comparison-table__info--row"
                            tabIndex={0}
                            role="button"
                            aria-label={`Desglose de puntos: ${row.pointsBreakdown.ariaLabel}`}
                          >
                            !
                            <span
                              className="match-comparison-table__info-pop match-comparison-table__info-pop--breakdown"
                              role="tooltip"
                            >
                              <span className="match-comparison-table__breakdown-list">
                                {row.pointsBreakdown.items.map((item) => (
                                  <span className="match-comparison-table__breakdown-row" key={item.label}>
                                    <span>{item.label}</span>
                                    <strong>{signedPoints(item.points)}</strong>
                                  </span>
                                ))}
                                <span className="match-comparison-table__breakdown-row match-comparison-table__breakdown-row--total">
                                  <span>Total</span>
                                  <strong>{signedPoints(row.pointsBreakdown.total)}</strong>
                                </span>
                              </span>
                            </span>
                          </span>
                        ) : null}
                      </span>
                    )}
                  </td>
                ) : null}
              </tr>
            )
          })}
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
