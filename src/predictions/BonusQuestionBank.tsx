import { useEffect, useMemo, useRef, useState, type FocusEvent, type ReactNode } from 'react'
import { subscribeTeams } from '../services/teamsService'
import type { TeamDoc, TournamentPredictionPayload } from '../types/predictions'
import type { QuestionMeta } from '../data/bonusQuestionsMeta'
import { parseGoalField, formatScorePair, parseScoreText } from '../domain/parseScoreText'

export type MatchPickOption = { matchId: string; label: string; groupLabel: string }

function groupMatchPickOptions(options: MatchPickOption[]): { groupLabel: string; items: MatchPickOption[] }[] {
  const order: string[] = []
  const byGroup = new Map<string, MatchPickOption[]>()
  for (const o of options) {
    if (!byGroup.has(o.groupLabel)) {
      order.push(o.groupLabel)
      byGroup.set(o.groupLabel, [])
    }
    byGroup.get(o.groupLabel)!.push(o)
  }
  return order.map((groupLabel) => ({ groupLabel, items: byGroup.get(groupLabel)! }))
}

function scorePairInitial(initial: TournamentPredictionPayload | undefined): { home: string; away: string } {
  if (initial?.kind !== 'text' || !initial.value) return { home: '', away: '' }
  const p = parseScoreText(initial.value)
  if (!p) return { home: '', away: '' }
  return { home: String(p.goalsHome), away: String(p.goalsAway) }
}

function payloadsEqual(
  a: TournamentPredictionPayload | null | undefined,
  b: TournamentPredictionPayload | null | undefined,
): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  if (a.kind !== b.kind) return false
  switch (a.kind) {
    case 'team':
      return b.kind === 'team' && a.teamId === b.teamId
    case 'text':
      return b.kind === 'text' && a.value === b.value
    case 'match_ref':
      return b.kind === 'match_ref' && a.matchId === b.matchId
    case 'range':
      return b.kind === 'range' && a.rangeId === b.rangeId
    case 'group':
      return b.kind === 'group' && a.groupId === b.groupId
    case 'boolean':
      return b.kind === 'boolean' && a.value === b.value
    case 'player':
      return b.kind === 'player' && a.playerId === b.playerId
    default:
      return false
  }
}

export function BonusQuestionBank({
  questionMetas,
  mergedBonusByQuestionId,
  matchPickOptions,
  groupIds,
  onBonusDraftChange,
  incompleteQuestionIds,
  readOnly = false,
}: {
  questionMetas: QuestionMeta[]
  mergedBonusByQuestionId: Map<string, TournamentPredictionPayload>
  matchPickOptions: MatchPickOption[]
  groupIds: readonly string[]
  onBonusDraftChange: (questionId: string, payload: TournamentPredictionPayload | null) => void
  incompleteQuestionIds?: ReadonlySet<string>
  readOnly?: boolean
}) {
  const [teams, setTeams] = useState<(TeamDoc & { id: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const u = subscribeTeams(
      (list) => {
        setTeams([...list].sort((a, b) => a.nameEs.localeCompare(b.nameEs, 'es')))
        setLoading(false)
        setErr(null)
      },
      (e) => {
        setErr(e.message)
        setLoading(false)
      },
    )
    return () => u?.()
  }, [])

  const teamOptions = useMemo(
    () =>
      teams.map((t) => (
        <option key={t.teamId} value={t.teamId}>
          {t.nameEs} ({t.teamId})
        </option>
      )),
    [teams],
  )

  return (
    <section className="pred-bonus-bank">
      <h2 className="pred-section-title">3 · Extras y banco de preguntas</h2>
      <p className="app-muted pred-bonus-optional">
        Todas las preguntas cuentan para el guardado global: completalas para habilitar{' '}
        <strong>Guardar predicción</strong>.
      </p>
      {loading && <p className="user-email">Cargando equipos…</p>}
      {err && <p className="auth-error">{err}</p>}
      <div className="pred-bonus-list">
        {questionMetas.map((meta) => (
          <BonusRow
            key={meta.id}
            meta={meta}
            value={mergedBonusByQuestionId.get(meta.id)}
            teamOptions={teamOptions}
            matchOptions={matchPickOptions}
            groupIds={groupIds}
            onDraftChange={(p) => onBonusDraftChange(meta.id, p)}
            isIncomplete={Boolean(incompleteQuestionIds?.has(meta.id))}
            readOnly={readOnly}
          />
        ))}
      </div>
    </section>
  )
}

function BonusRow({
  meta,
  value,
  teamOptions,
  matchOptions,
  groupIds,
  onDraftChange,
  isIncomplete,
  readOnly,
}: {
  meta: QuestionMeta
  value: TournamentPredictionPayload | undefined
  teamOptions: ReactNode
  matchOptions: MatchPickOption[]
  groupIds: readonly string[]
  onDraftChange: (p: TournamentPredictionPayload | null) => void
  isIncomplete: boolean
  readOnly: boolean
}) {
  const onDraftChangeRef = useRef(onDraftChange)
  onDraftChangeRef.current = onDraftChange
  const [teamId, setTeamId] = useState(
    value?.kind === 'team' ? value.teamId : value?.kind === 'player' ? value.playerId : '',
  )
  const [text, setText] = useState(
    value?.kind === 'text'
      ? value.value
      : value?.kind === 'player'
        ? value.playerId
        : '',
  )
  const [matchId, setMatchId] = useState(value?.kind === 'match_ref' ? value.matchId : '')
  const [rangeId, setRangeId] = useState(value?.kind === 'range' ? value.rangeId : '')
  const [groupId, setGroupId] = useState(value?.kind === 'group' ? value.groupId : '')
  const [textFocused, setTextFocused] = useState(false)
  const [scorePairFocused, setScorePairFocused] = useState(false)
  const [scoreHome, setScoreHome] = useState(() => scorePairInitial(value).home)
  const [scoreAway, setScoreAway] = useState(() => scorePairInitial(value).away)
  const [extraTimeGoalsFocused, setExtraTimeGoalsFocused] = useState(false)
  const [extraTimeGoals, setExtraTimeGoals] = useState(
    value?.kind === 'text' && meta.id === 'q_events_goals_extra_time' && value.value.trim() !== ''
      ? String(Math.max(0, Math.floor(Number(value.value)) || 0))
      : '0',
  )
  const [ownGoalsCountFocused, setOwnGoalsCountFocused] = useState(false)
  const [ownGoalsCount, setOwnGoalsCount] = useState(
    value?.kind === 'text' && meta.id === 'q_fun_own_goals_count' && value.value.trim() !== ''
      ? String(Math.max(0, Math.floor(Number(value.value)) || 0))
      : '0',
  )

  useEffect(() => {
    if (meta.control === 'team') {
      setTeamId(value?.kind === 'team' ? value.teamId : '')
    } else if (meta.control === 'text') {
      if (meta.id === 'q_offense_most_lopsided_score' || meta.id === 'q_fun_most_repeated_scoreline') {
        if (!scorePairFocused) {
          const p = scorePairInitial(value)
          setScoreHome(p.home)
          setScoreAway(p.away)
        }
      } else if (meta.id === 'q_events_goals_extra_time') {
        if (!extraTimeGoalsFocused) {
          setExtraTimeGoals(
            value?.kind === 'text' && value.value.trim() !== ''
              ? String(Math.max(0, Math.floor(Number(value.value)) || 0))
              : '0',
          )
        }
      } else if (meta.id === 'q_fun_own_goals_count') {
        if (!ownGoalsCountFocused) {
          setOwnGoalsCount(
            value?.kind === 'text' && value.value.trim() !== ''
              ? String(Math.max(0, Math.floor(Number(value.value)) || 0))
              : '0',
          )
        }
      } else {
        if (!textFocused) {
          setText(
            value?.kind === 'text' ? value.value : value?.kind === 'player' ? value.playerId : '',
          )
        }
      }
    } else if (meta.control === 'match_ref') {
      setMatchId(value?.kind === 'match_ref' ? value.matchId : '')
    } else if (meta.control === 'range') {
      setRangeId(value?.kind === 'range' ? value.rangeId : '')
    } else if (meta.control === 'group') {
      setGroupId(value?.kind === 'group' ? value.groupId : '')
    }
  }, [
    value,
    meta.control,
    meta.id,
    textFocused,
    scorePairFocused,
    extraTimeGoalsFocused,
    ownGoalsCountFocused,
  ])

  function onScorePairBlurCapture(e: FocusEvent<HTMLDivElement>) {
    const nextTarget = e.relatedTarget
    if (nextTarget instanceof Node && e.currentTarget.contains(nextTarget)) return
    setScorePairFocused(false)
  }

  const matchGroups = useMemo(() => groupMatchPickOptions(matchOptions), [matchOptions])

  const derivedPayload = useMemo((): TournamentPredictionPayload | null => {
    if (meta.control === 'team') {
      if (!teamId.trim()) return null
      return { kind: 'team', teamId }
    }
    if (meta.control === 'boolean') {
      if (value?.kind === 'boolean') return { kind: 'boolean', value: value.value }
      return null
    }
    if (meta.control === 'match_ref') {
      if (!matchId.trim()) return null
      return { kind: 'match_ref', matchId }
    }
    if (meta.control === 'range' && meta.rangeOptions?.length) {
      if (!rangeId.trim()) return null
      return { kind: 'range', rangeId }
    }
    if (meta.control === 'group') {
      if (!groupId.trim()) return null
      return { kind: 'group', groupId }
    }
    if (meta.control === 'text' && meta.id === 'q_offense_most_lopsided_score') {
      const gh = parseGoalField(scoreHome)
      const ga = parseGoalField(scoreAway)
      if (gh === null || ga === null) return null
      return { kind: 'text', value: formatScorePair(gh, ga) }
    }
    if (meta.control === 'text' && meta.id === 'q_fun_most_repeated_scoreline') {
      const gh = parseGoalField(scoreHome)
      const ga = parseGoalField(scoreAway)
      if (gh === null || ga === null) return null
      return { kind: 'text', value: formatScorePair(gh, ga) }
    }
    if (meta.control === 'text' && meta.id === 'q_fun_own_goals_count') {
      if (ownGoalsCount === '') return { kind: 'text', value: '0' }
      const n = Math.max(0, Math.floor(Number(ownGoalsCount)))
      if (!Number.isFinite(n)) return null
      return { kind: 'text', value: String(n) }
    }
    if (meta.control === 'text' && meta.id === 'q_events_goals_extra_time') {
      if (extraTimeGoals === '') return { kind: 'text', value: '0' }
      const n = Math.max(0, Math.floor(Number(extraTimeGoals)))
      if (!Number.isFinite(n)) return null
      return { kind: 'text', value: String(n) }
    }
    if (meta.control === 'text') {
      const t = text.trim()
      if (!t) return null
      return { kind: 'text', value: t }
    }
    return null
  }, [
    meta.control,
    meta.id,
    meta.rangeOptions?.length,
    teamId,
    matchId,
    rangeId,
    groupId,
    scoreHome,
    scoreAway,
    extraTimeGoals,
    ownGoalsCount,
    text,
    value,
  ])

  useEffect(() => {
    if (readOnly) return
    if (meta.control === 'boolean' && value?.kind === 'text' && value.value.trim() !== '') return
    const target = derivedPayload
    if (payloadsEqual(target, value)) return
    onDraftChangeRef.current(target)
  }, [derivedPayload, value, meta.control, readOnly])

  function onBooleanPick(v: boolean) {
    if (readOnly) return
    const p: TournamentPredictionPayload = { kind: 'boolean', value: v }
    if (payloadsEqual(p, value)) return
    onDraftChangeRef.current(p)
  }

  return (
    <div className={`pred-bonus-row${isIncomplete ? ' pred-bonus-row--incomplete' : ''}`}>
      <label className="pred-bonus-label">{meta.labelEs}</label>
      {meta.control === 'team' ? (
        <div className="pred-bonus-controls">
          <select
            className="field-input pred-bonus-select"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            disabled={readOnly}
          >
            <option value="">— Elegir —</option>
            {teamOptions}
          </select>
        </div>
      ) : meta.control === 'boolean' ? (
        <div className="pred-bonus-controls pred-bonus-bool-stack">
          {value?.kind === 'text' && value.value.trim() ? (
            <span className="app-muted pred-bonus-bool-hint">
              Tenías texto guardado; elegí Sí o No.
            </span>
          ) : null}
          <div className="pred-bonus-bool-row">
            <button
              type="button"
              className={`btn-secondary pred-bonus-bool-btn${
                value?.kind === 'boolean' && value.value === true ? ' pred-bonus-bool-btn--yes-active' : ''
              }`}
              onClick={() => onBooleanPick(true)}
              disabled={readOnly}
            >
              Sí
            </button>
            <button
              type="button"
              className={`btn-secondary pred-bonus-bool-btn${
                value?.kind === 'boolean' && value.value === false ? ' pred-bonus-bool-btn--no-active' : ''
              }`}
              onClick={() => onBooleanPick(false)}
              disabled={readOnly}
            >
              No
            </button>
          </div>
        </div>
      ) : meta.control === 'match_ref' ? (
        <div className="pred-bonus-controls">
          <select
            className="field-input pred-bonus-select"
            value={matchId}
            onChange={(e) => setMatchId(e.target.value)}
            disabled={readOnly}
          >
            <option value="">— Elegir partido (partidos de tu predicción) —</option>
            {matchGroups.map(({ groupLabel, items }) => (
              <optgroup key={groupLabel} label={groupLabel}>
                {items.map((o) => (
                  <option key={o.matchId} value={o.matchId}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      ) : meta.control === 'range' && meta.rangeOptions?.length ? (
        <div className="pred-bonus-controls">
          <select
            className="field-input pred-bonus-select"
            value={rangeId}
            onChange={(e) => setRangeId(e.target.value)}
            disabled={readOnly}
          >
            <option value="">— Elegir franja —</option>
            {meta.rangeOptions.map((o) => (
              <option key={o.rangeId} value={o.rangeId}>
                {o.labelEs}
              </option>
            ))}
          </select>
        </div>
      ) : meta.control === 'group' ? (
        <div className="pred-bonus-controls">
          <select
            className="field-input pred-bonus-select"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            disabled={readOnly}
          >
            <option value="">— Grupo —</option>
            {groupIds.map((g) => (
              <option key={g} value={g}>
                Grupo {g}
              </option>
            ))}
          </select>
        </div>
      ) : meta.control === 'text' && meta.id === 'q_offense_most_lopsided_score' ? (
        <div className="pred-bonus-controls">
          <div
            className="pred-score-split pred-score-split--bonus pred-bonus-score-split"
            role="group"
            aria-label="Marcador"
            onFocusCapture={() => setScorePairFocused(true)}
            onBlurCapture={onScorePairBlurCapture}
          >
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={20}
              step={1}
              className="field-input pred-score-split-input"
              autoComplete="off"
              placeholder="0"
              value={scoreHome}
              onChange={(e) => setScoreHome(e.target.value)}
              aria-label="Goles local"
              disabled={readOnly}
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
              value={scoreAway}
              onChange={(e) => setScoreAway(e.target.value)}
              aria-label="Goles visita"
              disabled={readOnly}
            />
          </div>
        </div>
      ) : meta.control === 'text' && meta.id === 'q_fun_most_repeated_scoreline' ? (
        <div className="pred-bonus-controls">
          <div
            className="pred-score-split pred-score-split--bonus pred-bonus-score-split"
            role="group"
            aria-label="Marcador"
            onFocusCapture={() => setScorePairFocused(true)}
            onBlurCapture={onScorePairBlurCapture}
          >
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={20}
              step={1}
              className="field-input pred-score-split-input"
              autoComplete="off"
              placeholder="0"
              value={scoreHome}
              onChange={(e) => setScoreHome(e.target.value)}
              aria-label="Goles local"
              disabled={readOnly}
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
              value={scoreAway}
              onChange={(e) => setScoreAway(e.target.value)}
              aria-label="Goles visita"
              disabled={readOnly}
            />
          </div>
        </div>
      ) : meta.control === 'text' && meta.id === 'q_events_goals_extra_time' ? (
        <div className="pred-bonus-controls">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={999}
            step={1}
            className="field-input pred-bonus-text pred-bonus-number"
            value={extraTimeGoals}
            onChange={(e) => setExtraTimeGoals(e.target.value)}
            onFocus={() => setExtraTimeGoalsFocused(true)}
            onBlur={() => setExtraTimeGoalsFocused(false)}
            placeholder="0"
            disabled={readOnly}
          />
        </div>
      ) : meta.control === 'text' && meta.id === 'q_fun_own_goals_count' ? (
        <div className="pred-bonus-controls">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={99}
            step={1}
            className="field-input pred-bonus-text pred-bonus-number"
            value={ownGoalsCount}
            onChange={(e) => setOwnGoalsCount(e.target.value)}
            onFocus={() => setOwnGoalsCountFocused(true)}
            onBlur={() => setOwnGoalsCountFocused(false)}
            placeholder="0"
            disabled={readOnly}
          />
        </div>
      ) : (
        <div className="pred-bonus-controls">
          <input
            type="text"
            className="field-input pred-bonus-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setTextFocused(true)}
            onBlur={() => setTextFocused(false)}
            placeholder="Tu respuesta"
            disabled={readOnly}
          />
        </div>
      )}
      {isIncomplete ? (
        <p className="pred-bonus-missing-hint" role="status">
          Falta completar esta pregunta.
        </p>
      ) : null}
    </div>
  )
}
