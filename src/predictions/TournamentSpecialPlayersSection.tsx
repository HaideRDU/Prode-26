import { useEffect, useRef, useState } from 'react'
import type { TournamentPredictionPayload, TeamDoc } from '../types/predictions'
import { subscribeTeams, subscribeTeamPlayers, playerDocToKey } from '../services/teamsService'
import { saveTournamentPrediction } from '../services/predictionsService'
import { DEFAULT_RULESET } from '../config/ruleset'
import { EXTRA_IDS } from '../data/questionIds'

type PlayerOpt = {
  playerKey: string
  name: string
  position?: string
  teamId: string
}

function isGoalkeeper(position?: string): boolean {
  const s = position?.toLowerCase().trim() ?? ''
  // Heurística: TheSportsDB suele traer "Goalkeeper" o "Keeper"; en algunos seeds viene "GK".
  return s.includes('goalkeeper') || s.includes('gk') || s.includes('portero') || s.includes('arquero') || s.includes('keeper')
}

function useTournamentPlayers(goalkeeperOnly: boolean) {
  const [teams, setTeams] = useState<(TeamDoc & { id: string })[]>([])
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
        setTeams(list)

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

              // Marcamos como "listo" en el primer snapshot de cada equipo.
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

  return { teams, players, loading, err }
}

function SpecialPlayerRow({
  title,
  questionId,
  points,
  goalkeeperOnly,
  roomId,
  userId,
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
  disabled: boolean
  currentPrediction: TournamentPredictionPayload | undefined
  renderOptionTitle?: (opt: PlayerOpt) => string
}) {
  const { players, loading, err } = useTournamentPlayers(goalkeeperOnly)
  const selectedKey = currentPrediction?.kind === 'player' ? currentPrediction.playerId : ''
  const [localKey, setLocalKey] = useState(selectedKey)
  const lastSyncedKey = useRef(selectedKey)

  useEffect(() => {
    if (selectedKey !== lastSyncedKey.current) {
      lastSyncedKey.current = selectedKey
      setLocalKey(selectedKey)
    }
  }, [selectedKey])

  return (
    <section className="pred-bonus-bank" style={{ marginTop: 18 }}>
      <h2 className="pred-section-title">Predicciones especiales</h2>
      <p className="app-muted" style={{ marginTop: -6, marginBottom: 12 }}>
        {title} (+{points} pts)
      </p>

      {loading ? <p className="user-email">Cargando jugadores…</p> : null}
      {err ? <p className="auth-error">{err}</p> : null}

      <div className="pred-bonus-row" style={{ marginTop: 8 }}>
        <label className="pred-bonus-label">{title}</label>
        <div className="pred-bonus-controls">
          <select
            className="pred-bonus-select"
            value={localKey}
            disabled={disabled || loading}
            onChange={(e) => {
              const next = e.target.value
              setLocalKey(next)
              if (!next || disabled) return
              void saveTournamentPrediction(roomId, userId, questionId, { kind: 'player', playerId: next })
            }}
          >
            <option value="">{goalkeeperOnly ? 'Elegir arquero…' : 'Elegir jugador…'}</option>
            {players.map((p) => (
              <option key={p.playerKey} value={p.playerKey}>
                {renderOptionTitle ? renderOptionTitle(p) : p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  )
}

export function TournamentSpecialPlayersSection({
  roomId,
  userId,
  predByQuestionId,
  readOnly,
}: {
  roomId: string
  userId: string
  predByQuestionId: Map<string, TournamentPredictionPayload>
  readOnly: boolean
}) {
  const currentTop = predByQuestionId.get(EXTRA_IDS.topScorer)
  const currentGkAvg = predByQuestionId.get(EXTRA_IDS.bestGoalkeeperAverage)

  return (
    <>
      <SpecialPlayerRow
        title="Goleador del Torneo"
        questionId={EXTRA_IDS.topScorer}
        points={DEFAULT_RULESET.points.specials.topScorer}
        goalkeeperOnly={false}
        roomId={roomId}
        userId={userId}
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
        disabled={readOnly}
        currentPrediction={currentGkAvg}
      />
    </>
  )
}

