/**
 * Próximos partidos KO + jugador por partido: datos reales cuando existan;
 * dos columnas si hay dos partidos knockout el mismo día (zona del torneo).
 */

import { useId, useMemo, type ReactNode } from 'react'
import { useMatchList } from '../hooks/useMatchList'
import { useTeamLabels } from '../hooks/useTeamLabels'
import type { MatchDoc } from '../types/predictions'
import { DEFAULT_RULESET, getGeneralPredictionsLockAt, toDate } from '../config/ruleset'

type BannerVariant = 'private' | 'global'

function calendarDayKey(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/** Primer día con KO próximo; si ese día tiene ≥2 partidos, devuelve los dos primeros (dual). */
function pickKnockoutBannerMatches(
  matches: (MatchDoc & { id: string })[],
  nowMs: number,
): { mode: 'mock'; items: [] } | { mode: 'single' | 'dual'; items: (MatchDoc & { id: string })[] } {
  const tz = DEFAULT_RULESET.timezone
  type Row = { m: MatchDoc & { id: string }; t: number }
  const upcoming: Row[] = []
  for (const m of matches) {
    if (m.phase !== 'knockout') continue
    const td = toDate(m.scheduledAt)?.getTime()
    if (td === undefined || !Number.isFinite(td)) continue
    if (td < nowMs) continue
    upcoming.push({ m, t: td })
  }
  upcoming.sort((a, b) => a.t - b.t)
  if (upcoming.length === 0) return { mode: 'mock', items: [] }

  const firstDay = calendarDayKey(new Date(upcoming[0].t), tz)
  const sameDay = upcoming.filter((r) => calendarDayKey(new Date(r.t), tz) === firstDay)
  const picked = sameDay.slice(0, 2).map((r) => r.m)
  if (picked.length >= 2) return { mode: 'dual', items: picked }
  return { mode: 'single', items: picked }
}

function FlagIconPlaceholder() {
  return (
    <svg
      className="room-home-player-banner__flag-svg"
      width="28"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M5 3v17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M5 4h11l-1.5 3L17 10H5V4z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ScoreBoxes({ home, away }: { home?: number | null; away?: number | null }) {
  const h =
    home !== null && home !== undefined && typeof home === 'number' && !Number.isNaN(home)
      ? String(home)
      : '—'
  const a =
    away !== null && away !== undefined && typeof away === 'number' && !Number.isNaN(away)
      ? String(away)
      : '—'
  return (
    <div className="room-home-player-banner__score-row" aria-label="Marcador del partido">
      <span className="room-home-player-banner__score-box">{h}</span>
      <span className="room-home-player-banner__score-sep" aria-hidden>
        :
      </span>
      <span className="room-home-player-banner__score-box">{a}</span>
    </div>
  )
}

function fmtKickoff(scheduledAt: unknown): string | null {
  const d = toDate(scheduledAt)
  if (!d) return null
  return d.toLocaleString('es-CO', {
    timeZone: DEFAULT_RULESET.timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function lockMinutesPhrase(minutes: number): string {
  if (minutes === 60) return 'una hora antes del pitazo'
  if (minutes > 60 && minutes % 60 === 0) return `${minutes / 60} horas antes del pitazo`
  return `${minutes} minutos antes del pitazo`
}

function NextMatchesHelp({
  variant,
  dualSameDay,
}: {
  variant: BannerVariant
  dualSameDay: boolean
}) {
  const tooltipId = useId()
  const isPrivate = variant === 'private'
  const koMin = DEFAULT_RULESET.lockWindows.knockoutPickMinutesBeforeKickoff
  const lockKickPhrase = lockMinutesPhrase(koMin)

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

  const featurePending = !DEFAULT_RULESET.features.playerPerMatchEnabled

  return (
    <div className="room-home-player-banner__help-wrap">
      <button
        type="button"
        className="room-home-player-banner__help-btn room-home-player-banner__help-btn--text"
        aria-label="¿Qué es? Información sobre próximos partidos y jugador por partido"
        aria-describedby={tooltipId}
      >
        ¿Qué es?
      </button>
      <div id={tooltipId} role="tooltip" className="room-home-player-banner__tooltip">
        <p className="room-home-player-banner__tooltip-lead">
          <strong>¿Qué es?</strong> Es el espacio donde ves el enfrentamiento de eliminatorias en foco (equipos,
          banderas y marcador) y donde vas a elegir el <strong>jugador por partido</strong> para sumar puntos extra,
          cuando la función esté conectada a datos oficiales.
        </p>
        {dualSameDay ? (
          <p className="room-home-player-banner__tooltip-p">
            Si hay <strong>dos partidos el mismo día</strong> (calendario de la zona horaria del torneo), la vista se
            reparte en <strong>dos columnas</strong>: un encuentro a la izquierda y otro a la derecha, cada uno con su
            propio jugador.
          </p>
        ) : null}
        {isPrivate ? (
          <p className="room-home-player-banner__tooltip-p">
            En salas privadas este bloque se muestra arriba de tu sala para ubicarte rápido en el próximo cruce KO.
          </p>
        ) : (
          <p className="room-home-player-banner__tooltip-p">
            En la sala global aplicás la misma lógica de vista y de jugador por partido.
          </p>
        )}
        <p className="room-home-player-banner__tooltip-p">
          <strong>Reglas y puntajes:</strong> valen <strong>2 puntos por gol</strong> del jugador elegido en tiempo
          reglamentario <strong>(90 minutos más prórroga)</strong>. No cuentan goles en tanda de penales.
        </p>
        <p className="room-home-player-banner__tooltip-p">
          <strong>Cuándo se habilita y cierra (automático):</strong> el sistema será automático según la hora oficial
          del partido: el <strong>día del encuentro</strong> podrás editar el jugador elegido para ese encuentro, y{' '}
          <strong>{lockKickPhrase}</strong> la edición <strong>quedará bloqueada</strong> para que no puedas seguir
          cambiando la elección. Los tiempos se calculan con la zona <strong>{DEFAULT_RULESET.timezone}</strong> y los
          valores del reglamento activo.
        </p>
        {featurePending ? (
          <p className="room-home-player-banner__tooltip-p">
            Hoy la opción sigue en preparación hasta tener plantillas y datos confiables; cuando esté activa en la app,
            respetará el mismo comportamiento automático anterior.
          </p>
        ) : null}
        <p className="room-home-player-banner__tooltip-p room-home-player-banner__tooltip-p--muted">
          <strong>Predicciones generales (resto del formulario):</strong> podés editar hasta el{' '}
          <time dateTime={lockIso}>{lockLabel}</time>, es decir <strong>dos semanas antes del inicio del torneo</strong>{' '}
          ({kickoffLabel}), salvo que ya hayas finalizado tu predicción según las reglas de la sala.
        </p>
      </div>
    </div>
  )
}

function PrivateMatchColumn({
  variantLabel,
  match,
  teamLabel,
  mock,
  selectSuffix,
}: {
  variantLabel: string
  match?: MatchDoc & { id: string }
  teamLabel: (id: string) => string
  mock: boolean
  selectSuffix: string
}) {
  const homeName = mock ? 'Ej.: Equipo local' : teamLabel(match!.teamHomeId)
  const awayName = mock ? 'Ej.: Equipo visitante' : teamLabel(match!.teamAwayId)
  const homeGoals = mock ? null : match!.goalsHome
  const awayGoals = mock ? null : match!.goalsAway
  const kick = match ? fmtKickoff(match.scheduledAt) : null

  return (
    <div className="room-home-player-banner__column-card">
      <p className="room-home-player-banner__column-tag">{variantLabel}</p>
      {kick ? <p className="room-home-player-banner__column-kickoff">{kick}</p> : null}
      <div className="room-home-player-banner__match room-home-player-banner__match--in-column">
        <div className="room-home-player-banner__tile room-home-player-banner__tile--team room-home-player-banner__tile--left">
          <div className="room-home-player-banner__team-row">
            <span className="room-home-player-banner__flag" title="Bandera (cuando haya datos en BD)">
              <FlagIconPlaceholder />
            </span>
            <div className="room-home-player-banner__team-text">
              <span className="room-home-player-banner__tile-label">Local</span>
              <span className="room-home-player-banner__team-name">{homeName}</span>
            </div>
          </div>
        </div>
        <div className="room-home-player-banner__vs-column">
          <div className="room-home-player-banner__vs" aria-hidden>
            VS
          </div>
          <ScoreBoxes home={homeGoals} away={awayGoals} />
        </div>
        <div className="room-home-player-banner__tile room-home-player-banner__tile--team room-home-player-banner__tile--right">
          <div className="room-home-player-banner__team-row">
            <div className="room-home-player-banner__team-text room-home-player-banner__team-text--end">
              <span className="room-home-player-banner__tile-label">Visitante</span>
              <span className="room-home-player-banner__team-name">{awayName}</span>
            </div>
            <span className="room-home-player-banner__flag" title="Bandera (cuando haya datos en BD)">
              <FlagIconPlaceholder />
            </span>
          </div>
        </div>
      </div>
      <div className="room-home-player-banner__player-block room-home-player-banner__player-block--compact">
        <label className="room-home-player-banner__player-label" htmlFor={`room-home-player-select-${selectSuffix}`}>
          Jugador este partido
        </label>
        <select
          id={`room-home-player-select-${selectSuffix}`}
          className="room-home-player-banner__select"
          disabled
          defaultValue=""
        >
          <option value="">Escoger jugador…</option>
        </select>
      </div>
    </div>
  )
}

function GlobalMatchColumn({
  match,
  teamLabel,
  mock,
  selectSuffix,
}: {
  match?: MatchDoc & { id: string }
  teamLabel: (id: string) => string
  mock: boolean
  selectSuffix: string
}) {
  const homeName = mock ? 'Ej.: Colombia' : teamLabel(match!.teamHomeId)
  const awayName = mock ? 'Ej.: Brasil' : teamLabel(match!.teamAwayId)
  const homeGoals = mock ? null : match!.goalsHome
  const awayGoals = mock ? null : match!.goalsAway
  const kick = match ? fmtKickoff(match.scheduledAt) : null

  return (
    <div className="room-home-player-banner__column-card">
      <p className="room-home-player-banner__column-tag">Partido KO</p>
      {kick ? <p className="room-home-player-banner__column-kickoff">{kick}</p> : null}
      <div className="room-home-player-banner__match room-home-player-banner__match--in-column">
        <div className="room-home-player-banner__tile room-home-player-banner__tile--team room-home-player-banner__tile--left">
          <div className="room-home-player-banner__team-row">
            <span className="room-home-player-banner__flag" title="Bandera (cuando haya datos en BD)">
              <FlagIconPlaceholder />
            </span>
            <div className="room-home-player-banner__team-text">
              <span className="room-home-player-banner__tile-label">Local</span>
              <span className="room-home-player-banner__team-name">{homeName}</span>
            </div>
          </div>
        </div>
        <div className="room-home-player-banner__vs-column">
          <div className="room-home-player-banner__vs" aria-hidden>
            VS
          </div>
          <ScoreBoxes home={homeGoals} away={awayGoals} />
        </div>
        <div className="room-home-player-banner__tile room-home-player-banner__tile--team room-home-player-banner__tile--right">
          <div className="room-home-player-banner__team-row">
            <div className="room-home-player-banner__team-text room-home-player-banner__team-text--end">
              <span className="room-home-player-banner__tile-label">Visitante</span>
              <span className="room-home-player-banner__team-name">{awayName}</span>
            </div>
            <span className="room-home-player-banner__flag" title="Bandera (cuando haya datos en BD)">
              <FlagIconPlaceholder />
            </span>
          </div>
        </div>
      </div>
      <div className="room-home-player-banner__player-block room-home-player-banner__player-block--compact">
        <label className="room-home-player-banner__player-label" htmlFor={`room-home-player-global-${selectSuffix}`}>
          Jugador este partido
        </label>
        <select
          id={`room-home-player-global-${selectSuffix}`}
          className="room-home-player-banner__select"
          disabled
          defaultValue=""
        >
          <option value="">Escoger jugador…</option>
        </select>
      </div>
    </div>
  )
}

export function RoomHomePlayerPickBanner({
  variant,
  titleTrailing,
}: {
  variant: BannerVariant
  titleTrailing?: ReactNode
}) {
  const isPrivate = variant === 'private'
  const { matches } = useMatchList()
  const { label: teamLabel } = useTeamLabels()

  const bundle = useMemo(() => pickKnockoutBannerMatches(matches, Date.now()), [matches])
  const dualSameDay = bundle.mode === 'dual'
  const koLockKickPhrase = lockMinutesPhrase(DEFAULT_RULESET.lockWindows.knockoutPickMinutesBeforeKickoff)

  const description = useMemo(() => {
    if (dualSameDay) {
      return isPrivate
        ? 'Hay dos eliminatorias programadas el mismo día: cada columna es un partido y más abajo su jugador por elegir cuando la opción esté activa.'
        : 'Dos encuentros KO el mismo día: dos columnas paralelas (uno en cada lado) con jugador por partido cuando corresponda.'
    }
    return isPrivate
      ? 'Aquí verás el próximo encuentro en foco y podrás elegir el jugador por partido en eliminatorias cuando la opción esté activa y haya datos oficiales. Banderas y marcador sirven de guía hasta enlazar equipos y resultados en vivo.'
      : 'Este bloque resume el próximo partido KO de la sala global; mismo uso para jugador por partido cuando esté disponible, con banderas y marcador como guía hasta tener datos en vivo.'
  }, [dualSameDay, isPrivate])

  const mock = bundle.mode === 'mock'

  return (
    <section
      className={[
        'room-home-player-banner',
        isPrivate ? 'room-home-player-banner--private' : 'room-home-player-banner--global',
        dualSameDay ? 'room-home-player-banner--dual' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label="Próximos partidos y jugador por partido"
    >
      <div className="room-home-player-banner__title-row">
        <div className="room-home-player-banner__title-cluster">
          <h2 className="room-home-player-banner__title">Próximos partidos</h2>
          <NextMatchesHelp variant={variant} dualSameDay={dualSameDay} />
        </div>
        {titleTrailing ? (
          <div className="room-home-player-banner__title-actions">{titleTrailing}</div>
        ) : null}
      </div>
      <p className="room-home-player-banner__description">{description}</p>

      {isPrivate ? (
        <>
          {bundle.mode === 'dual' ? (
            <div className="room-home-player-banner__matches-grid room-home-player-banner__matches-grid--dual">
              {bundle.items.map((m, i) => (
                <PrivateMatchColumn
                  key={m.id}
                  variantLabel={i === 0 ? 'Partido 1' : 'Partido 2'}
                  match={m}
                  teamLabel={teamLabel}
                  mock={false}
                  selectSuffix={m.id}
                />
              ))}
            </div>
          ) : (
            <div className="room-home-player-banner__matches-grid">
              <PrivateMatchColumn
                variantLabel={bundle.mode === 'single' ? 'Siguiente KO' : 'Ejemplo'}
                match={bundle.mode === 'single' ? bundle.items[0] : undefined}
                teamLabel={teamLabel}
                mock={mock}
                selectSuffix={bundle.mode === 'single' ? bundle.items[0].id : 'demo'}
              />
            </div>
          )}
          <p className="room-home-player-banner__player-hint room-home-player-banner__player-hint--below-grid">
            Se habilitará cuando existan plantillas oficiales y la función en la app esté activa. La ventana de edición
            será automática: el día del partido podrás elegir el jugador y{' '}
            <strong>{koLockKickPhrase}</strong> el cambio quedará bloqueado (según reglamento y zona horaria).
          </p>
        </>
      ) : bundle.mode === 'dual' ? (
        <>
          <div className="room-home-player-banner__matches-grid room-home-player-banner__matches-grid--dual">
            {bundle.items.map((m) => (
              <GlobalMatchColumn key={m.id} match={m} teamLabel={teamLabel} mock={false} selectSuffix={m.id} />
            ))}
          </div>
          <p className="room-home-player-banner__player-hint room-home-player-banner__player-hint--below-grid">
            Se habilitará cuando existan plantillas oficiales y la función en la app esté activa. La ventana de edición
            será automática: el día del partido podrás elegir el jugador y{' '}
            <strong>{koLockKickPhrase}</strong> el cambio quedará bloqueado (según reglamento y zona horaria).
          </p>
        </>
      ) : (
        <>
          <div className="room-home-player-banner__matches-grid">
            <GlobalMatchColumn
              match={bundle.mode === 'single' ? bundle.items[0] : undefined}
              teamLabel={teamLabel}
              mock={mock}
              selectSuffix={bundle.mode === 'single' ? bundle.items[0].id : 'demo-global'}
            />
          </div>
          <p className="room-home-player-banner__player-hint room-home-player-banner__player-hint--below-grid">
            Se habilitará cuando existan plantillas oficiales y la función en la app esté activa. La ventana de edición
            será automática: el día del partido podrás elegir el jugador y{' '}
            <strong>{koLockKickPhrase}</strong> el cambio quedará bloqueado (según reglamento y zona horaria).
          </p>
        </>
      )}
    </section>
  )
}
