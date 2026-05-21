/**
 * Jugador por partido: partidos en juego + predicción en ventana (24 h antes → 1 h antes del pitazo).
 */

import { useId, useMemo, type ReactNode } from 'react'
import { useMatchList } from '../hooks/useMatchList'
import { usePlayerPerMatchPicks } from '../hooks/usePlayerPerMatchPicks'
import { useTeamLabels } from '../hooks/useTeamLabels'
import {
  DEFAULT_RULESET,
  getGeneralPredictionsLockAt,
  getPlayerPerMatchOpensAt,
} from '../config/ruleset'
import { useMatchTimeFormatters } from '../hooks/useUserTimeZone'
import { formatTimeZoneShort } from '../utils/formatMatchTime'
import { classifyPlayerPickMatches } from '../utils/playerPerMatchWindows'
import { PlayerPickFixtureCard } from './PlayerPickFixtureCard'

type BannerVariant = 'private' | 'global'

function lockMinutesPhrase(minutes: number): string {
  if (minutes === 60) return 'una hora antes del pitazo'
  if (minutes > 60 && minutes % 60 === 0) return `${minutes / 60} horas antes del pitazo`
  return `${minutes} minutos antes del pitazo`
}

function NextMatchesHelp({ variant }: { variant: BannerVariant }) {
  const tooltipId = useId()
  const isPrivate = variant === 'private'
  const openH = DEFAULT_RULESET.lockWindows.playerPerMatchOpensHoursBeforeKickoff
  const lockMin = DEFAULT_RULESET.lockWindows.knockoutPickMinutesBeforeKickoff
  const lockKickPhrase = lockMinutesPhrase(lockMin)
  const pts = DEFAULT_RULESET.points.playerPerMatch.goalsPerGoal

  const { lockLabel, lockIso, kickoffLabel } = useMemo(() => {
    const tz = DEFAULT_RULESET.timezone
    const lockAt = getGeneralPredictionsLockAt(DEFAULT_RULESET)
    const kickoff = new Date(DEFAULT_RULESET.tournamentStartsAtIso)
    const dtOpts: Intl.DateTimeFormatOptions = {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: tz,
    }
    return {
      lockLabel: lockAt.toLocaleString('es-CO', dtOpts),
      lockIso: lockAt.toISOString(),
      kickoffLabel: kickoff.toLocaleString('es-CO', dtOpts),
    }
  }, [])

  return (
    <div className="room-home-player-banner__help-wrap">
      <button
        type="button"
        className="room-home-player-banner__help-btn room-home-player-banner__help-btn--text"
        aria-label="¿Qué es? Información sobre jugador por partido"
        aria-describedby={tooltipId}
      >
        ¿Qué es?
      </button>
      <div id={tooltipId} role="tooltip" className="room-home-player-banner__tooltip">
        <p className="room-home-player-banner__tooltip-lead">
          <strong>Jugador por partido:</strong> desde <strong>{openH} horas antes</strong> del pitazo podés elegir un
          jugador de cualquiera de los dos equipos. Sumás <strong>{pts} pts por cada gol</strong> en 90&apos; + prórroga
          (no penales). El cambio se guarda al seleccionar y se bloquea <strong>{lockKickPhrase}</strong>.
        </p>
        {isPrivate ? (
          <p className="room-home-player-banner__tooltip-p">
            En salas privadas ves los partidos en juego y los que están en ventana de predicción.
          </p>
        ) : (
          <p className="room-home-player-banner__tooltip-p">
            En la sala global aplica la misma ventana y puntuación por goles del jugador elegido.
          </p>
        )}
        <p className="room-home-player-banner__tooltip-p room-home-player-banner__tooltip-p--muted">
          <strong>Predicciones generales:</strong> edición hasta el{' '}
          <time dateTime={lockIso}>{lockLabel}</time> ({kickoffLabel}).
        </p>
      </div>
    </div>
  )
}

export function RoomHomePlayerPickBanner({
  variant,
  roomId,
  userId,
  titleTrailing,
}: {
  variant: BannerVariant
  roomId: string | undefined
  userId: string | undefined
  titleTrailing?: ReactNode
}) {
  const isPrivate = variant === 'private'
  const { matches } = useMatchList()
  const { label: teamLabel } = useTeamLabels()
  const { picksByMatchId } = usePlayerPerMatchPicks(roomId, userId)
  const { timeZone, formatMatchTime } = useMatchTimeFormatters()

  const nowMs = Date.now()
  const classified = useMemo(
    () => classifyPlayerPickMatches(matches, nowMs),
    [matches, nowMs],
  )

  const lockPhrase = lockMinutesPhrase(DEFAULT_RULESET.lockWindows.knockoutPickMinutesBeforeKickoff)
  const lockMin = DEFAULT_RULESET.lockWindows.knockoutPickMinutesBeforeKickoff
  const openH = DEFAULT_RULESET.lockWindows.playerPerMatchOpensHoursBeforeKickoff
  const ptsPerGoal = DEFAULT_RULESET.points.playerPerMatch.goalsPerGoal
  const canSave = Boolean(roomId && userId)
  const hasLive = classified.live.length > 0
  const predictCards = [...classified.prediction, ...classified.preview]
  const hasPredictBlock = predictCards.length > 0

  const previewMatch = classified.preview[0]
  const previewOpensAt = previewMatch
    ? getPlayerPerMatchOpensAt(previewMatch.scheduledAt)
    : null

  const description =
    classified.prediction.length > 0 || classified.live.length > 0
      ? `Elegí el jugador que anotará en cada partido (ventana desde ${openH} h antes del pitazo; cierre ${lockPhrase}). Se guarda al seleccionar.`
      : previewMatch
        ? `Próximo partido: ${formatMatchTime(previewMatch.scheduledAt)}. Podrás elegir jugador${
            previewOpensAt
              ? ` a partir del ${formatMatchTime(previewOpensAt)} (${openH} h antes del pitazo)`
              : ` (${openH} h antes del pitazo)`
          }.`
        : classified.nextOpensAt
          ? `La próxima ventana de jugador por partido abre el ${formatMatchTime(classified.nextOpensAt)}.`
          : 'Cuando se acerquen partidos del calendario, aparecerán aquí para elegir jugador goleador.'

  return (
    <section
      className={[
        'room-home-player-banner',
        isPrivate ? 'room-home-player-banner--private' : 'room-home-player-banner--global',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label="Próximos partidos y jugador por partido"
    >
      <div className="room-home-player-banner__title-row">
        <div className="room-home-player-banner__title-cluster">
          <h2 className="room-home-player-banner__title">Próximos partidos</h2>
          <NextMatchesHelp variant={variant} />
        </div>
        {titleTrailing ? (
          <div className="room-home-player-banner__title-actions">{titleTrailing}</div>
        ) : null}
      </div>
      <p className="room-home-player-banner__description">{description}</p>

      {!canSave ? (
        <p className="room-home-player-banner__player-hint">Iniciá sesión para guardar tu jugador por partido.</p>
      ) : null}

      {hasLive ? (
        <div className="room-home-player-banner__block room-home-player-banner__block--live">
          <h3 className="room-home-player-banner__block-title">Partidos disputándose</h3>
          <div className="player-pick-fixture-grid player-pick-fixture-grid--live">
            {classified.live.map((m) => (
              <PlayerPickFixtureCard
                key={m.id}
                match={m}
                teamLabel={teamLabel}
                mode="live"
                savedPlayerKey={picksByMatchId[m.id]}
                roomId={roomId!}
                userId={userId!}
                timeZone={timeZone}
              />
            ))}
          </div>
        </div>
      ) : null}

      {hasPredictBlock ? (
        <div className="room-home-player-banner__block room-home-player-banner__block--predict">
          <h3 className="room-home-player-banner__hero-title">Predicción partido a disputar</h3>
          <p className="room-home-player-banner__hero-lead">
            Escogé un jugador por partido: sumás <strong>{ptsPerGoal} pts</strong> por cada gol en 90&apos; + prórroga
            (no penales). La predicción se bloquea{' '}
            <strong>{lockMin === 60 ? '1 hora' : `${lockMin} min`}</strong> antes del pitazo; podés elegir desde{' '}
            <strong>{openH} h antes</strong>.
          </p>
          <div className="player-pick-fixture-grid player-pick-fixture-grid--predict">
            {predictCards.map((m) => (
              <PlayerPickFixtureCard
                key={m.id}
                match={m}
                teamLabel={teamLabel}
                mode="pick"
                savedPlayerKey={picksByMatchId[m.id]}
                roomId={roomId!}
                userId={userId!}
                timeZone={timeZone}
              />
            ))}
          </div>
        </div>
      ) : null}

      {classified.live.length > 0 || classified.prediction.length > 0 ? (
        <p className="room-home-player-banner__player-hint room-home-player-banner__player-hint--below-grid">
          Cierre automático de edición: <strong>{lockPhrase}</strong> (horario en tu zona:{' '}
          {formatTimeZoneShort(timeZone)}).
        </p>
      ) : classified.preview.length > 0 ? (
        <p className="room-home-player-banner__player-hint room-home-player-banner__player-hint--below-grid">
          La selección se habilita <strong>{openH} horas antes</strong> del pitazo (estado Bloqueado hasta entonces).
        </p>
      ) : (
        <p className="room-home-player-banner__player-hint room-home-player-banner__player-hint--below-grid">
          {classified.nextOpensAt
            ? `Podrás elegir jugador a partir del ${formatMatchTime(classified.nextOpensAt)} (${openH} h antes de cada partido).`
            : 'No hay partidos en ventana ni en juego en este momento.'}
        </p>
      )}
    </section>
  )
}
