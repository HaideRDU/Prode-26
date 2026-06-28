/**
 * Re-sincroniza goleadores de un partido (TSDB timeline + fallback API-Sports).
 *
 * Uso:
 *   npm run build:functions
 *   npm run resync:match-scorers -- --match=wc26-A-01
 */
import './seed-load-env.ts'
import { fetchScorersFromTimeline, scorersChanged } from '../functions/lib/theSportsDb/fetchScorers.js'
import { fetchMatchScorers } from '../functions/lib/lib/syncMatchScorers.js'
import { mergeScorerEntries, reconcileScorersWithScore } from '../functions/lib/lib/scorerSync.js'
import { TSDB_FREE_KEY } from '../functions/lib/theSportsDb/constants.js'
import { mapEventToMatchUpdate } from '../functions/lib/theSportsDb/mapEventToUpdate.js'
import { tsdbGet, eventsOrEmpty } from '../functions/lib/theSportsDb/client.js'
import type { MatchDoc, TeamDoc } from '../functions/lib/lib/types/predictions.js'
import { restGetDoc, restPatchDoc } from './lib/firestoreRest.ts'
import { createRestFirestoreShim } from './lib/restFirestoreShim.ts'

const args = process.argv.slice(2)
const matchId = args.find((x) => x.startsWith('--match='))?.slice('--match='.length).trim()

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.VITE_FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  'polla-mundialist'

const apiSportsKey = process.env.APISPORTS_KEY?.trim()

if (!matchId) {
  console.error('Uso: npm run resync:match-scorers -- --match=wc26-A-01')
  process.exit(1)
}

async function main(): Promise<void> {
  console.log('[resync:match-scorers] project:', projectId, 'match:', matchId)

  const raw = await restGetDoc(projectId, `matches/${matchId}`)
  if (!raw) throw new Error(`No existe matches/${matchId}`)

  const current = raw as unknown as MatchDoc
  const tsdbId = current.theSportsDbEventId
  if (!tsdbId && !current.apiSportsFixtureId) {
    throw new Error(`matches/${matchId} sin theSportsDbEventId ni apiSportsFixtureId`)
  }
  if (!apiSportsKey && !tsdbId) {
    throw new Error('APISPORTS_KEY requerida para partidos sin enlace TSDB')
  }
  if (!apiSportsKey) {
    console.warn('[resync:match-scorers] APISPORTS_KEY no definida; solo timeline TSDB.')
  }

  const db = createRestFirestoreShim(projectId)

  let nextGoals = {
    goalsTeamA: current.goalsTeamA ?? current.goalsHome ?? null,
    goalsTeamB: current.goalsTeamB ?? current.goalsAway ?? null,
    status: current.status,
  }

  let tsdbHomeTeamId: string | undefined
  let tsdbAwayTeamId: string | undefined

  if (tsdbId) {
    const resp = await tsdbGet(TSDB_FREE_KEY, 'lookupevent.php', { id: tsdbId })
    const events = eventsOrEmpty(resp)
    if (events.length === 0) throw new Error(`TSDB sin evento id=${tsdbId}`)
    const item = events[0]!
    tsdbHomeTeamId = item.idHomeTeam
    tsdbAwayTeamId = item.idAwayTeam
    const teamARaw = current.teamAId ? await restGetDoc(projectId, `teams/${current.teamAId}`) : null
    const teamBRaw = current.teamBId ? await restGetDoc(projectId, `teams/${current.teamBId}`) : null
    const teamATsdbId = (teamARaw as TeamDoc | null)?.theSportsDbTeamId
    const teamBTsdbId = (teamBRaw as TeamDoc | null)?.theSportsDbTeamId
    const next = mapEventToMatchUpdate(item, {
      teamATsdbId,
      teamBTsdbId,
      teamAId: current.teamAId,
      teamBId: current.teamBId,
    })
    nextGoals = {
      goalsTeamA: next.goalsTeamA,
      goalsTeamB: next.goalsTeamB,
      status: next.status,
    }
  }

  const matchCtx = { ...current, ...nextGoals }

  let scorers: Awaited<ReturnType<typeof fetchScorersFromTimeline>> = []
  if (tsdbId) {
    scorers = await fetchScorersFromTimeline(db, matchCtx, tsdbId, TSDB_FREE_KEY)
  }

  if (apiSportsKey) {
    scorers = await fetchMatchScorers(db, matchCtx, tsdbId ?? null, {
      apiSportsKey,
      goalsTeamA: nextGoals.goalsTeamA,
      goalsTeamB: nextGoals.goalsTeamB,
      tsdbHomeTeamId,
      tsdbAwayTeamId,
    })
  }

  scorers = reconcileScorersWithScore(
    mergeScorerEntries(
      scorers,
      reconcileScorersWithScore(current.scorers ?? [], nextGoals.goalsTeamA, nextGoals.goalsTeamB),
    ),
    nextGoals.goalsTeamA,
    nextGoals.goalsTeamB,
  )

  console.log('[resync:match-scorers] scorers antes:', JSON.stringify(current.scorers ?? [], null, 2))
  console.log('[resync:match-scorers] scorers después:', JSON.stringify(scorers, null, 2))

  const changed = scorersChanged(current.scorers, scorers)
  if (
    !changed &&
    current.goalsTeamA === nextGoals.goalsTeamA &&
    current.goalsTeamB === nextGoals.goalsTeamB &&
    current.status === nextGoals.status
  ) {
    console.log('[resync:match-scorers] Sin cambios.')
    return
  }

  await restPatchDoc(
    projectId,
    `matches/${matchId}`,
    {
      goalsTeamA: nextGoals.goalsTeamA,
      goalsTeamB: nextGoals.goalsTeamB,
      status: nextGoals.status,
      scorers,
    },
    ['goalsTeamA', 'goalsTeamB', 'status', 'scorers'],
  )
  console.log('[resync:match-scorers] OK: matches/' + matchId + ' actualizado (onMatchWrite recalcula standings)')
}

main().catch((e) => {
  console.error('[resync:match-scorers] ERROR:', e)
  process.exit(1)
})
