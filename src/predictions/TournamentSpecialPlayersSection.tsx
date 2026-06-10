import { useCallback, useEffect, useRef, useState } from 'react'
import { FirebaseError } from 'firebase/app'
import type { TournamentPredictionPayload } from '../types/predictions'
import { subscribeTeams, subscribeTeamPlayers, playerDocToKey } from '../services/teamsService'
import { saveTournamentPrediction } from '../services/predictionsService'
import { invalidatePredictionsCache } from '../hooks/usePredictions'
import { DEFAULT_RULESET, formatGeneralPredictionsLockLabel } from '../config/ruleset'
import { EXTRA_IDS } from '../data/questionIds'

type PlayerOpt = {
  playerKey: string
  name: string
  position?: string
  teamId: string
}

type SaveUiState = 'idle' | 'saving' | 'saved' | 'error'

function isGoalkeeper(position?: string): boolean {
  const s = position?.toLowerCase().trim() ?? ''
  return s.includes('goalkeeper') || s.includes('gk') || s.includes('portero') || s.includes('arquero') || s.includes('keeper')
}

function normalizeSaveError(err: unknown): string {
  if (err instanceof FirebaseError && err.code === 'permission-denied') {
    return 'No tenés permiso para guardar. Si ya finalizaste, puede que falte desplegar las reglas de Firestore.'
  }
  if (err instanceof Error && err.message) return err.message
  return 'No se pudo guardar la selección.'
}

function saveStatusBadge(
  saveUi: SaveUiState,
  hasSelection: boolean,
  editable: boolean,
): { label: string; variant: 'emerald' | 'slate' | 'amber' } | null {
  if (saveUi === 'saving') return { label: 'Guardando…', variant: 'amber' }
  if (saveUi === 'error') return { label: 'Error', variant: 'amber' }
  if (hasSelection && (saveUi === 'saved' || !editable)) {
    return { label: 'Guardado', variant: 'emerald' }
  }
  return null
}

function useTournamentPlayers(goalkeeperOnly: boolean) {
  const [players, setPlayers] = useState<PlayerOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const unsubs: Array<null | (() => void)> = []
    setLoading(true)
    setErr(null)
    setPlayers([])

    const unsubTeams = subscribeTeams(
      (list) => {
        const byKey = new Map<string, PlayerOpt>()
        const teamPlayersUnsubs: Array<null | (() => void)> = []

        let remaining = list.length
        const seenTeam = new Set<string>()
        if (remaining === 0) {
          setPlayers([])
          setLoading(false)
          return
        }

        for (const t of list) {
          const u = subscribeTeamPlayers(
            t.id,
            (pl) => {
              for (const p of pl) {
                const key = playerDocToKey(p)
                byKey.set(key, {
                  playerKey: key,
                  name: p.name,
                  position: p.position,
                  teamId: t.id,
                })
              }

              if (!seenTeam.has(t.id)) {
                seenTeam.add(t.id)
                remaining -= 1
              }

              if (remaining <= 0) {
                const all = Array.from(byKey.values())
                const filtered = goalkeeperOnly ? all.filter((x) => isGoalkeeper(x.position)) : all
                const final = goalkeeperOnly && filtered.length === 0 ? all : filtered
                setPlayers(final.sort((a, b) => a.name.localeCompare(b.name, 'es')))
                setLoading(false)
              }
            },
            (e) => {
              setErr(e.message)
              setLoading(false)
            },
          )
          teamPlayersUnsubs.push(u)
        }

        unsubs.push(...teamPlayersUnsubs)
      },
      (e) => {
        setErr(e.message)
        setLoading(false)
      },
    )

    return () => {
      try {
        unsubTeams?.()
      } catch {
        // ignore
      }
      for (const u of unsubs) {
        try {
          u?.()
        } catch {
          // ignore
        }
      }
    }
  }, [goalkeeperOnly])

  return { players, loading, err }
}

function SpecialPlayerRow({
  title,
  questionId,
  points,
  goalkeeperOnly,
  roomId,
  userId,
  saveUserId,
  disabled,
  currentPrediction,
  renderOptionTitle,
}: {
  title: string
  questionId: string
  points: number
  goalkeeperOnly: boolean
  roomId: string
  userId: string
  saveUserId?: string
  disabled: boolean
  currentPrediction: TournamentPredictionPayload | undefined
  renderOptionTitle?: (opt: PlayerOpt) => string
}) {
  const { players, loading, err } = useTournamentPlayers(goalkeeperOnly)
  const savedKey = currentPrediction?.kind === 'player' ? currentPrediction.playerId : ''
  const [localKey, setLocalKey] = useState(savedKey)
  const [saveUi, setSaveUi] = useState<SaveUiState>(savedKey ? 'saved' : 'idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const saveGen = useRef(0)
  const editable = !disabled

  useEffect(() => {
    setLocalKey(savedKey)
    if (savedKey) setSaveUi('saved')
    else if (!editable) setSaveUi('idle')
  }, [savedKey, editable])

  const handleChange = useCallback(
    async (next: string) => {
      setLocalKey(next)
      setSaveError(null)
      if (!next || disabled) {
        setSaveUi('idle')
        return
      }
      const writerId = saveUserId ?? userId
      const gen = ++saveGen.current
      setSaveUi('saving')
      try {
        await saveTournamentPrediction(roomId, writerId, questionId, { kind: 'player', playerId: next })
        invalidatePredictionsCache(roomId, userId)
        if (gen === saveGen.current) setSaveUi('saved')
      } catch (e) {
        if (gen === saveGen.current) {
          setSaveUi('error')
          setSaveError(normalizeSaveError(e))
        }
      }
    },
    [disabled, questionId, roomId, saveUserId, userId],
  )

  const badge = saveStatusBadge(saveUi, Boolean(localKey), editable)

  return (
    <div className="pred-special-player-row">
      <p className="app-muted pred-special-player-row__hint">
        {title} (+{points} pts)
      </p>

      {loading ? <p className="user-email">Cargando jugadores…</p> : null}
      {err ? <p className="auth-error">{err}</p> : null}

      <div className="pred-bonus-row pred-special-player-card" style={{ marginTop: 8 }}>
        {badge ? (
          <div className="player-pick-fixture-card__status-col player-pick-fixture-card__status-col--corner">
            <span
              className={`player-pick-fixture-card__status player-pick-fixture-card__status--${badge.variant}`}
            >
              {badge.label}
            </span>
          </div>
        ) : null}
        <label className="pred-bonus-label">{title}</label>
        <div className="pred-bonus-controls">
          <select
            className="pred-bonus-select"
            value={localKey}
            disabled={disabled || loading}
            onChange={(e) => void handleChange(e.target.value)}
          >
            <option value="">{goalkeeperOnly ? 'Elegir arquero…' : 'Elegir jugador…'}</option>
            {players.map((p) => (
              <option key={p.playerKey} value={p.playerKey}>
                {renderOptionTitle ? renderOptionTitle(p) : p.name}
              </option>
            ))}
          </select>
        </div>
        {saveError ? <p className="auth-error pred-special-player-row__save-error">{saveError}</p> : null}
      </div>
    </div>
  )
}

export function TournamentSpecialPlayersSection({
  roomId,
  userId,
  saveUserId,
  predByQuestionId,
  readOnly,
  sectionIndex,
  showEditWindowHint = true,
}: {
  roomId: string
  userId: string
  saveUserId?: string
  predByQuestionId: Map<string, TournamentPredictionPayload>
  readOnly: boolean
  sectionIndex?: number
  /** Muestra el plazo de edición (p. ej. en «Mi predicción» o página de predicciones). */
  showEditWindowHint?: boolean
}) {
  const currentTop = predByQuestionId.get(EXTRA_IDS.topScorer)
  const currentGkAvg = predByQuestionId.get(EXTRA_IDS.bestGoalkeeperAverage)
  const sectionTitle =
    sectionIndex != null ? `${sectionIndex} · Predicciones especiales` : 'Predicciones especiales'
  const lockLabel = formatGeneralPredictionsLockLabel()

  return (
    <section className="pred-bonus-bank pred-special-players-section" style={{ marginTop: 18 }}>
      <h2 className="pred-section-title">{sectionTitle}</h2>
      {showEditWindowHint ? (
        <p className="pred-special-players-section__lead app-muted">
          {readOnly ? (
            <>
              El plazo para editar goleador del torneo y mejor arquero finalizó el{' '}
              <strong>{lockLabel}</strong> ({DEFAULT_RULESET.timezone}).
            </>
          ) : (
            <>
              Podés editar estos campos hasta el cierre del plazo general de predicciones:{' '}
              <strong>{lockLabel}</strong> ({DEFAULT_RULESET.timezone}). Después de esa fecha quedan bloqueados.
            </>
          )}
        </p>
      ) : null}
      <SpecialPlayerRow
        title="Goleador del Torneo"
        questionId={EXTRA_IDS.topScorer}
        points={DEFAULT_RULESET.points.specials.topScorer}
        goalkeeperOnly={false}
        roomId={roomId}
        userId={userId}
        saveUserId={saveUserId}
        disabled={readOnly}
        currentPrediction={currentTop}
      />
      <SpecialPlayerRow
        title="Mejor Arquero del Torneo"
        questionId={EXTRA_IDS.bestGoalkeeperAverage}
        points={DEFAULT_RULESET.points.specials.bestGoalkeeperAverage}
        goalkeeperOnly
        roomId={roomId}
        userId={userId}
        saveUserId={saveUserId}
        disabled={readOnly}
        currentPrediction={currentGkAvg}
      />
    </section>
  )
}
