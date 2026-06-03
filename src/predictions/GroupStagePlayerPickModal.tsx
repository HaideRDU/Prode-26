import { useMemo } from 'react'
import { orderedGroupIds } from '../domain/groupStandings'
import type { MatchDoc } from '../types/predictions'
import { filterGroupStageMatches } from '../utils/playerPerMatchWindows'
import { PlayerPickFixtureCard } from './PlayerPickFixtureCard'

type Props = {
  matches: (MatchDoc & { id: string })[]
  teamLabel: (id: string) => string
  picksByMatchId: Record<string, string | undefined>
  roomId: string
  userId: string
  timeZone: string
  onClose: () => void
}

export function GroupStagePlayerPickModal({
  matches,
  teamLabel,
  picksByMatchId,
  roomId,
  userId,
  timeZone,
  onClose,
}: Props) {
  const groupMatches = useMemo(() => filterGroupStageMatches(matches), [matches])

  const matchesByGroup = useMemo(() => {
    const map = new Map<string, (MatchDoc & { id: string })[]>()
    for (const g of orderedGroupIds()) map.set(g, [])
    for (const m of groupMatches) {
      const g = m.groupId ?? '?'
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(m)
    }
    return map
  }, [groupMatches])

  const groupsWithMatches = orderedGroupIds().filter((g) => (matchesByGroup.get(g)?.length ?? 0) > 0)

  return (
    <div
      className="modal-overlay pred-rules-modal-overlay group-stage-player-pick-modal-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="modal-card pred-rules-modal group-stage-player-pick-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-stage-player-pick-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="group-stage-player-pick-title">Jugador por partido · Fase de grupos</h2>
          <button type="button" className="modal-close" aria-label="Cerrar" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="pred-rules-modal__body group-stage-player-pick-modal__body">
          <p className="group-stage-player-pick-modal__lead app-muted">
            Elegí un jugador por partido de fase de grupos <strong>desde ya</strong>. Cierre{' '}
            <strong>11:59 p. m. del día anterior</strong> al partido (hora del torneo). Se guarda al
            seleccionar.
          </p>

          {groupMatches.length === 0 ? (
            <p className="app-muted">No hay partidos de fase de grupos cargados.</p>
          ) : (
            <div className="group-stage-player-pick-modal__groups">
              {groupsWithMatches.map((groupId) => {
                const groupRows = matchesByGroup.get(groupId) ?? []
                return (
                  <section key={groupId} className="group-stage-player-pick-modal__group">
                    <h3 className="group-stage-player-pick-modal__group-title">Grupo {groupId}</h3>
                    <div className="player-pick-fixture-grid player-pick-fixture-grid--predict group-stage-player-pick-modal__grid">
                      {groupRows.map((m) => (
                        <PlayerPickFixtureCard
                          key={m.id}
                          match={m}
                          teamLabel={teamLabel}
                          mode={m.status === 'live' ? 'live' : 'pick'}
                          savedPlayerKey={picksByMatchId[m.id]}
                          roomId={roomId}
                          userId={userId}
                          timeZone={timeZone}
                          groupStageEarlyPick
                        />
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </div>

        <div className="button-group pred-save-modal-actions group-stage-player-pick-modal__footer">
          <button
            type="button"
            className="btn-secondary pred-save-modal-btn pred-save-modal-btn--cancel"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
