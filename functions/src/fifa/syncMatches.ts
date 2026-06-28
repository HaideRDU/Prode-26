import type { Firestore } from 'firebase-admin/firestore'
import * as logger from 'firebase-functions/logger'
import { isMatchInPollingWindow, shouldRunScheduledSync } from '../apiSports/matchWindow'
import { scorersChanged } from '../theSportsDb/fetchScorers'
import { mergeScorerEntries, reconcileScorersWithScore, scorersIncompleteForScore } from '../lib/scorerSync'
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

type FifaKoMatch = {
  matchNumber: number
  dateIso: string
  homeTeamId: string | null
  awayTeamId: string | null
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

function mapFifaKoRow(row: FifaMatch): FifaKoMatch | null {
  const matchNumber = Number(row.MatchNumber)
  if (!Number.isFinite(matchNumber) || matchNumber <= 72 || matchNumber > 104) return null

  const dateIso = normalizeDateIso(row.Date)
  const idMatch = row.IdMatch?.trim()
  const idStage = row.IdStage?.trim()
  const idSeason = row.IdSeason?.trim() ?? '285023'
  if (!dateIso || !idMatch || !idStage) return null

  // TBD = equipo aún no determinado (esperando que avance alguien)
  const rawHome = row.Home?.Abbreviation?.trim() ?? row.Home?.IdCountry?.trim() ?? ''
  const rawAway = row.Away?.Abbreviation?.trim() ?? row.Away?.IdCountry?.trim() ?? ''
  const isTbd = (s: string) => !s || s.toUpperCase() === 'TBD' || s.length > 5

  return {
    matchNumber,
    dateIso,
    homeTeamId: isTbd(rawHome) ? null : rawHome,
    awayTeamId: isTbd(rawAway) ? null : rawAway,
    homeGoals: scoreValue(row.HomeTeamScore ?? row.Home?.Score),
    awayGoals: scoreValue(row.AwayTeamScore ?? row.Away?.Score),
    status: mapFifaStatus(row, Date.now()),
    idMatch,
    idStage,
    idSeason,
  }
}

async function fetchFifaGroupMatches(): Promise<{ group: Map<string, FifaGroupMatch>; ko: Map<number, FifaKoMatch> }> {
  const res = await fetch(FIFA_MATCHES_URL)
  if (!res.ok) throw new Error(`FIFA API ${res.status}: ${await res.text()}`)
  const json = (await res.json()) as FifaResponse
  const group = new Map<string, FifaGroupMatch>()
  const ko = new Map<number, FifaKoMatch>()
  for (const row of json.Results ?? []) {
    const grp = mapFifaRow(row)
    if (grp) { group.set(`${grp.groupId}|${teamPairKey(grp.homeTeamId, grp.awayTeamId)}`, grp); continue }
    const koMatch = mapFifaKoRow(row)
    if (koMatch) ko.set(koMatch.matchNumber, koMatch)
  }
  return { group, ko }
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
  const baseScorers = reconcileScorersWithScore(
    current.scorers ?? [],
    next.goalsTeamA,
    next.goalsTeamB,
  )
  if (baseScorers.length > 0) next.scorers = baseScorers

  const totalGoals = (next.goalsTeamA ?? 0) + (next.goalsTeamB ?? 0)
  if (totalGoals <= 0) return
  if (next.status !== 'live' && next.status !== 'finished') return
  if (!scorersIncompleteForScore(next.goalsTeamA, next.goalsTeamB, baseScorers)) return

  const live = await fetchFifaLiveMatch(official.idStage, official.idMatch, official.idSeason)
  const fetched = await fetchScorersFromFifaLive(db, live, current.teamAId, current.teamBId)
  if (fetched.length === 0) return
  next.scorers = reconcileScorersWithScore(
    mergeScorerEntries(fetched, baseScorers),
    next.goalsTeamA,
    next.goalsTeamB,
  )
}

function localGoals(current: MatchDoc): { a: number | null; b: number | null } {
  return {
    a: current.goalsTeamA ?? current.goalsHome ?? null,
    b: current.goalsTeamB ?? current.goalsAway ?? null,
  }
}

/** Ventana en vivo o partido ya jugado en FIFA cuyo doc local aún no tiene marcador/estado. */
function needsFifaCalendarSync(current: MatchDoc, official: FifaGroupMatch, nowMs: number): boolean {
  if (current.phase !== 'group') return false
  if (isMatchInPollingWindow(current, nowMs)) return true
  if (official.status !== 'finished' && official.status !== 'live') return false

  const local = localGoals(current)
  if (local.a === null || local.b === null) return true
  if (current.status !== 'finished' && official.status === 'finished') return true
  if (current.status === 'scheduled' && official.status === 'live') return true

  const expected = updateFromFifa(current, official)
  return local.a !== expected.goalsTeamA || local.b !== expected.goalsTeamB
}

function koMatchDocId(matchNumber: number): string {
  return `wc26-ko-${matchNumber}`
}

function koRoundFromMatchNumber(n: number): string {
  if (n <= 88) return 'r32'
  if (n <= 96) return 'r16'
  if (n <= 100) return 'qf'
  if (n <= 102) return 'sf'
  if (n === 103) return 'third'
  return 'final'
}

export async function syncMatchesFromFifa(db: Firestore): Promise<SyncFifaResult> {
  const nowMs = Date.now()
  if (!shouldRunScheduledSync(nowMs)) return { ran: false, inWindow: 0, updated: 0 }

  const [snap, { group: officialByGroup, ko: officialByKoNum }] = await Promise.all([
    db.collection('matches').get(),
    fetchFifaGroupMatches(),
  ])
  const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() as MatchDoc }))
  const docsById = new Map(docs.map((d) => [d.id, d]))

  // ── Grupo ────────────────────────────────────────────────────────────────
  const toSync = docs.filter((d) => {
    if (d.data.phase !== 'group') return false
    const official = officialByGroup.get(`${d.data.groupId ?? ''}|${teamPairKey(d.data.teamAId, d.data.teamBId)}`)
    if (!official) return false
    return needsFifaCalendarSync(d.data, official, nowMs)
  })

  const writer = db.bulkWriter()
  let updated = 0

  for (const { id, data } of toSync) {
    const official = officialByGroup.get(`${data.groupId ?? ''}|${teamPairKey(data.teamAId, data.teamBId)}`)
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

  // ── Eliminatorias (R32 → Final) ───────────────────────────────────────
  for (const [matchNum, ko] of officialByKoNum) {
    const docId = koMatchDocId(matchNum)
    const existing = docsById.get(docId)?.data

    // Actualizar equipos si FIFA ya los conoce y nuestro doc no los tiene
    const teamsKnown = ko.homeTeamId && ko.awayTeamId
    const needsTeams = teamsKnown && (!existing?.teamAId || !existing?.teamBId)

    // Actualizar marcador/estado si el partido está en ventana o tiene resultado
    const needsScore =
      (ko.status === 'live' || ko.status === 'finished') &&
      existing?.teamAId && existing?.teamBId

    if (!needsTeams && !needsScore) continue

    const patch: Record<string, unknown> = { scheduledAt: new Date(ko.dateIso), status: ko.status }

    if (needsTeams) {
      patch.teamAId = ko.homeTeamId
      patch.teamBId = ko.awayTeamId
      patch.teamHomeId = ko.homeTeamId
      patch.teamAwayId = ko.awayTeamId
      patch.phase = 'knockout'
      patch.round = koRoundFromMatchNumber(matchNum)
    }

    if (needsScore && existing) {
      const homeIsTeamA = ko.homeTeamId === existing.teamAId || (!existing.teamAId && true)
      patch.goalsTeamA = homeIsTeamA ? ko.homeGoals : ko.awayGoals
      patch.goalsTeamB = homeIsTeamA ? ko.awayGoals : ko.homeGoals
      patch.goalsHome = patch.goalsTeamA
      patch.goalsAway = patch.goalsTeamB
      if (ko.status === 'finished') patch.finishedAt = new Date()
    }

    const ref = db.collection('matches').doc(docId)
    if (existing) {
      writer.set(ref, patch, { merge: true })
    } else {
      writer.set(ref, { ...patch, phase: 'knockout', round: koRoundFromMatchNumber(matchNum) }, { merge: true })
    }
    updated += 1
  }

  await writer.close()
  logger.info(`[fifa:sync] group=${toSync.length} ko=${officialByKoNum.size} updated=${updated}`)
  return { ran: true, inWindow: toSync.length + officialByKoNum.size, updated }
}
