import { useMemo } from 'react'
import type { MatchDoc, MatchPredictionPayload, PredictionDoc, TournamentPredictionPayload } from '../types/predictions'
import { scheduleOrder } from '../domain/matchCatalogOrder'
import {
  getChampionAndRunnerUpFromPredictions,
  getThirdAndFourthFromPredictions,
} from '../domain/bracketResolve'
import { EXTRA_IDS } from '../data/questionIds'
import { ALL_QUESTION_METAS, type QuestionMeta } from '../data/bonusQuestionsMeta'
import type { GroupDraftEntry } from './GroupStageSection'

function teamIdFromTournamentPred(payload: TournamentPredictionPayload | undefined): string | null {
  if (!payload || payload.kind !== 'team') return null
  const id = payload.teamId
  return typeof id === 'string' && id.length > 0 ? id : null
}

export function usePredictionReviewData(
  predictions: PredictionDoc[],
  matches: (MatchDoc & { id: string })[],
  enabledQuestionIds: Set<string> | null,
) {
  const predByMatchId = useMemo(() => {
    const m = new Map<string, MatchPredictionPayload>()
    for (const p of predictions) {
      if (p.scope === 'match' && p.matchId && p.payload && typeof p.payload === 'object') {
        const payload = p.payload as MatchPredictionPayload
        if (typeof payload.goalsTeamA === 'number' && typeof payload.goalsTeamB === 'number') {
          m.set(p.matchId, payload)
        }
      }
    }
    return m
  }, [predictions])

  const predByQuestionId = useMemo(() => {
    const m = new Map<string, TournamentPredictionPayload>()
    for (const p of predictions) {
      if (p.scope === 'tournament' && p.questionId && p.payload && typeof p.payload === 'object' && 'kind' in p.payload) {
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

  const draftGroup = useMemo(() => {
    const m = new Map<string, GroupDraftEntry>()
    for (const x of groupMatches) {
      const p = predByMatchId.get(x.id)
      m.set(x.id, {
        goalsHome: p?.goalsTeamA ?? 0,
        goalsAway: p?.goalsTeamB ?? 0,
      })
    }
    return m
  }, [groupMatches, predByMatchId])

  const filledGroupMatchIds = useMemo(() => {
    const s = new Set<string>()
    for (const [id, entry] of draftGroup) {
      if (
        typeof entry.goalsHome === 'number' &&
        typeof entry.goalsAway === 'number' &&
        entry.goalsHome >= 0 &&
        entry.goalsAway >= 0
      ) {
        s.add(id)
      }
    }
    return s
  }, [draftGroup])

  const groupPredForBracket = useMemo(() => {
    const m = new Map<string, MatchPredictionPayload>()
    for (const [id, p] of predByMatchId) {
      if (id.startsWith('wc26-') && !id.startsWith('wc26-ko-')) m.set(id, p)
    }
    return m
  }, [predByMatchId])

  const koPredByMatchId = useMemo(() => {
    const m = new Map<string, MatchPredictionPayload>()
    for (const [id, p] of predByMatchId) {
      if (id.startsWith('wc26-ko-')) m.set(id, p)
    }
    return m
  }, [predByMatchId])

  const matchesByKoId = useMemo(() => {
    const out = new Map<string, MatchDoc & { id: string }>()
    for (const x of matches) {
      if (x.id.startsWith('wc26-ko-')) out.set(x.id, x)
    }
    return out
  }, [matches])

  const { championId: derivedChampion, runnerUpId: derivedRunnerUp } = useMemo(
    () => getChampionAndRunnerUpFromPredictions(groupPredForBracket, koPredByMatchId),
    [groupPredForBracket, koPredByMatchId],
  )

  const { thirdId: derivedThird, fourthId: derivedFourth } = useMemo(
    () => getThirdAndFourthFromPredictions(groupPredForBracket, koPredByMatchId),
    [groupPredForBracket, koPredByMatchId],
  )

  const podiumIds = useMemo(
    () => ({
      firstId:
        teamIdFromTournamentPred(predByQuestionId.get(EXTRA_IDS.champion)) ?? derivedChampion,
      secondId:
        teamIdFromTournamentPred(predByQuestionId.get(EXTRA_IDS.runnerUp)) ?? derivedRunnerUp,
      thirdId:
        teamIdFromTournamentPred(predByQuestionId.get(EXTRA_IDS.thirdPlace)) ?? derivedThird,
      fourthId:
        teamIdFromTournamentPred(predByQuestionId.get(EXTRA_IDS.fourthPlace)) ?? derivedFourth,
    }),
    [
      predByQuestionId,
      derivedChampion,
      derivedRunnerUp,
      derivedThird,
      derivedFourth,
    ],
  )

  const activeQuestionMetas = useMemo<QuestionMeta[]>(() => {
    if (!enabledQuestionIds) return ALL_QUESTION_METAS
    return ALL_QUESTION_METAS.filter((meta) => enabledQuestionIds.has(meta.id))
  }, [enabledQuestionIds])

  const mergedBonusByQuestionId = useMemo(() => {
    const m = new Map<string, TournamentPredictionPayload>()
    for (const meta of activeQuestionMetas) {
      const p = predByQuestionId.get(meta.id)
      if (p) m.set(meta.id, p)
    }
    return m
  }, [activeQuestionMetas, predByQuestionId])

  const groupMatchIds = useMemo(() => new Set(groupMatches.map((x) => x.id)), [groupMatches])

  const filledOverall = useMemo(() => {
    let n = filledGroupMatchIds.size
    for (const id of koPredByMatchId.keys()) {
      const p = koPredByMatchId.get(id)
      if (p && typeof p.goalsTeamA === 'number' && typeof p.goalsTeamB === 'number') n++
    }
    return n
  }, [filledGroupMatchIds, koPredByMatchId])

  const totalOverall = useMemo(() => {
    const koTotal = matches.filter((m) => m.id.startsWith('wc26-ko-')).length
    return groupMatchIds.size + koTotal
  }, [groupMatchIds, matches])

  return {
    predByMatchId,
    predByQuestionId,
    matchesByGroup,
    draftGroup,
    filledGroupMatchIds,
    groupPredForBracket,
    koPredByMatchId,
    matchesByKoId,
    podiumIds,
    activeQuestionMetas,
    mergedBonusByQuestionId,
    filledOverall,
    totalOverall,
    groupMatches,
  }
}
