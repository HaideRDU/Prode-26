import { useMemo, useState, useEffect } from 'react'
import type { MatchDoc, MatchPredictionPayload } from '../types/predictions'
import { WC26_KO_MATCHES, koMatchDocId } from '../data/wc2026/knockoutBracket'
import { resolveKoMatchTeams } from '../domain/bracketResolve'
import { buildKoPredictionsContext } from '../domain/koRoundSaveGate'
import { TeamFlagName } from './TeamFlagName'
import { scoreMatchPrediction } from '../services/scoring'
import { parseGoalField } from '../domain/parseScoreText'

function koLineupMatchesOfficial(
  predHomeId: string,
  predAwayId: string,
  officialHomeId: string,
  officialAwayId: string,
): boolean {
  return (
    (predHomeId === officialHomeId && predAwayId === officialAwayId) ||
    (predHomeId === officialAwayId && predAwayId === officialHomeId)
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

export function KnockoutSection({
  groupPredByMatchId,
  koPredByMatchId,
  matchesByKoId,
  teamLabel,
  onKoDraftChange,
  readOnly = false,
}: {
  groupPredByMatchId: Map<string, MatchPredictionPayload>
  koPredByMatchId: Map<string, MatchPredictionPayload>
  matchesByKoId: Map<string, MatchDoc & { id: string }>
  teamLabel: (id: string) => string
  onKoDraftChange: (matchId: string, payload: MatchPredictionPayload | null) => void
  readOnly?: boolean
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

  const roundOrder = ['r32', 'r16', 'qf', 'sf', 'third', 'final'] as const

  return (
    <section className="pred-knockout-stage">
      <h2 className="pred-section-title">2 · Eliminatorias</h2>
      <p className="app-muted pred-knockout-note">
        Los cruces se rellenan con tus clasificados predichos. Marcador en dos campos (Equipo A y Equipo B). Si
        empatas en goles, elegí ganador en penales. Los campos KO nunca quedan vacíos: si borrás un valor vuelve
        a 0 automáticamente. Cuando grupos, eliminatorias y extras estén completos,
        usá <strong>Guardar predicción</strong> abajo para persistir todo de una vez.
      </p>
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
                const { homeId, awayId } = resolveKoMatchTeams(
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
                    homeId={homeId}
                    awayId={awayId}
                    initial={koPredByMatchId.get(matchId) ?? { goalsHome: 0, goalsAway: 0 }}
                    firestoreMatch={matchesByKoId.get(matchId)}
                    teamLabel={teamLabel}
                    onKoDraftChange={onKoDraftChange}
                    readOnly={readOnly}
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
  homeId,
  awayId,
  initial,
  firestoreMatch,
  teamLabel,
  onKoDraftChange,
  readOnly,
}: {
  matchNum: number
  matchId: string
  homeId: string | null
  awayId: string | null
  initial: MatchPredictionPayload
  firestoreMatch?: (MatchDoc & { id: string }) | undefined
  teamLabel: (id: string) => string
  onKoDraftChange: (matchId: string, payload: MatchPredictionPayload | null) => void
  readOnly: boolean
}) {
  const [h, setH] = useState<number>(initial.goalsHome ?? 0)
  const [a, setA] = useState<number>(initial.goalsAway ?? 0)
  const [pensHomeWins, setPensHomeWins] = useState<boolean | null>(
    initial.penaltiesWinnerHome ?? null,
  )

  useEffect(() => {
    setH(initial.goalsHome ?? 0)
    setA(initial.goalsAway ?? 0)
    setPensHomeWins(initial.penaltiesWinnerHome ?? null)
  }, [initial.goalsHome, initial.goalsAway, initial.penaltiesWinnerHome, initial.wentToPenalties])

  const disabled =
    readOnly ||
    firestoreMatch != null &&
    firestoreMatch.status !== 'scheduled' &&
    firestoreMatch.status !== 'live'

  const draw = h === a
  const pensIncomplete =
    Boolean(homeId && awayId) && draw && pensHomeWins === null && !disabled

  const incomplete = !homeId || !awayId

  const locked =
    Boolean(firestoreMatch) &&
    firestoreMatch!.status !== 'scheduled' &&
    firestoreMatch!.status !== 'live'

  const predictionForScore: MatchPredictionPayload = {
    goalsHome: h,
    goalsAway: a,
    goalsTeamA: h,
    goalsTeamB: a,
    ...(draw && pensHomeWins !== null
      ? { wentToPenalties: true, penaltiesWinnerHome: pensHomeWins, penaltiesWinnerTeamA: pensHomeWins }
      : {}),
  }

  const earnedPoints =
    locked &&
    firestoreMatch?.status === 'finished' &&
    firestoreMatch.goalsHome != null &&
    firestoreMatch.goalsAway != null &&
    !incomplete
      ? scoreMatchPrediction(firestoreMatch, predictionForScore, {
          predictedHomeId: homeId,
          predictedAwayId: awayId,
        })
      : null

  useEffect(() => {
    if (disabled || incomplete) {
      onKoDraftChange(matchId, null)
      return
    }
    if (h === a) {
      if (pensHomeWins === null) {
        onKoDraftChange(matchId, {
          goalsHome: h,
          goalsAway: a,
        })
        return
      }
      onKoDraftChange(matchId, {
        goalsHome: h,
        goalsAway: a,
        wentToPenalties: true,
        penaltiesWinnerHome: pensHomeWins,
      })
      return
    }
    onKoDraftChange(matchId, {
      goalsHome: h,
      goalsAway: a,
    })
  }, [disabled, incomplete, h, a, draw, pensHomeWins, matchId, onKoDraftChange])

  function applyHome(raw: string) {
    const g = parseGoalField(raw)
    if (g !== null) setH(g)
    else if (!raw.trim()) setH(0)
  }

  function applyAway(raw: string) {
    const g = parseGoalField(raw)
    if (g !== null) setA(g)
    else if (!raw.trim()) setA(0)
  }

  const homeStr = String(h)
  const awayStr = String(a)
  const homePenLabel = homeId ? teamLabel(homeId) : 'Equipo A'
  const awayPenLabel = awayId ? teamLabel(awayId) : 'Equipo B'

  const officialHomeId = firestoreMatch?.teamAId ?? firestoreMatch?.teamHomeId ?? null
  const officialAwayId = firestoreMatch?.teamBId ?? firestoreMatch?.teamAwayId ?? null
  const officialGoalsHome = firestoreMatch?.goalsTeamA ?? firestoreMatch?.goalsHome
  const officialGoalsAway = firestoreMatch?.goalsTeamB ?? firestoreMatch?.goalsAway
  const showOfficialResult =
    locked &&
    officialHomeId &&
    officialAwayId &&
    typeof officialGoalsHome === 'number' &&
    typeof officialGoalsAway === 'number'
  const officialPairMismatch =
    showOfficialResult &&
    homeId &&
    awayId &&
    !koLineupMatchesOfficial(homeId, awayId, officialHomeId, officialAwayId)

  return (
    <div
      className={`pred-match-card pred-match-card--ko${pensIncomplete ? ' pred-match-card--ko-pens-incomplete' : ''}${earnedPoints !== null ? ' pred-match-card--has-pts' : ''}`}
    >
      {earnedPoints !== null ? (
        <span className="pred-match-card__pts-badge" aria-label={`Puntos obtenidos: ${earnedPoints}`}>
          Pts: {earnedPoints}
        </span>
      ) : null}
      <div className="pred-ko-meta">Partido {matchNum}</div>
      <div className="pred-match-teams pred-match-teams--ko">
        {homeId ? (
          <TeamFlagName teamId={homeId} name={teamLabel(homeId)} />
        ) : (
          <span className="app-muted">Por definir</span>
        )}
        <span className="pred-vs">VS</span>
        {awayId ? (
          <TeamFlagName teamId={awayId} name={teamLabel(awayId)} />
        ) : (
          <span className="app-muted">Por definir</span>
        )}
      </div>
      {showOfficialResult ? (
        <p className="pred-ko-official-result app-muted">
          <span className="pred-ko-official-result__label">Resultado oficial:</span>{' '}
          <TeamFlagName teamId={officialHomeId} name={teamLabel(officialHomeId)} layout="inline" />{' '}
          <strong>
            {officialGoalsHome} – {officialGoalsAway}
          </strong>{' '}
          <TeamFlagName teamId={officialAwayId} name={teamLabel(officialAwayId)} layout="inline" />
          {officialPairMismatch ? (
            <span className="pred-ko-official-result__note">
              {' '}
              (tu cruce predicho fue otro rival)
            </span>
          ) : null}
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
              value={homeStr}
              onChange={(e) => applyHome(e.target.value)}
              disabled={disabled || incomplete}
              aria-label={homeId ? `Goles ${teamLabel(homeId)}` : 'Goles Equipo A'}
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
              value={awayStr}
              onChange={(e) => applyAway(e.target.value)}
              disabled={disabled || incomplete}
              aria-label={awayId ? `Goles ${teamLabel(awayId)}` : 'Goles Equipo B'}
            />
          </div>
          {draw && (
            <div className="pred-pens-winner">
              <span className="app-muted">Ganador en penales:</span>
              <label>
                <input
                  type="radio"
                  name={`pens-${matchNum}`}
                  checked={pensHomeWins === true}
                  onChange={() => setPensHomeWins(true)}
                  disabled={disabled || incomplete}
                />{' '}
                {homePenLabel}
              </label>
              <label>
                <input
                  type="radio"
                  name={`pens-${matchNum}`}
                  checked={pensHomeWins === false}
                  onChange={() => setPensHomeWins(false)}
                  disabled={disabled || incomplete}
                />{' '}
                {awayPenLabel}
              </label>
              {pensHomeWins === null ? (
                <span className="pred-bonus-missing-hint" style={{ width: '100%' }}>
                  Elegí un ganador en penales para completar el partido.
                </span>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
