import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_RULESET, getPlayerPerMatchOpensAt, type KnockoutRoundId } from '../config/ruleset'
import { useMatchPlayerOptions } from '../hooks/useMatchPlayerOptions'
import { savePlayerPerMatchPrediction } from '../services/predictionsService'
import type { MatchDoc } from '../types/predictions'
import { formatMatchHour, formatMatchTime, formatTimeZoneShort } from '../utils/formatMatchTime'
import { getPlayerPickCardState, type PlayerPickCardState } from '../utils/playerPerMatchWindows'
import { TeamFlagName } from './TeamFlagName'

type SaveUiState = 'idle' | 'saving' | 'saved' | 'error'

function playerGoalsPerGoal(match: Pick<MatchDoc, 'phase' | 'round'>): number {
  if (match.phase === 'group') return DEFAULT_RULESET.points.playerPerMatch.goalsPerGoalByRound.group
  const round = (match.round ?? 'r32') as KnockoutRoundId
  return DEFAULT_RULESET.points.playerPerMatch.goalsPerGoalByRound[round] ?? 2
}

function phaseLabel(match: MatchDoc): string {
  if (match.phase === 'group' && match.groupId) return `Grupo ${match.groupId}`
  if (match.round) return match.round.toUpperCase()
  return match.phase === 'knockout' ? 'Eliminatorias' : 'Partido'
}

function statusBadge(
  mode: 'pick' | 'live',
  cardState: PlayerPickCardState,
  saveUi: SaveUiState,
  hasPick: boolean,
): { label: string; variant: 'emerald' | 'slate' | 'amber' | 'live' } {
  if (mode === 'live') return { label: 'En juego', variant: 'live' }
  if (saveUi === 'saving') return { label: 'Guardando…', variant: 'amber' }
  if (saveUi === 'error') return { label: 'Error', variant: 'amber' }
  if (cardState === 'blocked') return { label: 'Bloqueado', variant: 'slate' }
  if (hasPick || saveUi === 'saved') return { label: 'Guardado', variant: 'emerald' }
  if (cardState === 'enabled') return { label: 'Habilitado', variant: 'emerald' }
  return { label: 'Bloqueado', variant: 'slate' }
}

export function PlayerPickFixtureCard({
  match,
  teamLabel,
  mode,
  savedPlayerKey,
  roomId,
  userId,
  timeZone,
}: {
  match: MatchDoc & { id: string }
  teamLabel: (id: string) => string
  mode: 'pick' | 'live'
  savedPlayerKey: string | undefined
  roomId: string
  userId: string
  timeZone: string
}) {
  const { options, loading: rosterLoading, hasRoster } = useMatchPlayerOptions(match)
  const [localKey, setLocalKey] = useState(savedPlayerKey ?? '')
  const [saveUi, setSaveUi] = useState<SaveUiState>('idle')
  const saveGen = useRef(0)

  useEffect(() => {
    setLocalKey(savedPlayerKey ?? '')
    if (savedPlayerKey) setSaveUi('saved')
  }, [savedPlayerKey, match.id])

  const timeState =
    mode === 'pick' ? getPlayerPickCardState(match, Date.now(), hasRoster && !rosterLoading) : 'blocked'
  const effectiveState: PlayerPickCardState =
    mode === 'pick' && (!hasRoster || rosterLoading) ? 'blocked' : timeState

  const canEdit = mode === 'pick' && effectiveState === 'enabled' && Boolean(roomId && userId)

  const teamAId = match.teamAId ?? match.teamHomeId
  const teamBId = match.teamBId ?? match.teamAwayId
  const teamAOptions = options.filter((o) => o.side === 'teamA')
  const teamBOptions = options.filter((o) => o.side === 'teamB')
  const allOptions = useMemo(() => [...teamAOptions, ...teamBOptions], [teamAOptions, teamBOptions])

  const handleChange = useCallback(
    async (nextKey: string) => {
      setLocalKey(nextKey)
      if (!nextKey || !canEdit) return
      const gen = ++saveGen.current
      setSaveUi('saving')
      try {
        await savePlayerPerMatchPrediction(roomId, userId, match.id, nextKey, match.scheduledAt)
        if (gen === saveGen.current) setSaveUi('saved')
      } catch {
        if (gen === saveGen.current) setSaveUi('error')
      }
    },
    [canEdit, match.id, roomId, userId],
  )

  const badge = statusBadge(mode, effectiveState, saveUi, Boolean(localKey))
  const kickHour = formatMatchHour(match.scheduledAt, timeZone)
  const tzShort = formatTimeZoneShort(timeZone)
  const opensAt = getPlayerPerMatchOpensAt(match.scheduledAt)
  const opensLabel = opensAt ? formatMatchTime(opensAt, timeZone) : null
  const showOpensHint = mode === 'pick' && effectiveState === 'blocked' && opensLabel
  const ptsPerGoal = playerGoalsPerGoal(match)
  const pickedName = allOptions.find((o) => o.playerKey === localKey)?.name

  const h =
    match.goalsHome !== null && match.goalsHome !== undefined ? String(match.goalsHome) : '—'
  const a =
    match.goalsAway !== null && match.goalsAway !== undefined ? String(match.goalsAway) : '—'

  const cardClass = [
    'player-pick-fixture-card',
    mode === 'live' ? 'player-pick-fixture-card--live' : 'player-pick-fixture-card--pick',
  ].join(' ')

  return (
    <article className={cardClass}>
      {mode === 'live' ? (
        <>
          <header className="player-pick-fixture-card__time-block">
            <p className="player-pick-fixture-card__phase">{phaseLabel(match)}</p>
            <p className="player-pick-fixture-card__time-live">{kickHour || '—'}</p>
            <span
              className={`player-pick-fixture-card__status player-pick-fixture-card__status--${badge.variant}`}
            >
              {badge.label}
            </span>
          </header>

          <div className="player-pick-fixture-card__matchup">
            <div className="player-pick-fixture-card__side">
              <span className="player-pick-fixture-card__score">{h}</span>
              <TeamFlagName teamId={teamAId} name={teamLabel(teamAId)} layout="stack" />
            </div>
            <span className="player-pick-fixture-card__vs">vs</span>
            <div className="player-pick-fixture-card__side">
              <span className="player-pick-fixture-card__score">{a}</span>
              <TeamFlagName teamId={teamBId} name={teamLabel(teamBId)} layout="stack" />
            </div>
          </div>

          <div className="player-pick-fixture-card__picked-display" aria-live="polite">
            {pickedName ?? 'Nombre de jugador escogido'}
          </div>
        </>
      ) : (
        <>
          <div className="player-pick-fixture-card__status-col player-pick-fixture-card__status-col--corner">
            <span
              className={`player-pick-fixture-card__status player-pick-fixture-card__status--${badge.variant}`}
            >
              {badge.label}
            </span>
            {showOpensHint ? (
              <p className="player-pick-fixture-card__opens-at">
                abre: <time dateTime={opensAt!.toISOString()}>{opensLabel}</time>
              </p>
            ) : null}
          </div>

          <header className="player-pick-fixture-card__time-block">
            <p className="player-pick-fixture-card__time-label">Hora del partido</p>
            <div className="player-pick-fixture-card__time-main">
              <p className="player-pick-fixture-card__time-value">{kickHour || '—'}</p>
              <p className="player-pick-fixture-card__tz-value">{tzShort}</p>
            </div>
          </header>

          <p className="player-pick-fixture-card__phase">{phaseLabel(match)}</p>

          <div className="player-pick-fixture-card__matchup player-pick-fixture-card__matchup--inline">
            <TeamFlagName teamId={teamAId} name={teamLabel(teamAId)} size={24} compact />
            <span className="player-pick-fixture-card__vs">vs</span>
            <TeamFlagName teamId={teamBId} name={teamLabel(teamBId)} size={24} compact />
          </div>

          <p className="player-pick-fixture-card__pts-hint">+{ptsPerGoal} pts por gol del jugador</p>

          <div className="player-pick-fixture-card__pick">
            {!hasRoster && !rosterLoading ? (
              <p className="player-pick-fixture-card__roster-hint">Plantilla pendiente en base de datos.</p>
            ) : (
              <select
                id={`player-pick-${match.id}`}
                className="player-pick-fixture-card__select"
                value={localKey}
                disabled={!canEdit || rosterLoading}
                aria-label={`Jugador que anota, ${teamLabel(teamAId)} vs ${teamLabel(teamBId)}`}
                onChange={(e) => void handleChange(e.target.value)}
              >
                <option value="">Nombre de jugador</option>
              {teamAOptions.length > 0 ? (
                <optgroup label={teamLabel(teamAId)}>
                  {teamAOptions.map((o) => (
                    <option key={o.playerKey} value={o.playerKey}>
                      {o.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {teamBOptions.length > 0 ? (
                <optgroup label={teamLabel(teamBId)}>
                  {teamBOptions.map((o) => (
                    <option key={o.playerKey} value={o.playerKey}>
                      {o.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              </select>
            )}
          </div>
        </>
      )}
    </article>
  )
}
