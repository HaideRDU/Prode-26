import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { User } from 'firebase/auth'
import { useMatchList } from '../hooks/useMatchList'
import { usePredictions } from '../hooks/usePredictions'
import { useTeamLabels } from '../hooks/useTeamLabels'
import {
  saveGroupPredictionsBatch,
  saveKoPredictionsBatch,
  saveTournamentPredictionsBatch,
} from '../services/predictionsService'
import {
  getGroupStageLocked,
  getPredictionFinalized,
  setGroupStageLocked,
  setPredictionFinalized,
} from '../services/predictionStateService'
import type { MatchDoc, MatchPredictionPayload, TournamentPredictionPayload } from '../types/predictions'
import { GROUP_STAGE_SCHEDULE } from '../data/wc2026/groupStageSchedule'
import { orderedGroupIds } from '../domain/groupStandings'
import {
  getChampionAndRunnerUpFromPredictions,
  getThirdAndFourthFromPredictions,
  resolveKoMatchTeams,
} from '../domain/bracketResolve'
import { buildKoPredictionsContext, canSaveKoMatch } from '../domain/koRoundSaveGate'
import { WC26_KO_MATCHES, koMatchDocId } from '../data/wc2026/knockoutBracket'
import { isCompleteMatchPredictionForPicker } from '../domain/matchPredictionComplete'
import { isBonusPayloadComplete } from '../domain/bonusAnswerComplete'
import { ALL_QUESTION_METAS } from '../data/bonusQuestionsMeta'
import { BONUS_QUESTION_IDS } from '../data/questionIds'
import { GroupStageSection, type GroupDraftEntry } from '../predictions/GroupStageSection'
import { PredictionScoringHelpBody } from '../predictions/PredictionScoringHelpBody'
import { KnockoutSection } from '../predictions/KnockoutSection'
import { BonusQuestionBank, type MatchPickOption } from '../predictions/BonusQuestionBank'
import { PodiumExtrasSection } from '../predictions/PodiumExtrasSection'
import '../predictions/pred-theme.css'

const scheduleOrder = new Map(GROUP_STAGE_SCHEDULE.map((r, i) => [r.matchId, i]))

const KO_ROUND_GROUP_LABEL: Record<string, string> = {
  r32: 'Dieciseisavos de final',
  r16: 'Octavos de final',
  qf: 'Cuartos de final',
  sf: 'Semifinales',
  third: 'Tercer puesto',
  final: 'Final',
}

function matchPickGroupLabel(m: MatchDoc & { id: string }): string {
  if (m.phase === 'group') return 'Fase de grupos'
  const r = m.round ?? ''
  return KO_ROUND_GROUP_LABEL[r] ?? 'Eliminatorias'
}

function matchPickSortKey(m: MatchDoc & { id: string }): number {
  if (m.phase === 'group') {
    const g = m.groupId ?? 'Z'
    const gIdx = orderedGroupIds().indexOf(g)
    const ord = scheduleOrder.get(m.id) ?? 999
    return (gIdx >= 0 ? gIdx : 99) * 1000 + ord
  }
  if (m.id.startsWith('wc26-ko-')) {
    const n = Number(m.id.slice('wc26-ko-'.length))
    return 100_000 + (Number.isFinite(n) ? n : 999)
  }
  return 200_000
}

function isDraftComplete(entry: GroupDraftEntry | undefined): boolean {
  if (!entry) return false
  return (
    typeof entry.goalsHome === 'number' &&
    typeof entry.goalsAway === 'number' &&
    !Number.isNaN(entry.goalsHome) &&
    !Number.isNaN(entry.goalsAway) &&
    entry.goalsHome >= 0 &&
    entry.goalsAway >= 0
  )
}

function hasNumericScorePrediction(pred: MatchPredictionPayload | undefined): pred is MatchPredictionPayload {
  return (
    !!pred &&
    typeof pred.goalsHome === 'number' &&
    typeof pred.goalsAway === 'number' &&
    !Number.isNaN(pred.goalsHome) &&
    !Number.isNaN(pred.goalsAway) &&
    pred.goalsHome >= 0 &&
    pred.goalsAway >= 0
  )
}

function formatMissingBonusLabels(labels: string[]): string {
  if (labels.length === 0) return ''
  if (labels.length <= 3) return labels.join(', ')
  const visible = labels.slice(0, 3).join(', ')
  const pending = labels.length - 3
  return `${visible} y ${pending} más`
}

export function RoomPredictionsPage({ user }: { user: User }) {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { matches, loading: loadingM, error: errM } = useMatchList()
  const { predictions, loading: loadingP, error: errP } = usePredictions(roomId, user.uid)
  const { label: teamLabel, loading: loadingT, error: errT } = useTeamLabels()
  const [koDraftOverrides, setKoDraftOverrides] = useState<Map<string, MatchPredictionPayload>>(
    () => new Map(),
  )
  const [bonusOverrides, setBonusOverrides] = useState<
    Map<string, TournamentPredictionPayload | null>
  >(() => new Map())
  const [savingAll, setSavingAll] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showRulesIntroModal, setShowRulesIntroModal] = useState(false)
  const [showScoringHelpModal, setShowScoringHelpModal] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [groupLocked, setGroupLocked] = useState(false)
  const [predictionFinalized, setPredictionFinalizedState] = useState<boolean | null>(null)
  const [draftGroup, setDraftGroup] = useState<Map<string, GroupDraftEntry>>(new Map())
  const draftInitRef = useRef(false)
  const roomDraftRef = useRef<string | null>(null)

  const predByMatchId = useMemo(() => {
    const m = new Map<string, MatchPredictionPayload>()
    for (const p of predictions) {
      if (p.scope === 'match' && p.matchId && 'goalsHome' in p.payload) {
        m.set(p.matchId, p.payload as MatchPredictionPayload)
      }
    }
    return m
  }, [predictions])

  const predByQuestionId = useMemo(() => {
    const m = new Map<string, TournamentPredictionPayload>()
    for (const p of predictions) {
      if (
        p.scope === 'tournament' &&
        p.questionId &&
        p.payload &&
        typeof p.payload === 'object' &&
        'kind' in p.payload
      ) {
        m.set(p.questionId, p.payload as TournamentPredictionPayload)
      }
    }
    return m
  }, [predictions])

  const groupMatches = useMemo(
    () => matches.filter((m) => m.phase === 'group' && m.groupId),
    [matches],
  )

  const matchesByGroup = useMemo(() => {
    const m = new Map<string, (MatchDoc & { id: string })[]>()
    for (const x of groupMatches) {
      const g = x.groupId ?? '?'
      if (!m.has(g)) m.set(g, [])
      m.get(g)!.push(x)
    }
    for (const [g, list] of m) {
      m.set(
        g,
        [...list].sort((a, b) => (scheduleOrder.get(a.id) ?? 999) - (scheduleOrder.get(b.id) ?? 999)),
      )
    }
    return m
  }, [groupMatches])

  const groupMatchIds = useMemo(() => new Set(groupMatches.map((x) => x.id)), [groupMatches])

  useEffect(() => {
    if (!roomId) return
    let cancelled = false
    getGroupStageLocked(user.uid, roomId)
      .then((locked) => {
        if (!cancelled) setGroupLocked(locked)
      })
      .catch(() => {
        if (!cancelled) setGroupLocked(false)
      })
    return () => {
      cancelled = true
    }
  }, [roomId, user.uid])

  useEffect(() => {
    if (!roomId) return
    let cancelled = false
    setPredictionFinalizedState(null)
    getPredictionFinalized(user.uid, roomId)
      .then((finalized) => {
        if (!cancelled) setPredictionFinalizedState(finalized)
      })
      .catch(() => {
        if (!cancelled) setPredictionFinalizedState(false)
      })
    return () => {
      cancelled = true
    }
  }, [roomId, user.uid])

  useEffect(() => {
    if (!roomId || predictionFinalized === null || predictionFinalized === true) {
      setShowRulesIntroModal(false)
      return
    }
    try {
      const key = `wc26_pred_rules_ack_${roomId}`
      if (typeof localStorage !== 'undefined' && localStorage.getItem(key)) {
        setShowRulesIntroModal(false)
      } else {
        setShowRulesIntroModal(true)
      }
    } catch {
      setShowRulesIntroModal(true)
    }
  }, [roomId, predictionFinalized])

  useEffect(() => {
    if (roomDraftRef.current !== roomId) {
      draftInitRef.current = false
      roomDraftRef.current = roomId ?? null
    }
  }, [roomId])

  useEffect(() => {
    setKoDraftOverrides(new Map())
    setBonusOverrides(new Map())
  }, [roomId])

  useEffect(() => {
    if (!roomId || loadingP || groupMatchIds.size === 0) return
    if (draftInitRef.current) return

    const m = new Map<string, GroupDraftEntry>()
    for (const id of groupMatchIds) {
      const p = predByMatchId.get(id)
      m.set(id, {
        goalsHome: p?.goalsHome ?? 0,
        goalsAway: p?.goalsAway ?? 0,
      })
    }
    setDraftGroup(m)
    draftInitRef.current = true
  }, [roomId, loadingP, groupMatchIds, predByMatchId])

  useEffect(() => {
    if (!groupLocked || groupMatchIds.size === 0) return
    const m = new Map<string, GroupDraftEntry>()
    for (const id of groupMatchIds) {
      const p = predByMatchId.get(id)
      m.set(id, { goalsHome: p?.goalsHome ?? 0, goalsAway: p?.goalsAway ?? 0 })
    }
    setDraftGroup(m)
  }, [groupLocked, groupMatchIds, predByMatchId])

  const finalizedResolved = predictionFinalized !== null
  const readOnly = predictionFinalized === true

  const onDraftChange = useCallback((matchId: string, gh: number | null, ga: number | null) => {
    if (readOnly || !finalizedResolved) return
    setDraftGroup((prev) => {
      const next = new Map(prev)
      next.set(matchId, { goalsHome: gh, goalsAway: ga })
      return next
    })
  }, [readOnly, finalizedResolved])

  const filledGroupMatchIds = useMemo(() => {
    const ids = new Set<string>()
    for (const id of groupMatchIds) {
      if (isDraftComplete(draftGroup.get(id))) ids.add(id)
    }
    return ids
  }, [groupMatchIds, draftGroup])

  const { incompleteGroupLabels, canSaveBatch } = useMemo(() => {
    const total = groupMatchIds.size
    const filled = filledGroupMatchIds.size
    const incompleteGroups = new Set<string>()
    for (const id of groupMatchIds) {
      if (filledGroupMatchIds.has(id)) continue
      const row = GROUP_STAGE_SCHEDULE.find((r) => r.matchId === id)
      if (row) incompleteGroups.add(row.groupId)
    }
    const canSave = total > 0 && filled === total
    return {
      incompleteGroupLabels: [...incompleteGroups].sort(),
      canSaveBatch: canSave,
    }
  }, [groupMatchIds, filledGroupMatchIds])

  const groupPredForBracket = useMemo(() => {
    const m = new Map<string, MatchPredictionPayload>()
    for (const id of groupMatchIds) {
      const d = draftGroup.get(id)
      const p = predByMatchId.get(id)
      const gh = typeof d?.goalsHome === 'number' ? d.goalsHome : (p?.goalsHome ?? 0)
      const ga = typeof d?.goalsAway === 'number' ? d.goalsAway : (p?.goalsAway ?? 0)
      m.set(id, { goalsHome: gh, goalsAway: ga })
    }
    return m
  }, [draftGroup, groupMatchIds, predByMatchId])

  const koPredByMatchId = useMemo(() => {
    const out = new Map<string, MatchPredictionPayload>()
    for (const [k, v] of predByMatchId) {
      if (k.startsWith('wc26-ko-')) out.set(k, v)
    }
    return out
  }, [predByMatchId])

  const mergedKoPredByMatchId = useMemo(() => {
    const m = new Map(koPredByMatchId)
    for (const [k, v] of koDraftOverrides) m.set(k, v)
    return m
  }, [koPredByMatchId, koDraftOverrides])

  const { filledOverall, totalOverall } = useMemo(() => {
    const groupFilled = filledGroupMatchIds.size
    const groupTotal = groupMatchIds.size
    const koTotal = WC26_KO_MATCHES.length
    const ctx = buildKoPredictionsContext(groupPredForBracket, mergedKoPredByMatchId)
    let koFilled = 0
    for (const def of WC26_KO_MATCHES) {
      const { homeId, awayId } = resolveKoMatchTeams(
        def.matchNum,
        ctx.tablesByGroup,
        ctx.thirdByMatchNum,
        ctx.winnerByMatchNum,
      )
      if (!homeId || !awayId) continue
      const id = koMatchDocId(def.matchNum)
      const pred = mergedKoPredByMatchId.get(id)
      if (isCompleteMatchPredictionForPicker(pred, 'knockout')) koFilled++
    }
    return {
      filledOverall: groupFilled + koFilled,
      totalOverall: groupTotal + koTotal,
    }
  }, [filledGroupMatchIds, groupMatchIds, groupPredForBracket, mergedKoPredByMatchId])

  const getMergedBonusPayload = useCallback(
    (questionId: string): TournamentPredictionPayload | undefined => {
      if (bonusOverrides.has(questionId)) {
        const o = bonusOverrides.get(questionId)
        return o === null ? undefined : o
      }
      return predByQuestionId.get(questionId)
    },
    [bonusOverrides, predByQuestionId],
  )

  const mergedBonusByQuestionId = useMemo(() => {
    const m = new Map<string, TournamentPredictionPayload>()
    for (const meta of ALL_QUESTION_METAS) {
      const p = getMergedBonusPayload(meta.id)
      if (p) m.set(meta.id, p)
    }
    return m
  }, [getMergedBonusPayload])

  const onBonusDraftChange = useCallback(
    (questionId: string, payload: TournamentPredictionPayload | null) => {
      if (readOnly || !finalizedResolved) return
      setBonusOverrides((prev) => {
        const next = new Map(prev)
        if (payload === null) next.set(questionId, null)
        else next.set(questionId, payload)
        return next
      })
    },
    [readOnly, finalizedResolved],
  )

  const onKoDraftChange = useCallback((matchId: string, payload: MatchPredictionPayload | null) => {
    if (readOnly || !finalizedResolved) return
    setKoDraftOverrides((prev) => {
      if (payload === null) {
        if (!prev.has(matchId)) return prev
        const next = new Map(prev)
        next.delete(matchId)
        return next
      }
      const cur = prev.get(matchId)
      if (
        cur &&
        cur.goalsHome === payload.goalsHome &&
        cur.goalsAway === payload.goalsAway &&
        cur.wentToPenalties === payload.wentToPenalties &&
        cur.penaltiesWinnerHome === payload.penaltiesWinnerHome
      ) {
        return prev
      }
      const next = new Map(prev)
      next.set(matchId, payload)
      return next
    })
  }, [readOnly, finalizedResolved])

  const matchesByKoId = useMemo(() => {
    const out = new Map<string, MatchDoc & { id: string }>()
    for (const x of matches) {
      if (x.id.startsWith('wc26-ko-')) out.set(x.id, x)
    }
    return out
  }, [matches])

  const { championId: suggestedChampionId, runnerUpId: suggestedRunnerUpId } = useMemo(
    () => getChampionAndRunnerUpFromPredictions(groupPredForBracket, mergedKoPredByMatchId),
    [groupPredForBracket, mergedKoPredByMatchId],
  )

  const { thirdId: suggestedThirdId, fourthId: suggestedFourthId } = useMemo(
    () => getThirdAndFourthFromPredictions(groupPredForBracket, mergedKoPredByMatchId),
    [groupPredForBracket, mergedKoPredByMatchId],
  )

  const bonusGroupIds = useMemo(() => orderedGroupIds(), [])

  const matchPickOptions = useMemo(() => {
    const ctx = buildKoPredictionsContext(groupPredForBracket, mergedKoPredByMatchId)
    const rows: (MatchPickOption & { sortKey: number })[] = []
    const seenMatchIds = new Set<string>()

    for (const m of matches) {
      let pred: MatchPredictionPayload | undefined
      if (m.phase === 'group') {
        const d = draftGroup.get(m.id)
        if (isDraftComplete(d)) pred = { goalsHome: d!.goalsHome!, goalsAway: d!.goalsAway! }
        else pred = predByMatchId.get(m.id)
      } else {
        pred = mergedKoPredByMatchId.get(m.id)
      }
      const numericPred = hasNumericScorePrediction(pred)
      let labelHomeId = m.teamHomeId
      let labelAwayId = m.teamAwayId
      let koResolved = false
      if (m.phase === 'knockout' && m.id.startsWith('wc26-ko-')) {
        const n = Number(m.id.slice('wc26-ko-'.length))
        if (Number.isFinite(n)) {
          const { homeId, awayId } = resolveKoMatchTeams(
            n,
            ctx.tablesByGroup,
            ctx.thirdByMatchNum,
            ctx.winnerByMatchNum,
          )
          koResolved = Boolean(homeId && awayId)
          if (homeId && awayId) {
            labelHomeId = homeId
            labelAwayId = awayId
          }
        }
      }
      const eligible = m.phase === 'group' || numericPred || koResolved
      if (!eligible) continue
      seenMatchIds.add(m.id)
      const h = teamLabel(labelHomeId)
      const a = teamLabel(labelAwayId)
      const tag =
        m.phase === 'group' && m.groupId
          ? `Grupo ${m.groupId}`
          : m.round
            ? m.round
            : 'KO'
      rows.push({
        matchId: m.id,
        label: `${h} vs ${a} · ${tag}`,
        groupLabel: matchPickGroupLabel(m),
        sortKey: matchPickSortKey(m),
      })
    }

    // Firestore puede no incluir documentos KO; el cuadro vive en WC26_KO_MATCHES (como KnockoutSection).
    for (const def of WC26_KO_MATCHES) {
      const matchId = koMatchDocId(def.matchNum)
      if (seenMatchIds.has(matchId)) continue
      const { homeId, awayId } = resolveKoMatchTeams(
        def.matchNum,
        ctx.tablesByGroup,
        ctx.thirdByMatchNum,
        ctx.winnerByMatchNum,
      )
      if (!homeId || !awayId) continue
      const synthetic: MatchDoc & { id: string } = {
        id: matchId,
        phase: 'knockout',
        round: def.round,
        teamHomeId: homeId,
        teamAwayId: awayId,
        goalsHome: null,
        goalsAway: null,
        scheduledAt: '',
        status: 'scheduled',
      }
      seenMatchIds.add(matchId)
      const h = teamLabel(homeId)
      const a = teamLabel(awayId)
      const tag = def.round
      rows.push({
        matchId,
        label: `${h} vs ${a} · ${tag}`,
        groupLabel: matchPickGroupLabel(synthetic),
        sortKey: matchPickSortKey(synthetic),
      })
    }

    rows.sort((x, y) => x.sortKey - y.sortKey)
    return rows.map(({ sortKey: _sk, ...rest }) => rest)
  }, [matches, draftGroup, predByMatchId, mergedKoPredByMatchId, teamLabel, groupPredForBracket])

  const { canSaveKoBatch, koResolvableCount } = useMemo(() => {
    const ctx = buildKoPredictionsContext(groupPredForBracket, mergedKoPredByMatchId)
    let resolvable = 0
    for (const def of WC26_KO_MATCHES) {
      const { homeId, awayId } = resolveKoMatchTeams(
        def.matchNum,
        ctx.tablesByGroup,
        ctx.thirdByMatchNum,
        ctx.winnerByMatchNum,
      )
      if (!homeId || !awayId) continue
      resolvable++
    }
    if (resolvable === 0) return { canSaveKoBatch: false, koResolvableCount: 0 }

    for (const def of WC26_KO_MATCHES) {
      const { homeId, awayId } = resolveKoMatchTeams(
        def.matchNum,
        ctx.tablesByGroup,
        ctx.thirdByMatchNum,
        ctx.winnerByMatchNum,
      )
      if (!homeId || !awayId) continue
      const id = koMatchDocId(def.matchNum)
      const pred = mergedKoPredByMatchId.get(id)
      if (!isCompleteMatchPredictionForPicker(pred, 'knockout')) {
        return { canSaveKoBatch: false, koResolvableCount: resolvable }
      }
      const gate = canSaveKoMatch({
        matchNum: def.matchNum,
        ctx,
        koPredByMatchId: mergedKoPredByMatchId,
      })
      if (!gate.ok) {
        return { canSaveKoBatch: false, koResolvableCount: resolvable }
      }
    }
    return { canSaveKoBatch: true, koResolvableCount: resolvable }
  }, [groupPredForBracket, mergedKoPredByMatchId])

  const missingBonusQuestions = useMemo(
    () =>
      ALL_QUESTION_METAS.filter((meta) => !isBonusPayloadComplete(meta, getMergedBonusPayload(meta.id))),
    [getMergedBonusPayload],
  )

  const allBonusComplete = missingBonusQuestions.length === 0
  const missingBonusLabels = useMemo(
    () => missingBonusQuestions.map((q) => q.labelEs),
    [missingBonusQuestions],
  )
  const missingBonusQuestionIds = useMemo(
    () => new Set(missingBonusQuestions.map((q) => q.id)),
    [missingBonusQuestions],
  )

  const canClickSave =
    finalizedResolved &&
    !readOnly &&
    canSaveBatch &&
    canSaveKoBatch &&
    allBonusComplete &&
    koResolvableCount > 0

  const saveBlockers = useMemo(() => {
    const out: string[] = []
    if (predictionFinalized === true) {
      out.push('Tu predicción ya está finalizada: solo podés previsualizar las respuestas.')
      return out
    }
    if (!finalizedResolved) {
      return out
    }
    if (!canSaveBatch) out.push('Completá todos los partidos de la fase de grupos.')
    if (koResolvableCount === 0) out.push('Todavía no hay cruces de eliminatorias resolubles para guardar.')
    if (koResolvableCount > 0 && !canSaveKoBatch) {
      out.push('Completá eliminatorias (si hay empate, elegí ganador por penales).')
    }
    if (!allBonusComplete) {
      out.push(`Faltan preguntas extra: ${formatMissingBonusLabels(missingBonusLabels)}.`)
    }
    return out
  }, [
    predictionFinalized,
    canSaveBatch,
    koResolvableCount,
    canSaveKoBatch,
    allBonusComplete,
    missingBonusLabels,
  ])

  async function handleSaveAll(): Promise<boolean> {
    if (!roomId || !canClickSave || savingAll) return false
    setSavingAll(true)
    setLocalError(null)
    try {
      if (!groupLocked) {
        const groupEntries: { matchId: string; payload: MatchPredictionPayload }[] = []
        for (const id of groupMatchIds) {
          const d = draftGroup.get(id)
          if (!isDraftComplete(d)) continue
          groupEntries.push({
            matchId: id,
            payload: { goalsHome: d!.goalsHome!, goalsAway: d!.goalsAway! },
          })
        }
        await saveGroupPredictionsBatch(roomId, user.uid, groupEntries)
        await setGroupStageLocked(user.uid, roomId, true)
        setGroupLocked(true)
      }

      const koEntries: { matchId: string; payload: MatchPredictionPayload }[] = []
      const ctx = buildKoPredictionsContext(groupPredForBracket, mergedKoPredByMatchId)
      for (const def of [...WC26_KO_MATCHES].sort((a, b) => a.matchNum - b.matchNum)) {
        const { homeId, awayId } = resolveKoMatchTeams(
          def.matchNum,
          ctx.tablesByGroup,
          ctx.thirdByMatchNum,
          ctx.winnerByMatchNum,
        )
        if (!homeId || !awayId) continue
        const id = koMatchDocId(def.matchNum)
        const pred = mergedKoPredByMatchId.get(id)
        if (!isCompleteMatchPredictionForPicker(pred, 'knockout')) {
          setLocalError('Completá todos los partidos eliminatorios con equipos definidos.')
          return false
        }
        const gate = canSaveKoMatch({
          matchNum: def.matchNum,
          ctx,
          koPredByMatchId: mergedKoPredByMatchId,
        })
        if (!gate.ok) {
          setLocalError(gate.message)
          return false
        }
        koEntries.push({ matchId: id, payload: pred! })
      }
      if (koEntries.length === 0) {
        setLocalError('No hay partidos KO con equipos definidos para guardar.')
        return false
      }
      await saveKoPredictionsBatch(roomId, user.uid, koEntries)

      const bonusEntries: { questionId: string; payload: TournamentPredictionPayload }[] = []
      for (const meta of ALL_QUESTION_METAS) {
        const p = getMergedBonusPayload(meta.id)
        if (!isBonusPayloadComplete(meta, p)) continue
        bonusEntries.push({ questionId: meta.id, payload: p! })
      }
      if (bonusEntries.length !== ALL_QUESTION_METAS.length) {
        setLocalError(`Faltan preguntas extra: ${formatMissingBonusLabels(missingBonusLabels)}.`)
        return false
      }
      await saveTournamentPredictionsBatch(roomId, user.uid, bonusEntries)

      setKoDraftOverrides(new Map())
      setBonusOverrides(new Map())
      return true
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Error al guardar la predicción')
      return false
    } finally {
      setSavingAll(false)
    }
  }

  async function handleConfirmSaveAndFinalize() {
    if (!roomId || readOnly || !finalizedResolved) return
    if (!canClickSave) {
      setLocalError(saveBlockers[0] ?? 'Completá tu predicción antes de finalizar.')
      return
    }
    setLocalError(null)
    try {
      const ok = await handleSaveAll()
      if (!ok) return
      await setPredictionFinalized(user.uid, roomId, true)
      setPredictionFinalizedState(true)
      setShowSaveModal(false)
      navigate(`/room/${roomId}/standings`, { replace: true })
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'No se pudo finalizar la predicción.')
    }
  }

  const showGlobalSaveBar =
    Boolean(roomId) && !loadingM && !loadingP && matches.length > 0 && finalizedResolved && !readOnly

  const pageBottomPad = showGlobalSaveBar
    ? 'calc(88px + env(safe-area-inset-bottom, 0px))'
    : undefined

  if (!roomId) return <p className="auth-error">Sala no válida</p>

  function handleAckRulesIntro() {
    if (roomId) {
      try {
        localStorage.setItem(`wc26_pred_rules_ack_${roomId}`, '1')
      } catch {
        /* ignore */
      }
    }
    setShowRulesIntroModal(false)
  }

  return (
    <main
      className="pred-wc26 pred-wc26-page"
      style={pageBottomPad ? { paddingBottom: pageBottomPad } : undefined}
    >
      <div className="pred-page">
      {showRulesIntroModal ? (
        <div className="modal-overlay pred-rules-modal-overlay" role="presentation">
          <div
            className="modal-card pred-rules-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pred-rules-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="pred-rules-title">Cómo funcionan las predicciones y los puntos</h2>
            </div>
            <div className="pred-rules-modal__body">
              <p className="auth-lead small" style={{ marginBottom: 12 }}>
                Tenés que completar <strong>todos</strong> los apartados: fase de grupos, eliminatorias,
                podio (campeón, subcampeón, etc.) y las <strong>{BONUS_QUESTION_IDS.length}</strong>{' '}
                preguntas del banco de extras. El botón inferior <strong>Guardar predicción</strong> persiste
                todo de una vez y, al confirmar, queda finalizada (no editable).
              </p>
              <PredictionScoringHelpBody variant="scoresWithWhenNote" />
            </div>
            <div className="button-group pred-save-modal-actions" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="btn-secondary pred-save-modal-btn pred-save-modal-btn--confirm"
                onClick={handleAckRulesIntro}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {showScoringHelpModal ? (
        <div className="modal-overlay pred-rules-modal-overlay" role="presentation">
          <div
            className="modal-card pred-rules-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pred-scoring-help-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="pred-scoring-help-title">Cómo suman los puntos</h2>
              <button
                type="button"
                className="modal-close"
                aria-label="Cerrar"
                onClick={() => setShowScoringHelpModal(false)}
              >
                ×
              </button>
            </div>
            <div className="pred-rules-modal__body">
              <PredictionScoringHelpBody variant="scores" />
            </div>
            <div className="button-group pred-save-modal-actions" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="btn-secondary pred-save-modal-btn pred-save-modal-btn--cancel"
                onClick={() => setShowScoringHelpModal(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <p className="app-muted" style={{ marginBottom: 16 }}>
        <Link to="/">Inicio</Link> ·{' '}
        <Link to={`/room/${roomId}/standings`}>Ver clasificación</Link>
      </p>
      <div className="page-title-with-help">
        <h1 className="app-page-title">Predicciones</h1>
        <button
          type="button"
          className="help-points-trigger"
          aria-label="Ver cómo suman los puntos"
          title="Cómo suman los puntos"
          onClick={() => setShowScoringHelpModal(true)}
        >
          ?
        </button>
      </div>
      <p className="auth-lead" style={{ textAlign: 'left', marginBottom: 16 }}>
        Completá fase de grupos, eliminatorias y todas las preguntas extra; un solo botón abajo guarda
        todo en Firestore (fase de grupos, cuadro KO y banco). Los puntos de partido se aplican cuando
        el resultado oficial exista en Firestore.
      </p>
      {!finalizedResolved ? (
        <p className="user-email">Cargando estado de predicción…</p>
      ) : null}
      {readOnly ? (
        <p className="auth-info">
          Predicción finalizada. Esta vista es solo lectura. Podés volver a clasificación cuando quieras.
        </p>
      ) : null}
      {(loadingM || loadingP || loadingT) && <p className="user-email">Cargando…</p>}
      {(errM || errP || errT) && <p className="auth-error">{errM || errP || errT}</p>}
      {localError && <p className="auth-error">{localError}</p>}
      {finalizedResolved && !readOnly && saveBlockers.length > 0 ? (
        <div className="app-muted" style={{ marginBottom: 12 }}>
          {saveBlockers.map((msg) => (
            <p key={msg} style={{ margin: 0 }}>
              • {msg}
            </p>
          ))}
        </div>
      ) : null}

      {groupMatches.length > 0 ? (
        <div className="pred-group-sticky-head pred-overall-progress-sticky" aria-live="polite">
          <div className="pred-group-progress">
            <div
              className="pred-group-progress-bar"
              role="progressbar"
              aria-valuenow={filledOverall}
              aria-valuemin={0}
              aria-valuemax={totalOverall}
              aria-label="Progreso de partidos: grupos y eliminatorias"
            >
              <div
                className="pred-group-progress-fill"
                style={{
                  width: `${totalOverall > 0 ? Math.round((filledOverall / totalOverall) * 100) : 0}%`,
                }}
              />
            </div>
            <span className="pred-group-progress-text">
              {filledOverall} / {totalOverall} partidos listos (grupos + eliminatorias)
            </span>
          </div>
          <p className="pred-overall-progress-hint app-muted" style={{ marginTop: 8, marginBottom: 0 }}>
            Grupos: marcador válido (incluye 0-0). Eliminatorias: si hay empate, elegí ganador en penales
            para contar el partido.
          </p>
          {incompleteGroupLabels.length > 0 && !(groupLocked || readOnly) ? (
            <p className="pred-group-hint app-muted" style={{ marginTop: 8, marginBottom: 0 }}>
              Faltan grupos en: <strong>{incompleteGroupLabels.join(', ')}</strong>
            </p>
          ) : null}
        </div>
      ) : null}

      {groupMatches.length > 0 ? (
        <GroupStageSection
          matchesByGroup={matchesByGroup}
          draftByMatchId={draftGroup}
          filledMatchIds={filledGroupMatchIds}
          onDraftChange={onDraftChange}
          teamLabel={teamLabel}
          groupLocked={groupLocked || readOnly}
        />
      ) : !loadingM && matches.length === 0 ? (
        <p className="app-muted">
          No hay partidos en la base de datos. Un administrador debe volcar `teams` y `matches` (p. ej.{' '}
          <code className="app-muted">npm run seed:wc2026-group-stage</code> con Firebase Admin).
        </p>
      ) : null}

      <KnockoutSection
        groupPredByMatchId={groupPredForBracket}
        koPredByMatchId={mergedKoPredByMatchId}
        matchesByKoId={matchesByKoId}
        teamLabel={teamLabel}
        onKoDraftChange={onKoDraftChange}
        readOnly={readOnly}
      />

      <PodiumExtrasSection
        user={user}
        roomId={roomId}
        teamLabel={teamLabel}
        firstId={suggestedChampionId}
        secondId={suggestedRunnerUpId}
        thirdId={suggestedThirdId}
        fourthId={suggestedFourthId}
      />

      <BonusQuestionBank
        mergedBonusByQuestionId={mergedBonusByQuestionId}
        matchPickOptions={matchPickOptions}
        groupIds={bonusGroupIds}
        onBonusDraftChange={onBonusDraftChange}
        incompleteQuestionIds={missingBonusQuestionIds}
        readOnly={readOnly}
      />

      {showGlobalSaveBar ? (
        <div className="pred-group-save-fixed" role="region" aria-label="Guardar predicción completa">
          <div className="pred-group-save-fixed__inner">
            <button
              type="button"
              className="pred-group-save-btn"
              disabled={!canClickSave || savingAll}
              onClick={() => setShowSaveModal(true)}
            >
              {savingAll ? 'Guardando…' : 'Guardar predicción'}
            </button>
          </div>
        </div>
      ) : null}
      {showSaveModal ? (
        <div className="modal-overlay" role="presentation">
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="save-pred-title">
            <div className="modal-header">
              <h2 id="save-pred-title">Guardar predicción</h2>
              <button
                type="button"
                className="modal-close"
                aria-label="Cerrar"
                onClick={() => setShowSaveModal(false)}
              >
                ×
              </button>
            </div>
            <p className="auth-lead small">
              ¿Quieres guardar tu predicción? Una vez guardada no podrás editarla, solo previsualizar tus
              respuestas.
            </p>
            <div className="button-group pred-save-modal-actions">
              <button
                type="button"
                className="btn-secondary pred-save-modal-btn pred-save-modal-btn--confirm"
                onClick={() => void handleConfirmSaveAndFinalize()}
                disabled={savingAll}
              >
                {savingAll ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                type="button"
                className="btn-secondary pred-save-modal-btn pred-save-modal-btn--cancel"
                onClick={() => setShowSaveModal(false)}
              >
                Volver
              </button>
            </div>
          </div>
        </div>
      ) : null}
      </div>
    </main>
  )
}
