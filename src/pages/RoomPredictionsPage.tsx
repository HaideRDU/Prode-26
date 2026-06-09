import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FirebaseError } from 'firebase/app'
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
import { scheduleOrder, tournamentCatalogSortKey } from '../domain/matchCatalogOrder'
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
import { ALL_QUESTION_METAS, type QuestionMeta } from '../data/bonusQuestionsMeta'
import { getRoom } from '../services/roomsService'
import { DEFAULT_RULESET, getGeneralPredictionsLockAt } from '../config/ruleset'
import { useMatchTimeFormatters } from '../hooks/useUserTimeZone'
import { formatTimeZoneShort } from '../utils/formatMatchTime'
import { GroupStageSection, type GroupDraftEntry } from '../predictions/GroupStageSection'
import { PredictionScoringHelpBody } from '../predictions/PredictionScoringHelpBody'
import { KnockoutSection, type KnockoutLayoutMode } from '../predictions/KnockoutSection'
import { BonusQuestionBank, type MatchPickOption } from '../predictions/BonusQuestionBank'
import { PodiumExtrasSection } from '../predictions/PodiumExtrasSection'
import { TournamentSpecialPlayersSection } from '../predictions/TournamentSpecialPlayersSection'
import { PlayerPerMatchStrip } from '../predictions/PlayerPerMatchStrip'
import { ModalPortal } from '../components/ModalPortal'
import '../predictions/pred-theme.css'


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

const matchPickSortKey = tournamentCatalogSortKey

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
  if (!pred) return false
  const goalsTeamA = pred.goalsTeamA
  const goalsTeamB = pred.goalsTeamB
  return (
    typeof goalsTeamA === 'number' &&
    typeof goalsTeamB === 'number' &&
    !Number.isNaN(goalsTeamA) &&
    !Number.isNaN(goalsTeamB) &&
    goalsTeamA >= 0 &&
    goalsTeamB >= 0
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
  const { formatMatchTime, timeZone: userTimeZone } = useMatchTimeFormatters()
  const [koDraftOverrides, setKoDraftOverrides] = useState<Map<string, MatchPredictionPayload>>(
    () => new Map(),
  )
  const [bonusOverrides, setBonusOverrides] = useState<
    Map<string, TournamentPredictionPayload | null>
  >(() => new Map())
  const [savingAll, setSavingAll] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveModalError, setSaveModalError] = useState<string | null>(null)
  const [showRulesIntroModal, setShowRulesIntroModal] = useState(false)
  const [showScoringHelpModal, setShowScoringHelpModal] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [groupLocked, setGroupLocked] = useState(false)
  const [predictionFinalized, setPredictionFinalizedState] = useState<boolean | null>(null)
  const [enabledQuestionIds, setEnabledQuestionIds] = useState<Set<string> | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [draftGroup, setDraftGroup] = useState<Map<string, GroupDraftEntry>>(new Map())
  const draftInitRef = useRef(false)
  const roomDraftRef = useRef<string | null>(null)
  const prevMatchPredCountRef = useRef(0)

  const predByMatchId = useMemo(() => {
    const m = new Map<string, MatchPredictionPayload>()
    for (const p of predictions) {
      if (
        p.scope === 'match' &&
        p.matchId &&
        p.payload &&
        typeof p.payload === 'object' &&
        'goalsTeamA' in p.payload &&
        'goalsTeamB' in p.payload
      ) {
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
    if (!roomId) {
      setEnabledQuestionIds(null)
      return
    }
    let cancelled = false
    getRoom(roomId)
      .then((room) => {
        if (cancelled) return
        if (!room || room.type !== 'private') {
          setEnabledQuestionIds(null)
          return
        }
        setEnabledQuestionIds(
          Array.isArray(room.enabledQuestionIds) ? new Set(room.enabledQuestionIds) : new Set(),
        )
      })
      .catch(() => {
        if (!cancelled) setEnabledQuestionIds(null)
      })
    return () => {
      cancelled = true
    }
  }, [roomId])

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
    const t = window.setInterval(() => setNowMs(Date.now()), 30_000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    setKoDraftOverrides(new Map())
    setBonusOverrides(new Map())
    prevMatchPredCountRef.current = 0
  }, [roomId])

  useEffect(() => {
    if (!roomId || loadingP) return
    const currentCount = predByMatchId.size
    const previousCount = prevMatchPredCountRef.current
    if (previousCount > 0 && currentCount === 0) {
      const resetDraft = new Map<string, GroupDraftEntry>()
      for (const id of groupMatchIds) {
        resetDraft.set(id, { goalsHome: 0, goalsAway: 0 })
      }
      setDraftGroup(resetDraft)
      setKoDraftOverrides(new Map())
      setBonusOverrides(new Map())
    }
    prevMatchPredCountRef.current = currentCount
  }, [roomId, loadingP, predByMatchId, groupMatchIds])

  useEffect(() => {
    if (!roomId || loadingP || groupMatchIds.size === 0) return
    if (draftInitRef.current) return

    const m = new Map<string, GroupDraftEntry>()
    for (const id of groupMatchIds) {
      const p = predByMatchId.get(id)
      m.set(id, {
        goalsHome: p?.goalsTeamA ?? 0,
        goalsAway: p?.goalsTeamB ?? 0,
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
      m.set(id, {
        goalsHome: p?.goalsTeamA ?? 0,
        goalsAway: p?.goalsTeamB ?? 0,
      })
    }
    setDraftGroup(m)
  }, [groupLocked, groupMatchIds, predByMatchId])

  const finalizedResolved = predictionFinalized !== null
  const generalLockAt = useMemo(() => getGeneralPredictionsLockAt(DEFAULT_RULESET), [])
  const hasFinishedMatches = useMemo(
    () => matches.some((m) => m.status === 'finished'),
    [matches],
  )
  const lateEntryBlocked = hasFinishedMatches && predictionFinalized !== true
  const readOnly = predictionFinalized === true || lateEntryBlocked
  /** Sin finalizar: cascada grupos → KO; finalizada: podio → KO (final abajo) → grupos. */
  const isReviewLayout = predictionFinalized === true
  const showMatchPoints = predictionFinalized === true
  const knockoutLayoutMode: KnockoutLayoutMode = isReviewLayout ? 'review' : 'cascade'
  const sectionGroups = isReviewLayout ? 3 : 1
  const sectionKnockout = 2
  const sectionPodium = isReviewLayout ? 1 : 3
  const sectionExtras = 4

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

  const hasPredictionDraft = useMemo(
    () =>
      predictions.length > 0 ||
      groupLocked ||
      filledGroupMatchIds.size > 0 ||
      koDraftOverrides.size > 0 ||
      bonusOverrides.size > 0,
    [
      predictions.length,
      groupLocked,
      filledGroupMatchIds.size,
      koDraftOverrides.size,
      bonusOverrides.size,
    ],
  )
  const generalPredictionsLocked =
    nowMs >= generalLockAt.getTime() && predictionFinalized !== true && !hasPredictionDraft

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
      const gh = typeof d?.goalsHome === 'number' ? d.goalsHome : (p?.goalsTeamA ?? 0)
      const ga = typeof d?.goalsAway === 'number' ? d.goalsAway : (p?.goalsTeamB ?? 0)
      m.set(id, { goalsTeamA: gh, goalsTeamB: ga })
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
      const { teamAId, teamBId } = resolveKoMatchTeams(
        def.matchNum,
        ctx.tablesByGroup,
        ctx.thirdByMatchNum,
        ctx.winnerByMatchNum,
      )
      if (!teamAId || !teamBId) continue
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

  const activeQuestionMetas = useMemo<QuestionMeta[]>(() => {
    if (!enabledQuestionIds) return ALL_QUESTION_METAS
    return ALL_QUESTION_METAS.filter((meta) => enabledQuestionIds.has(meta.id))
  }, [enabledQuestionIds])
  const hasActiveBonusQuestions = activeQuestionMetas.length > 0

  const mergedBonusByQuestionId = useMemo(() => {
    const m = new Map<string, TournamentPredictionPayload>()
    for (const meta of activeQuestionMetas) {
      const p = getMergedBonusPayload(meta.id)
      if (p) m.set(meta.id, p)
    }
    return m
  }, [activeQuestionMetas, getMergedBonusPayload])

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
      const curA = cur?.goalsTeamA
      const curB = cur?.goalsTeamB
      const payA = payload.goalsTeamA
      const payB = payload.goalsTeamB
      if (
        cur &&
        curA === payA &&
        curB === payB &&
        cur.wentToPenalties === payload.wentToPenalties &&
        cur.penaltiesWinnerTeamA === payload.penaltiesWinnerTeamA &&
        cur.penaltiesWinnerTeamB === payload.penaltiesWinnerTeamB
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
        if (isDraftComplete(d)) pred = { goalsTeamA: d!.goalsHome!, goalsTeamB: d!.goalsAway! }
        else pred = predByMatchId.get(m.id)
      } else {
        pred = mergedKoPredByMatchId.get(m.id)
      }
      const numericPred = hasNumericScorePrediction(pred)
      let labelTeamAId = m.teamAId
      let labelTeamBId = m.teamBId
      let koResolved = false
      if (m.phase === 'knockout' && m.id.startsWith('wc26-ko-')) {
        const n = Number(m.id.slice('wc26-ko-'.length))
        if (Number.isFinite(n)) {
          const { teamAId, teamBId } = resolveKoMatchTeams(
            n,
            ctx.tablesByGroup,
            ctx.thirdByMatchNum,
            ctx.winnerByMatchNum,
          )
          koResolved = Boolean(teamAId && teamBId)
          if (teamAId && teamBId) {
            labelTeamAId = teamAId
            labelTeamBId = teamBId
          }
        }
      }
      const eligible = m.phase === 'group' || numericPred || koResolved
      if (!eligible) continue
      seenMatchIds.add(m.id)
      const h = teamLabel(labelTeamAId)
      const a = teamLabel(labelTeamBId)
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
      const { teamAId, teamBId } = resolveKoMatchTeams(
        def.matchNum,
        ctx.tablesByGroup,
        ctx.thirdByMatchNum,
        ctx.winnerByMatchNum,
      )
      if (!teamAId || !teamBId) continue
      const synthetic: MatchDoc & { id: string } = {
        id: matchId,
        phase: 'knockout',
        round: def.round,
        teamAId,
        teamBId,
        teamHomeId: teamAId,
        teamAwayId: teamBId,
        goalsTeamA: null,
        goalsTeamB: null,
        goalsHome: null,
        goalsAway: null,
        scheduledAt: '',
        status: 'scheduled',
      }
      seenMatchIds.add(matchId)
      const h = teamLabel(teamAId)
      const a = teamLabel(teamBId)
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
      const { teamAId, teamBId } = resolveKoMatchTeams(
        def.matchNum,
        ctx.tablesByGroup,
        ctx.thirdByMatchNum,
        ctx.winnerByMatchNum,
      )
      if (!teamAId || !teamBId) continue
      resolvable++
    }
    if (resolvable === 0) return { canSaveKoBatch: false, koResolvableCount: 0 }

    for (const def of WC26_KO_MATCHES) {
      const { teamAId, teamBId } = resolveKoMatchTeams(
        def.matchNum,
        ctx.tablesByGroup,
        ctx.thirdByMatchNum,
        ctx.winnerByMatchNum,
      )
      if (!teamAId || !teamBId) continue
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
      activeQuestionMetas.filter((meta) => !isBonusPayloadComplete(meta, getMergedBonusPayload(meta.id))),
    [activeQuestionMetas, getMergedBonusPayload],
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
    !generalPredictionsLocked &&
    canSaveBatch &&
    canSaveKoBatch &&
    allBonusComplete &&
    koResolvableCount > 0

  const canOpenSaveModal = canClickSave && !savingAll

  useEffect(() => {
    if (!canOpenSaveModal) setShowSaveModal(false)
  }, [canOpenSaveModal])

  const saveBlockers = useMemo(() => {
    const out: string[] = []
    if (predictionFinalized === true) {
      out.push('Tu predicción ya está finalizada: solo podés previsualizar las respuestas.')
      return out
    }
    if (generalPredictionsLocked) {
      out.push(
        `Las predicciones generales están cerradas desde ${formatMatchTime(generalLockAt)} (tu zona: ${formatTimeZoneShort(userTimeZone)}).`,
      )
      return out
    }
    if (lateEntryBlocked) {
      out.push(
        'Ya hay partidos con resultado oficial. No podés crear ni modificar una predicción nueva en esta sala.',
      )
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
    generalPredictionsLocked,
    lateEntryBlocked,
    generalLockAt,
    formatMatchTime,
    userTimeZone,
    canSaveBatch,
    koResolvableCount,
    canSaveKoBatch,
    allBonusComplete,
    missingBonusLabels,
  ])

  function normalizeSaveError(err: unknown, fallback: string, step?: string): string {
    if (err instanceof FirebaseError && err.code === 'permission-denied') {
      const finalizedHint =
        predictionFinalized === true
          ? ' Tu predicción ya figura como finalizada en el servidor.'
          : ''
      return (
        `${step ? `${step}: ` : ''}Firestore rechazó el guardado (permisos).` +
        `${finalizedHint} El administrador debe ejecutar \`npm run deploy:firestore-rules\` ` +
        `en el proyecto polla-mundialist. Si el error persiste, cerrá sesión y volvé a entrar.`
      )
    }
    const msg = err instanceof Error ? err.message : fallback
    return step ? `${step}: ${msg}` : msg
  }

  function reportSaveFailure(message: string) {
    setLocalError(message)
    setSaveModalError(message)
  }

  function openSaveModal() {
    if (!canOpenSaveModal) return
    setSaveModalError(null)
    setLocalError(null)
    setShowSaveModal(true)
  }

  function closeSaveModal() {
    setShowSaveModal(false)
    setSaveModalError(null)
  }

  async function handleSaveAll(): Promise<boolean> {
    if (!roomId || savingAll) return false
    if (!canClickSave) {
      reportSaveFailure(saveBlockers[0] ?? 'Completá tu predicción antes de finalizar.')
      return false
    }
    setSavingAll(true)
    setLocalError(null)
    setSaveModalError(null)
    try {
      if (!groupLocked) {
        const groupEntries: { matchId: string; payload: MatchPredictionPayload }[] = []
        for (const id of groupMatchIds) {
          const d = draftGroup.get(id)
          if (!isDraftComplete(d)) continue
          groupEntries.push({
            matchId: id,
            payload: { goalsTeamA: d!.goalsHome!, goalsTeamB: d!.goalsAway! },
          })
        }
        try {
          await saveGroupPredictionsBatch(roomId, user.uid, groupEntries)
          await setGroupStageLocked(user.uid, roomId, true)
          setGroupLocked(true)
        } catch (e) {
          reportSaveFailure(normalizeSaveError(e, 'Error al guardar grupos', 'Fase de grupos'))
          return false
        }
      }

      const koEntries: { matchId: string; payload: MatchPredictionPayload }[] = []
      const ctx = buildKoPredictionsContext(groupPredForBracket, mergedKoPredByMatchId)
      for (const def of [...WC26_KO_MATCHES].sort((a, b) => a.matchNum - b.matchNum)) {
        const { teamAId, teamBId } = resolveKoMatchTeams(
          def.matchNum,
          ctx.tablesByGroup,
          ctx.thirdByMatchNum,
          ctx.winnerByMatchNum,
        )
        if (!teamAId || !teamBId) continue
        const id = koMatchDocId(def.matchNum)
        const pred = mergedKoPredByMatchId.get(id)
        if (!isCompleteMatchPredictionForPicker(pred, 'knockout')) {
          reportSaveFailure('Completá todos los partidos eliminatorios con equipos definidos.')
          return false
        }
        const gate = canSaveKoMatch({
          matchNum: def.matchNum,
          ctx,
          koPredByMatchId: mergedKoPredByMatchId,
        })
        if (!gate.ok) {
          reportSaveFailure(gate.message)
          return false
        }
        koEntries.push({ matchId: id, payload: pred! })
      }
      if (koEntries.length === 0) {
        reportSaveFailure('No hay partidos KO con equipos definidos para guardar.')
        return false
      }
      try {
        await saveKoPredictionsBatch(roomId, user.uid, koEntries)
      } catch (e) {
        reportSaveFailure(normalizeSaveError(e, 'Error al guardar eliminatorias', 'Eliminatorias'))
        return false
      }

      const bonusEntries: { questionId: string; payload: TournamentPredictionPayload }[] = []
      for (const meta of activeQuestionMetas) {
        const p = getMergedBonusPayload(meta.id)
        if (!isBonusPayloadComplete(meta, p)) continue
        bonusEntries.push({ questionId: meta.id, payload: p! })
      }
      if (bonusEntries.length !== activeQuestionMetas.length) {
        reportSaveFailure(`Faltan preguntas extra: ${formatMissingBonusLabels(missingBonusLabels)}.`)
        return false
      }
      try {
        await saveTournamentPredictionsBatch(roomId, user.uid, bonusEntries)
      } catch (e) {
        reportSaveFailure(normalizeSaveError(e, 'Error al guardar preguntas extra', 'Preguntas extra'))
        return false
      }

      setKoDraftOverrides(new Map())
      setBonusOverrides(new Map())
      return true
    } catch (e) {
      reportSaveFailure(normalizeSaveError(e, 'Error al guardar la predicción'))
      return false
    } finally {
      setSavingAll(false)
    }
  }

  async function handleConfirmSaveAndFinalize() {
    if (!roomId || readOnly || !finalizedResolved) return
    if (!canClickSave) {
      reportSaveFailure(saveBlockers[0] ?? 'Completá tu predicción antes de finalizar.')
      return
    }
    setLocalError(null)
    setSaveModalError(null)
    try {
      const ok = await handleSaveAll()
      if (!ok) return
      try {
        await setPredictionFinalized(user.uid, roomId, true)
      } catch (e) {
        reportSaveFailure(normalizeSaveError(e, 'No se pudo finalizar la predicción.', 'Finalizar'))
        return
      }
      setPredictionFinalizedState(true)
      closeSaveModal()
      navigate(`/room/${roomId}/standings`, { replace: true })
    } catch (e) {
      reportSaveFailure(normalizeSaveError(e, 'No se pudo finalizar la predicción.'))
    }
  }

  const showGlobalSaveBar =
    Boolean(roomId) &&
    !loadingM &&
    !loadingP &&
    matches.length > 0 &&
    finalizedResolved &&
    !readOnly &&
    !generalPredictionsLocked

  const showStandingsFab =
    Boolean(roomId) && finalizedResolved && !loadingM && !loadingP && matches.length > 0

  const pageBottomPad = showGlobalSaveBar
    ? 'calc(148px + env(safe-area-inset-bottom, 0px))'
    : showStandingsFab
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
      {showStandingsFab ? (
        <button
          type="button"
          className={`room-standings-fab-predictions${showGlobalSaveBar ? ' room-standings-fab-predictions--above-save' : ''}`}
          aria-label="Ir a ver la clasificación"
          onClick={() => navigate(`/room/${roomId}/standings`)}
        >
          Ver clasificación
        </button>
      ) : null}
      <div className="pred-page pred-page-card">
      {showRulesIntroModal ? (
        <ModalPortal>
          <div
            className="pred-wc26 modal-overlay pred-rules-modal-overlay app-modal-portal-overlay"
            role="presentation"
          >
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
                Tenés que completar <strong>todos</strong> los apartados: fase de grupos, eliminatorias y
                podio (campeón, subcampeón, etc.)
                {hasActiveBonusQuestions ? (
                  <>
                    {', '}más las <strong>{activeQuestionMetas.length}</strong> preguntas del banco de extras
                  </>
                ) : null}
                . El botón inferior <strong>Guardar predicción</strong> persiste todo de una vez y, al
                confirmar, queda finalizada (no editable).
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
        </ModalPortal>
      ) : null}
      {showScoringHelpModal ? (
        <ModalPortal>
          <div
            className="pred-wc26 modal-overlay pred-rules-modal-overlay app-modal-portal-overlay"
            role="presentation"
          >
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
        </ModalPortal>
      ) : null}
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
        {isReviewLayout ? (
          <>
            Orden de lectura: <strong>podio</strong>, <strong>eliminatorias</strong> (de la final hacia
            dieciseisavos), <strong>grupos</strong>
          </>
        ) : (
          <>
            Orden sugerido (cascada): <strong>grupos</strong>, luego <strong>eliminatorias</strong> (dieciseisavos →
            octavos → cuartos → semifinal → final), <strong>podio</strong>
          </>
        )}
        {hasActiveBonusQuestions ? (
          <>
            {' '}
            y <strong>preguntas especiales</strong>
          </>
        ) : (
          '.'
        )}
        . En KO, si hay empate elegí ganador por penales. Al terminar, usá <strong>Guardar predicción</strong>.
      </p>
      <PlayerPerMatchStrip matches={matches} teamLabel={teamLabel} />
      {!finalizedResolved ? (
        <p className="user-email">Cargando estado de predicción…</p>
      ) : null}
      {readOnly ? (
        <p className="auth-info">
          {predictionFinalized === true
            ? 'Predicción finalizada. Esta vista es solo lectura. Podés volver a clasificación cuando quieras.'
            : lateEntryBlocked
              ? 'Ya hay partidos con resultado en el torneo. No podés abrir ni cambiar una predicción en esta sala.'
              : `Predicciones bloqueadas por ventana de cierre (${DEFAULT_RULESET.versionLabel}).`}
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

      {isReviewLayout ? (
        <>
          <PodiumExtrasSection
            user={user}
            roomId={roomId}
            teamLabel={teamLabel}
            firstId={suggestedChampionId}
            secondId={suggestedRunnerUpId}
            thirdId={suggestedThirdId}
            fourthId={suggestedFourthId}
            sectionIndex={sectionPodium}
            readOnly={readOnly}
          />
          <KnockoutSection
            groupPredByMatchId={groupPredForBracket}
            koPredByMatchId={mergedKoPredByMatchId}
            matchesByKoId={matchesByKoId}
            teamLabel={teamLabel}
            onKoDraftChange={onKoDraftChange}
            readOnly={readOnly}
            layoutMode={knockoutLayoutMode}
            sectionIndex={sectionKnockout}
            showPoints={showMatchPoints}
          />
          {groupMatches.length > 0 ? (
            <GroupStageSection
              matchesByGroup={matchesByGroup}
              draftByMatchId={draftGroup}
              filledMatchIds={filledGroupMatchIds}
              onDraftChange={onDraftChange}
              teamLabel={teamLabel}
              groupLocked={groupLocked || readOnly}
              sectionIndex={sectionGroups}
              showPoints={showMatchPoints}
            />
          ) : !loadingM && matches.length === 0 ? (
            <p className="app-muted">
              No hay partidos en la base de datos. Un administrador debe volcar `teams` y `matches` (p. ej.{' '}
              <code className="app-muted">npm run seed:wc2026-group-stage</code> con Firebase Admin).
            </p>
          ) : null}
        </>
      ) : (
        <>
          {groupMatches.length > 0 ? (
            <GroupStageSection
              matchesByGroup={matchesByGroup}
              draftByMatchId={draftGroup}
              filledMatchIds={filledGroupMatchIds}
              onDraftChange={onDraftChange}
              teamLabel={teamLabel}
              groupLocked={groupLocked || readOnly}
              sectionIndex={sectionGroups}
              showPoints={showMatchPoints}
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
            layoutMode={knockoutLayoutMode}
            sectionIndex={sectionKnockout}
            showPoints={showMatchPoints}
          />
          <PodiumExtrasSection
            user={user}
            roomId={roomId}
            teamLabel={teamLabel}
            firstId={suggestedChampionId}
            secondId={suggestedRunnerUpId}
            thirdId={suggestedThirdId}
            fourthId={suggestedFourthId}
            sectionIndex={sectionPodium}
            readOnly={readOnly}
          />
        </>
      )}

      <TournamentSpecialPlayersSection
        roomId={roomId}
        userId={user.uid}
        predByQuestionId={predByQuestionId}
        readOnly={readOnly}
      />

      {hasActiveBonusQuestions ? (
        <BonusQuestionBank
          questionMetas={activeQuestionMetas}
          mergedBonusByQuestionId={mergedBonusByQuestionId}
          matchPickOptions={matchPickOptions}
          groupIds={bonusGroupIds}
          onBonusDraftChange={onBonusDraftChange}
          incompleteQuestionIds={missingBonusQuestionIds}
          readOnly={readOnly}
          sectionIndex={sectionExtras}
        />
      ) : null}

      {showGlobalSaveBar ? (
        <div className="pred-group-save-fixed" role="region" aria-label="Guardar predicción completa">
          <div className="pred-group-save-fixed__inner">
            <button
              type="button"
              className="pred-group-save-btn"
              disabled={!canOpenSaveModal}
              aria-disabled={!canOpenSaveModal}
              title={
                !canClickSave && saveBlockers[0] ? saveBlockers[0] : undefined
              }
              onClick={openSaveModal}
            >
              {savingAll ? 'Guardando…' : 'Guardar predicción'}
            </button>
          </div>
        </div>
      ) : null}
      {showSaveModal ? (
        <ModalPortal>
          <div
            className="pred-wc26 modal-overlay pred-rules-modal-overlay save-prediction-modal-overlay app-modal-portal-overlay"
            role="presentation"
            onClick={closeSaveModal}
          >
            <div
              className="modal-card pred-rules-modal save-prediction-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="save-pred-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2 id="save-pred-title">Guardar predicción</h2>
                <button type="button" className="modal-close" aria-label="Cerrar" onClick={closeSaveModal}>
                  ×
                </button>
              </div>
              <div className="pred-rules-modal__body save-prediction-modal__body">
                <p className="auth-lead small">
                  ¿Quieres guardar tu predicción? Una vez guardada no podrás editarla, solo previsualizar tus
                  respuestas.
                </p>
                {saveModalError ? <p className="auth-error">{saveModalError}</p> : null}
              </div>
              <div className="button-group pred-save-modal-actions save-prediction-modal__footer">
                <button
                  type="button"
                  className="btn-secondary pred-save-modal-btn pred-save-modal-btn--confirm"
                  onClick={() => void handleConfirmSaveAndFinalize()}
                  disabled={!canOpenSaveModal}
                >
                  {savingAll ? 'Guardando…' : 'Guardar'}
                </button>
                <button
                  type="button"
                  className="btn-secondary pred-save-modal-btn pred-save-modal-btn--cancel"
                  onClick={closeSaveModal}
                  disabled={savingAll}
                >
                  Volver
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      ) : null}
      </div>
    </main>
  )
}
