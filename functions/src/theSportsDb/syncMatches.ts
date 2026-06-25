import type { Firestore } from 'firebase-admin/firestore'
import * as logger from 'firebase-functions/logger'
import type { MatchDoc } from '../lib/types/predictions'
import { fetchMatchScorers, matchNeedsScorerBackfill } from '../lib/syncMatchScorers'
import { mergeScorerEntries, scorersIncompleteForScore } from '../lib/scorerSync'
import { isMatchInPollingWindow, kickoffMs, shouldRunScheduledSync } from '../apiSports/matchWindow'
import { TSDB_FREE_KEY } from './constants'
import { tsdbGet, eventsOrEmpty } from './client'
import { quickLinkTsdbFixtures } from './linkFixtures'
import { scorersChanged } from './fetchScorers'
import { mapEventToMatchUpdate, matchUpdateChanged } from './mapEventToUpdate'

export interface SyncTsdbResult {
  ran: boolean
  inWindow: number
  updated: number
  linked?: number
}

export async function syncMatchesFromTsdb(
  db: Firestore,
  apiKey = TSDB_FREE_KEY,
  apiSportsKey?: string,
): Promise<SyncTsdbResult> {
  const nowMs = Date.now()
  if (!shouldRunScheduledSync(nowMs)) {
    return { ran: false, inWindow: 0, updated: 0 }
  }

  const snap = await db.collection('matches').get()
  const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() as MatchDoc }))

  const inWindow = docs.filter((d) => isMatchInPollingWindow(d.data, nowMs))
  const backfillScorers = docs.filter((d) => matchNeedsScorerBackfill(d.data))
  const toProcess = [
    ...new Map([...inWindow, ...backfillScorers].map((d) => [d.id, d] as const)).values(),
  ]
  if (toProcess.length === 0) {
    return { ran: true, inWindow: 0, updated: 0 }
  }

  // Relinkear si falta ID en ventana o hay partidos próximos (7 días) sin enlazar
  const missingId = toProcess.some((d) => !d.data.theSportsDbEventId)
  const soonMs = nowMs + 7 * 86_400_000
  const hasUnlinkedSoon = docs.some((d) => {
    if (d.data.theSportsDbEventId) return false
    const k = kickoffMs(d.data.scheduledAt)
    return k != null && k >= nowMs - 15 * 60_000 && k <= soonMs
  })
  let linked: number | undefined
  if (missingId || hasUnlinkedSoon) {
    const linkResult = await quickLinkTsdbFixtures(db, apiKey)
    linked = linkResult.linked
    const refreshed = await db.collection('matches').get()
    for (const d of toProcess) {
      const fresh = refreshed.docs.find((x) => x.id === d.id)
      if (fresh) d.data = fresh.data() as MatchDoc
    }
  }

  let updated = 0
  const writer = db.bulkWriter()

  for (const { id: matchId, data: current } of toProcess) {
    const tsdbId = current.theSportsDbEventId
    if (!tsdbId) continue

    // 1 llamada por partido en ventana (máx ~8 = muy bajo de 30/min)
    const resp = await tsdbGet(apiKey, 'lookupevent.php', { id: tsdbId })
    const events = eventsOrEmpty(resp)
    if (events.length === 0) continue

    const item = events[0]
    const next = mapEventToMatchUpdate(item)

    const goalsChanged =
      (current.goalsTeamA ?? current.goalsHome ?? null) !== next.goalsTeamA ||
      (current.goalsTeamB ?? current.goalsAway ?? null) !== next.goalsTeamB
    const scorersIncomplete = scorersIncompleteForScore(
      next.goalsTeamA,
      next.goalsTeamB,
      current.scorers,
    )
    const shouldFetchScorers =
      next.status === 'live' ||
      next.status === 'finished' ||
      goalsChanged ||
      (current.scorers?.length ?? 0) === 0 ||
      scorersIncomplete

    if (shouldFetchScorers) {
      try {
        const scorers = await fetchMatchScorers(
          db,
          {
            ...current,
            goalsTeamA: next.goalsTeamA,
            goalsTeamB: next.goalsTeamB,
            status: next.status,
          },
          tsdbId,
          {
            tsdbApiKey: apiKey,
            apiSportsKey,
            goalsTeamA: next.goalsTeamA,
            goalsTeamB: next.goalsTeamB,
          },
        )
        // Nunca reducir scorers ya confirmados: TSDB a veces "parpadea" y devuelve
        // un timeline temporalmente incompleto. Solo se permite agregar/enriquecer.
        if (scorers.length > 0 || (current.scorers?.length ?? 0) > 0) {
          next.scorers = mergeScorerEntries(current.scorers ?? [], scorers)
        }
      } catch (err) {
        logger.warn(`[tsdb:sync] scorers failed matchId=${matchId}`, err)
      }
    }

    const scorersDelta = scorersChanged(current.scorers, next.scorers ?? [])
    if (!matchUpdateChanged(current, next) && !scorersDelta) continue

    // FIFA u otra fuente puede marcar FT antes que TSDB; no revertir a live/scheduled.
    if (current.status === 'finished' && next.status !== 'finished') {
      next.status = 'finished'
    }

    const kickoff = kickoffMs(current.scheduledAt)
    if (kickoff !== null && nowMs < kickoff && next.status === 'live') {
      next.status = 'scheduled'
    }

    writer.set(db.collection('matches').doc(matchId), next, { merge: true })
    updated += 1
  }

  await writer.close()
  logger.info(`[tsdb:sync] inWindow=${inWindow.length} backfill=${backfillScorers.length} updated=${updated}`)
  return { ran: true, inWindow: toProcess.length, updated, linked }
}
