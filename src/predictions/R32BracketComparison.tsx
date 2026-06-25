import { getPredictedKoLineupForMatch } from '../domain/koPredictedLineup'
import { WC26_KO_MATCHES, koMatchDocId } from '../data/wc2026/knockoutBracket'
import type { MatchDoc, PredictionDoc } from '../types/predictions'

type TeamHit = 'exact' | 'present' | 'miss' | 'unknown'

function statusForTeam(
  predictedTeamId: string | null,
  actualTeamId: string | null,
  actualOtherTeamId: string | null,
): TeamHit {
  if (!predictedTeamId || !actualTeamId || !actualOtherTeamId) return 'unknown'
  if (predictedTeamId === actualTeamId) return 'exact'
  if (predictedTeamId === actualOtherTeamId) return 'present'
  return 'miss'
}

function statusLabel(status: TeamHit): string {
  switch (status) {
    case 'exact':
      return 'Exacto'
    case 'present':
      return 'En R32'
    case 'miss':
      return 'Distinto'
    default:
      return 'Pendiente'
  }
}

function TeamPill({
  teamId,
  status,
  teamLabel,
}: {
  teamId: string | null
  status?: TeamHit
  teamLabel: (id: string | null | undefined) => string
}) {
  return (
    <span className={`r32-comparison__team ${status ? `r32-comparison__team--${status}` : ''}`}>
      {teamId ? teamLabel(teamId) : 'Por definir'}
      {status ? <small>{statusLabel(status)}</small> : null}
    </span>
  )
}

export function R32BracketComparison({
  matches,
  predictions,
  teamLabel,
}: {
  matches: (MatchDoc & { id: string })[]
  predictions: PredictionDoc[]
  teamLabel: (id: string | null | undefined) => string
}) {
  const matchesById = new Map(matches.map((m) => [m.id, m]))
  const r32 = WC26_KO_MATCHES.filter((m) => m.round === 'r32')

  return (
    <section className="r32-comparison" aria-labelledby="r32-comparison-title">
      <div className="r32-comparison__header">
        <span className="pred-section-kicker">R32</span>
        <h3 id="r32-comparison-title" className="pred-section-title">
          Bracket real vs pronosticado
        </h3>
        <p className="app-muted">
          Compara cada cruce oficial de Ronda de 32 contra el bracket simulado por el participante.
        </p>
      </div>
      <div className="r32-comparison__list">
        {r32.map((template) => {
          const matchId = koMatchDocId(template.matchNum)
          const official = matchesById.get(matchId)
          const actualA = official?.teamAId ?? null
          const actualB = official?.teamBId ?? null
          const predicted = getPredictedKoLineupForMatch(predictions, matchId)
          const predA = predicted.predictedTeamAId
          const predB = predicted.predictedTeamBId

          return (
            <article key={matchId} className="r32-comparison__row">
              <div className="r32-comparison__match-id">M{template.matchNum}</div>
              <div className="r32-comparison__panel">
                <span className="r32-comparison__label">Oficial</span>
                <TeamPill teamId={actualA} teamLabel={teamLabel} />
                <TeamPill teamId={actualB} teamLabel={teamLabel} />
              </div>
              <div className="r32-comparison__panel">
                <span className="r32-comparison__label">Pronóstico</span>
                <TeamPill
                  teamId={predA}
                  status={statusForTeam(predA, actualA, actualB)}
                  teamLabel={teamLabel}
                />
                <TeamPill
                  teamId={predB}
                  status={statusForTeam(predB, actualB, actualA)}
                  teamLabel={teamLabel}
                />
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
