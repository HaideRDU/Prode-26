import type { Firestore } from 'firebase-admin/firestore'
import * as logger from 'firebase-functions/logger'
import { isMatchInPollingWindow, shouldRunScheduledSync } from '../apiSports/matchWindow'
import { scorersChanged } from '../theSportsDb/fetchScorers'
import { mergeScorerEntries, scorersIncompleteForScore } from '../lib/scorerSync'
import type { MatchDoc, MatchScorerEntry, MatchStatus } from '../lib/types/predictions'
import { fetchFifaLiveMatch, fetchScorersFromFifaLive } from './fetchScorers'

const FIFA_MATCHES_URL =
  'https://api.fifa.com/api/v3/calendar/matches?language=es&count=500&idCompetition=17&from=2026-06-01&to=2026-07-31'

type FifaTeam = {
  Abbreviation?: string
  Score?: number | null
}

type FifaLocalized = {
  Description?: string
}

type FifaMatch = {
  Date?: string
  GroupName?: FifaLocalized[]
  Home?: FifaTeam & { IdCountry?: string }
  Away?: FifaTeam & { IdCountry?: string }
  HomeTeamScore?: number | null
  AwayTeamScore?: number | null
  MatchNumber?: number
  MatchStatus?: number
  MatchTime?: string | null
  ResultType?: number | null
  IdMatch?: string
  IdStage?: string
  IdSeason?: string
}

type FifaResponse = {
  Results?: FifaMatch[]
}

type FifaGroupMatch = {
  dateIso: string
  groupId: string
  homeTeamId: string
  awayTeamId: string
  homeGoals: number | null
  awayGoals: number | null
  status: MatchStatus
  idMatch: string
  idStage: string
  idSeason: string
}

type FifaMatchUpdate = {
  scheduledAt: Date
  goalsTeamA: number | null
  goalsTeamB: number | null
  status: MatchStatus
  goalsHome: number | null
  goalsAway: number | null
  finishedAt?: Date
  scorers?: MatchScorerEntry[]
}

export interface SyncFifaResult {
  ran: boolean
  inWindow: number
  updated: number
}

function teamPairKey(a: string, b: string): string {
  return [a, b].sort().join('|')
}

function groupIdFromDescription(desc: string | undefined): string | null {
  const groupId = desc?.replace(/^Grupo\s+/i, '').trim()
  return groupId || null
}

function normalizeDateIso(value: string | undefined): string | null {
  if (!value) return null
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) return null
  return new Date(ms).toISOString()
}

function scoreValue(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function mapFifaStatus(row: FifaMatch, nowMs = Date.now()): MatchStatus {
  if (row.ResultType === 1) return 'finished'
  const kickoffMs = Date.parse(normalizeDateIso(row.Date) ?? '')
  if (Number.isFinite(kickoffMs) && nowMs < kickoffMs) return 'scheduled'
  if (row.MatchStatus === 3) return 'live'
  if (row.MatchTime && row.MatchTime.trim()) return 'live'
  return 'scheduled'
}

function mapFifaRow(row: FifaMatch): FifaGroupMatch | null {
  const matchNumber = Number(row.MatchNumber)
  if (!Number.isFinite(matchNumber) || matchNumber < 1 || matchNumber > 72) return null

  const groupId = groupIdFromDescription(row.GroupName?.[0]?.Description)
  const homeTeamId = row.Home?.Abbreviation?.trim() ?? row.Home?.IdCountry?.trim()
  const awayTeamId = row.Away?.Abbreviation?.trim() ?? row.Away?.IdCountry?.trim()
  const dateIso = normalizeDateIso(row.Date)
  const idMatch = row.IdMatch?.trim()
  const idStage = row.IdStage?.trim()
  const idSeason = row.IdSeason?.trim() ?? '285023'
  if (!groupId || !homeTeamId || !awayTeamId || !dateIso || !idMatch || !idStage) return null

  return {
    dateIso,
    groupId,
    homeTeamId,
    awayTeamId,
    homeGoals: scoreValue(row.HomeTeamScore ?? row.Home?.Score),
    awayGoals: scoreValue(row.AwayTeamScore ?? row.Away?.Score),
    status: mapFifaStatus(row, Date.now()),
    idMatch,
    idStage,
    idSeason,
  }
}

async function fetchFifaGroupMatches(): Promise<Map<string, FifaGroupMatch>> {
  const res = await fetch(FIFA_MATCHES_URL)
  if (!res.ok) throw new Error(`FIFA API ${res.status}: ${await res.text()}`)
  const json = (await res.json()) as FifaResponse
  const out = new Map<string, FifaGroupMatch>()
  for (const row of json.Results ?? []) {
    const mapped = mapFifaRow(row)
    if (!mapped) continue
    out.set(`${mapped.groupId}|${teamPairKey(mapped.homeTeamId, mapped.awayTeamId)}`, mapped)
  }
  return out
}

function currentTimeMs(scheduledAt: unknown): number | null {
  if (scheduledAt && typeof scheduledAt === 'object' && 'toDate' in scheduledAt) {
    return (scheduledAt as { toDate(): Date }).toDate().getTime()
  }
  const ms = Date.parse(String(scheduledAt ?? ''))
  return Number.isFinite(ms) ? ms : null
}

function updateFromFifa(current: MatchDoc, official: FifaGroupMatch): FifaMatchUpdate {
  const homeIsTeamA = official.homeTeamId === current.teamAId
  const goalsTeamA = homeIsTeamA ? official.homeGoals : official.awayGoals
  const goalsTeamB = homeIsTeamA ? official.awayGoals : official.homeGoals
  const next: FifaMatchUpdate = {
    scheduledAt: new Date(official.dateIso),
    goalsTeamA,
    goalsTeamB,
    status: official.status,
    goalsHome: goalsTeamA,
    goalsAway: goalsTeamB,
  }
  if (official.status === 'finished') next.finishedAt = new Date()
  return next
}

function updateChanged(current: MatchDoc, next: FifaMatchUpdate): boolean {
  if ((current.goalsTeamA ?? current.goalsHome ?? null) !== next.goalsTeamA) return true
  if ((current.goalsTeamB ?? current.goalsAway ?? null) !== next.goalsTeamB) return true
  if (current.status !== next.status) return true
  const currentMs = currentTimeMs(current.scheduledAt)
  if (currentMs != null && Math.abs(currentMs - next.scheduledAt.getTime()) > 60_000) return true
  if (next.scorers && scorersChanged(current.scorers, next.scorers)) return true
  return false
}

async function attachFifaScorers(
  db: Firestore,
  current: MatchDoc,
  official: FifaGroupMatch,
  next: FifaMatchUpdate,
): Promise<void> {
  const totalGoals = (next.goalsTeamA ?? 0) + (next.goalsTeamB ?? 0)
  if (totalGoals <= 0) return
  if (next.status !== 'live' && next.status !== 'finished') return
  if (!scorersIncompleteForScore(next.goalsTeamA, next.goalsTeamB, current.scorers)) return

  const live = await fetchFifaLiveMatch(official.idStage, official.idMatch, official.idSeason)
  const fetched = await fetchScorersFromFifaLive(db, live, current.teamAId, current.teamBId)
  if (fetched.length === 0) return
  next.scorers = mergeScorerEntries(current.scorers ?? [], fetched)
}

export async function syncMatchesFromFifa(db: Firestore): Promise<SyncFifaResult> {
  const nowMs = Date.now()
  if (!shouldRunScheduledSync(nowMs)) return { ran: false, inWindow: 0, updated: 0 }

  const [snap, officialByMatch] = await Promise.all([
    db.collection('matches').get(),
    fetchFifaGroupMatches(),
  ])
  const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() as MatchDoc }))
  const inWindow = docs.filter((d) => d.data.phase === 'group' && isMatchInPollingWindow(d.data, nowMs))

  const writer = db.bulkWriter()
  let updated = 0
  for (const { id, data } of inWindow) {
    const official = officialByMatch.get(`${data.groupId ?? ''}|${teamPairKey(data.teamAId, data.teamBId)}`)
    if (!official) continue
    const next = updateFromFifa(data, official)
    try {
      await attachFifaScorers(db, data, official, next)
    } catch (err) {
      logger.warn(`[fifa:sync] scorers failed matchId=${id}`, err)
    }
    if (!updateChanged(data, next)) continue
    writer.set(db.collection('matches').doc(id), next, { merge: true })
    updated += 1
  }
  await writer.close()
  logger.info(`[fifa:sync] inWindow=${inWindow.length} updated=${updated}`)
  return { ran: true, inWindow: inWindow.length, updated }
}
