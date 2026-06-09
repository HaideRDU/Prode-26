import { useMemo, useState, useEffect } from 'react'
import type { MatchDoc, MatchPredictionPayload } from '../types/predictions'
import { WC26_KO_MATCHES, koMatchDocId } from '../data/wc2026/knockoutBracket'
import { resolveKoMatchTeams } from '../domain/bracketResolve'
import { buildKoPredictionsContext } from '../domain/koRoundSaveGate'
import { TeamFlagName } from './TeamFlagName'
import {
  matchGoalsTeamA,
  matchGoalsTeamB,
  matchTeamAId,
  matchTeamBId,
  toTeamOnlyPredictionPayload,
} from '../domain/matchFields'
import {
  penaltiesWinnerFlagsForTeamA,
  penaltiesWinnerIsTeamAFromPayload,
} from '../domain/matchPenalties'
import {
  matchPointsBreakdownLabel,
  scoreMatchPredictionDetails,
} from '../services/scoring'
import { parseGoalField } from '../domain/parseScoreText'
import { MatchBonusPlayerLine } from './MatchBonusPlayerLine'

function koLineupMatchesOfficial(
  predTeamAId: string,
  predTeamBId: string,
  officialTeamAId: string,
  officialTeamBId: string,
): boolean {
  return (
    (predTeamAId === officialTeamAId && predTeamBId === officialTeamBId) ||
    (predTeamAId === officialTeamBId && predTeamBId === officialTeamAId)
  )
}

const ROUND_TITLE: Record<string, string> = {
  r32: 'Dieciseisavos de final',
  r16: 'Octavos de final',
  qf: 'Cuartos de final',
  sf: 'Semifinales',
  third: 'Tercer puesto',
  final: 'Final',
}

const KO_ROUND_ORDER_REVIEW = ['final', 'third', 'sf', 'qf', 'r16', 'r32'] as const
const KO_ROUND_ORDER_CASCADE = ['r32', 'r16', 'qf', 'sf', 'third', 'final'] as const

export type KnockoutLayoutMode = 'cascade' | 'review'

export function KnockoutSection({
  groupPredByMatchId,
  koPredByMatchId,
  matchesByKoId,
  teamLabel,
  onKoDraftChange,
  readOnly = false,
  layoutMode = 'review',
  sectionIndex = 2,
  showPoints = false,
  bonusPlayerLabelByMatchId,
}: {
  groupPredByMatchId: Map<string, MatchPredictionPayload>
  koPredByMatchId: Map<string, MatchPredictionPayload>
  matchesByKoId: Map<string, MatchDoc & { id: string }>
  teamLabel: (id: string) => string
  onKoDraftChange: (matchId: string, payload: MatchPredictionPayload | null) => void
  readOnly?: boolean
  /** cascade: dieciseisavos → final; review: final → dieciseisavos (predicción ya hecha). */
  layoutMode?: KnockoutLayoutMode
  sectionIndex?: number
  showPoints?: boolean
  bonusPlayerLabelByMatchId?: ReadonlyMap<string, string>
}) {
  const ctx = useMemo(
    () => buildKoPredictionsContext(groupPredByMatchId, koPredByMatchId),
    [groupPredByMatchId, koPredByMatchId],
  )

  const byRound = useMemo(() => {
    const m = new Map<string, (typeof WC26_KO_MATCHES)[number][]>()
    for (const row of WC26_KO_MATCHES) {
      const k = row.round
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(row)
    }
    return m
  }, [])

  const roundOrder = layoutMode === 'cascade' ? KO_ROUND_ORDER_CASCADE : KO_ROUND_ORDER_REVIEW

  const hasOfficialBracketMismatch = useMemo(() => {
    for (const def of WC26_KO_MATCHES) {
      const matchId = koMatchDocId(def.matchNum)
      const fm = matchesByKoId.get(matchId)
      if (!fm || (fm.status !== 'finished' && fm.status !== 'live')) continue
      const officialTeamAId = matchTeamAId(fm)
      const officialTeamBId = matchTeamBId(fm)
      if (!officialTeamAId || !officialTeamBId) continue
      const { teamAId, teamBId } = resolveKoMatchTeams(
        def.matchNum,
        ctx.tablesByGroup,
        ctx.thirdByMatchNum,
        ctx.winnerByMatchNum,
      )
      if (!teamAId || !teamBId) continue
      if (!koLineupMatchesOfficial(teamAId, teamBId, officialTeamAId, officialTeamBId)) return true
    }
    return false
  }, [ctx, matchesByKoId])

  return (
    <section className="pred-knockout-stage">
      <h2 className="pred-section-title">{sectionIndex} · Eliminatorias</h2>
      <p className="app-muted pred-knockout-note">
        {layoutMode === 'cascade' ? (
          <>
            Completá primero la fase de grupos; después avanzá ronda a ronda desde dieciseisavos hasta la final.
            Los cruces se arman con tus clasificados predichos.
          </>
        ) : (
          <>Los cruces se rellenan con tus clasificados predichos.</>
        )}{' '}
        Marcador en dos campos (Equipo A y Equipo B). Si empatas en goles, elegí ganador en penales. Los campos KO
        nunca quedan vacíos: si borrás un valor vuelve a 0 automáticamente. Cuando grupos, eliminatorias y extras
        estén completos, usá <strong>Guardar predicción</strong> abajo para persistir todo de una vez.
      </p>
      {hasOfficialBracketMismatch ? (
        <p className="pred-ko-bracket-mismatch-note app-muted">
          Hay resultados oficiales de un cuadro distinto al tuyo. Seguí editando tus cruces abajo; los puntos por
          partido se calculan solo cuando el cruce oficial de ese número de partido coincida con tu predicción.
        </p>
      ) : null}
      {roundOrder.map((round) => {
        const rows = byRound.get(round)
        if (!rows?.length) return null
        const narrowRound = round === 'third' || round === 'final'
        return (
          <div key={round} className={`pred-ko-round${narrowRound ? ' pred-ko-round--narrow' : ''}`}>
            <h3 className="pred-ko-round-title">{ROUND_TITLE[round]}</h3>
            <div className="pred-ko-matches">
              {rows.map((def) => {
                const matchId = koMatchDocId(def.matchNum)
                const { teamAId, teamBId } = resolveKoMatchTeams(
                  def.matchNum,
                  ctx.tablesByGroup,
                  ctx.thirdByMatchNum,
                  ctx.winnerByMatchNum,
                )
                return (
                  <KoMatchRow
                    key={def.matchNum}
                    matchNum={def.matchNum}
                    matchId={matchId}
                    teamAId={teamAId}
                    teamBId={teamBId}
                    initial={koPredByMatchId.get(matchId) ?? { goalsTeamA: 0, goalsTeamB: 0 }}
                    firestoreMatch={matchesByKoId.get(matchId)}
                    teamLabel={teamLabel}
                    onKoDraftChange={onKoDraftChange}
                    readOnly={readOnly}
                    showPoints={showPoints}
                    bonusPlayerLabel={bonusPlayerLabelByMatchId?.get(matchId)}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </section>
  )
}

function KoMatchRow({
  matchNum,
  matchId,
  teamAId,
  teamBId,
  initial,
  firestoreMatch,
  teamLabel,
  onKoDraftChange,
  readOnly,
  showPoints,
  bonusPlayerLabel,
}: {
  matchNum: number
  matchId: string
  teamAId: string | null
  teamBId: string | null
  initial: MatchPredictionPayload
  firestoreMatch?: (MatchDoc & { id: string }) | undefined
  teamLabel: (id: string) => string
  onKoDraftChange: (matchId: string, payload: MatchPredictionPayload | null) => void
  readOnly: boolean
  showPoints: boolean
  bonusPlayerLabel?: string
}) {
  const [goalsA, setGoalsA] = useState<number>(initial.goalsTeamA ?? 0)
  const [goalsB, setGoalsB] = useState<number>(initial.goalsTeamB ?? 0)
  const [pensTeamAWins, setPensTeamAWins] = useState<boolean | null>(
    penaltiesWinnerIsTeamAFromPayload(initial),
  )

  useEffect(() => {
    setGoalsA(initial.goalsTeamA ?? 0)
    setGoalsB(initial.goalsTeamB ?? 0)
    setPensTeamAWins(penaltiesWinnerIsTeamAFromPayload(initial))
  }, [initial])

  const incomplete = !teamAId || !teamBId

  const locked =
    Boolean(firestoreMatch) &&
    firestoreMatch!.status !== 'scheduled' &&
    firestoreMatch!.status !== 'live'

  const disabled = readOnly || incomplete || locked

  const draw = goalsA === goalsB
  const pensIncomplete =
    Boolean(teamAId && teamBId) && draw && pensTeamAWins === null && !disabled

  const predictionForScore: MatchPredictionPayload = toTeamOnlyPredictionPayload({
    goalsTeamA: goalsA,
    goalsTeamB: goalsB,
    ...(draw && pensTeamAWins !== null
      ? { wentToPenalties: true, ...penaltiesWinnerFlagsForTeamA(pensTeamAWins) }
      : {}),
  })

  const scoreDetails =
    showPoints &&
    locked &&
    firestoreMatch?.status === 'finished' &&
    matchGoalsTeamA(firestoreMatch) != null &&
    matchGoalsTeamB(firestoreMatch) != null &&
    !incomplete
      ? scoreMatchPredictionDetails(firestoreMatch, predictionForScore, {
          predictedTeamAId: teamAId,
          predictedTeamBId: teamBId,
        })
      : null
  const pointsTooltip =
    scoreDetails && firestoreMatch
      ? matchPointsBreakdownLabel(firestoreMatch, scoreDetails)
      : undefined

  useEffect(() => {
    if (disabled || incomplete) {
      onKoDraftChange(matchId, null)
      return
    }
    if (goalsA === goalsB) {
      if (pensTeamAWins === null) {
        onKoDraftChange(matchId, { goalsTeamA: goalsA, goalsTeamB: goalsB })
        return
      }
      onKoDraftChange(
        matchId,
        toTeamOnlyPredictionPayload({
          goalsTeamA: goalsA,
          goalsTeamB: goalsB,
          wentToPenalties: true,
          ...penaltiesWinnerFlagsForTeamA(pensTeamAWins),
        }),
      )
      return
    }
    onKoDraftChange(matchId, { goalsTeamA: goalsA, goalsTeamB: goalsB })
  }, [disabled, incomplete, goalsA, goalsB, draw, pensTeamAWins, matchId, onKoDraftChange])

  function applyTeamA(raw: string) {
    const g = parseGoalField(raw)
    if (g !== null) setGoalsA(g)
    else if (!raw.trim()) setGoalsA(0)
  }

  function applyTeamB(raw: string) {
    const g = parseGoalField(raw)
    if (g !== null) setGoalsB(g)
    else if (!raw.trim()) setGoalsB(0)
  }

  const teamAStr = String(goalsA)
  const teamBStr = String(goalsB)
  const teamAPenLabel = teamAId ? teamLabel(teamAId) : 'Equipo A'
  const teamBPenLabel = teamBId ? teamLabel(teamBId) : 'Equipo B'

  const officialTeamAId = firestoreMatch ? matchTeamAId(firestoreMatch) : null
  const officialTeamBId = firestoreMatch ? matchTeamBId(firestoreMatch) : null
  const officialGoalsA = firestoreMatch ? matchGoalsTeamA(firestoreMatch) : null
  const officialGoalsB = firestoreMatch ? matchGoalsTeamB(firestoreMatch) : null
  const hasOfficialScore =
    locked &&
    officialTeamAId &&
    officialTeamBId &&
    typeof officialGoalsA === 'number' &&
    typeof officialGoalsB === 'number'
  const officialLineupMatches =
    hasOfficialScore &&
    teamAId &&
    teamBId &&
    officialTeamAId &&
    officialTeamBId &&
    koLineupMatchesOfficial(teamAId, teamBId, officialTeamAId, officialTeamBId)
  const showOfficialResult = officialLineupMatches

  return (
    <div
      className={`pred-match-card pred-match-card--ko${pensIncomplete ? ' pred-match-card--ko-pens-incomplete' : ''}${scoreDetails !== null && scoreDetails.points > 0 ? ' pred-match-card--has-pts' : ''}`}
    >
      {scoreDetails !== null && scoreDetails.points > 0 ? (
        <span
          className="pred-match-card__pts-badge"
          title={pointsTooltip}
          aria-label={`Puntos del partido: ${scoreDetails.points}. ${pointsTooltip ?? ''}`}
        >
          Pts partido: {scoreDetails.points}
        </span>
      ) : null}
      <div className="pred-ko-meta">Partido {matchNum}</div>
      <div className="pred-match-teams pred-match-teams--ko">
        {teamAId ? (
          <TeamFlagName teamId={teamAId} name={teamLabel(teamAId)} />
        ) : (
          <span className="app-muted">Por definir</span>
        )}
        <span className="pred-vs">VS</span>
        {teamBId ? (
          <TeamFlagName teamId={teamBId} name={teamLabel(teamBId)} />
        ) : (
          <span className="app-muted">Por definir</span>
        )}
      </div>
      {showOfficialResult ? (
        <p className="pred-ko-official-result app-muted">
          <span className="pred-ko-official-result__label">Resultado oficial:</span>
          <span className="pred-ko-official-result__line">
            <TeamFlagName teamId={officialTeamAId!} name={teamLabel(officialTeamAId)} layout="inline" compact />
            <strong className="pred-ko-official-result__score">
              {officialGoalsA} – {officialGoalsB}
            </strong>
            <TeamFlagName teamId={officialTeamBId!} name={teamLabel(officialTeamBId)} layout="inline" compact />
          </span>
        </p>
      ) : null}
      <div className="pred-ko-inline-block">
        <span className="pred-score-text-label app-muted">Marcador</span>
        <div className="pred-match-inputs pred-match-inputs--ko pred-ko-score-row">
          <div className="pred-score-split pred-score-split--ko" role="group" aria-label="Marcador predicho">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={20}
              step={1}
              className="field-input pred-score-split-input"
              autoComplete="off"
              placeholder="0"
              value={teamAStr}
              onChange={(e) => applyTeamA(e.target.value)}
              disabled={disabled || incomplete}
              aria-label={teamAId ? `Goles ${teamLabel(teamAId)}` : 'Goles Equipo A'}
            />
            <span className="pred-score-split-sep" aria-hidden>
              -
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={20}
              step={1}
              className="field-input pred-score-split-input"
              autoComplete="off"
              placeholder="0"
              value={teamBStr}
              onChange={(e) => applyTeamB(e.target.value)}
              disabled={disabled || incomplete}
              aria-label={teamBId ? `Goles ${teamLabel(teamBId)}` : 'Goles Equipo B'}
            />
          </div>
          {draw && (
            <div className="pred-pens-winner">
              <span className="app-muted">Ganador en penales:</span>
              <label>
                <input
                  type="radio"
                  name={`pens-${matchNum}`}
                  checked={pensTeamAWins === true}
                  onChange={() => setPensTeamAWins(true)}
                  disabled={disabled || incomplete}
                />{' '}
                {teamAPenLabel}
              </label>
              <label>
                <input
                  type="radio"
                  name={`pens-${matchNum}`}
                  checked={pensTeamAWins === false}
                  onChange={() => setPensTeamAWins(false)}
                  disabled={disabled || incomplete}
                />{' '}
                {teamBPenLabel}
              </label>
              {pensTeamAWins === null ? (
                <span className="pred-bonus-missing-hint" style={{ width: '100%' }}>
                  Elegí un ganador en penales para completar el partido.
                </span>
              ) : null}
            </div>
          )}
        </div>
      </div>
      <MatchBonusPlayerLine playerLabel={bonusPlayerLabel} />
    </div>
  )
}
