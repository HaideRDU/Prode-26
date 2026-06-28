import './seed-load-env.ts'
import { restGetDoc } from './lib/firestoreRest.ts'
import { tsdbGet, eventsOrEmpty, tsdbGetJson } from '../functions/lib/theSportsDb/client.js'
import { TSDB_FREE_KEY } from '../functions/lib/theSportsDb/constants.js'
import { mapEventToMatchUpdate, tsdbHomeIsTeamA } from '../functions/lib/theSportsDb/mapEventToUpdate.js'
import { parseTimelineGoals } from '../functions/lib/theSportsDb/fetchScorers.js'
import { iso3FromTsdb } from '../functions/lib/theSportsDb/teamCodes.js'
import type { TeamDoc } from '../functions/lib/lib/types/predictions.js'

const matchId = process.argv[2] ?? 'wc26-I-05'
const projectId = process.env.FIREBASE_PROJECT_ID || 'polla-mundialist'

const m = await restGetDoc(projectId, `matches/${matchId}`)
if (!m) throw new Error('no match')
const teamAId = String(m.teamAId)
const teamBId = String(m.teamBId)
const fra = await restGetDoc(projectId, `teams/${teamAId}`)
const nor = await restGetDoc(projectId, `teams/${teamBId}`)
const teamATsdbId = (fra as TeamDoc)?.theSportsDbTeamId
const teamBTsdbId = (nor as TeamDoc)?.theSportsDbTeamId
const tsdbId = String(m.theSportsDbEventId)

const resp = await tsdbGet(TSDB_FREE_KEY, 'lookupevent.php', { id: tsdbId })
const item = eventsOrEmpty(resp)[0]!
const mapped = mapEventToMatchUpdate(item, { teamATsdbId, teamBTsdbId, teamAId, teamBId })

console.log('match', matchId, teamAId, 'vs', teamBId)
console.log('TSDB home:', item.idHomeTeam, iso3FromTsdb(item.idHomeTeam, ''), 'away:', item.idAwayTeam, iso3FromTsdb(item.idAwayTeam, ''))
console.log('TSDB score home-away:', item.intHomeScore, '-', item.intAwayScore)
console.log('homeIsTeamA:', tsdbHomeIsTeamA(item, { teamATsdbId, teamBTsdbId, teamAId, teamBId }))
console.log('Mapped teamA/B:', mapped.goalsTeamA, '-', mapped.goalsTeamB)
console.log('Firestore teamA/B:', m.goalsTeamA, '-', m.goalsTeamB)

const tl = await tsdbGetJson(TSDB_FREE_KEY, 'lookuptimeline.php', { id: tsdbId })
const rows = tl.timeline == null ? [] : Array.isArray(tl.timeline) ? tl.timeline : [tl.timeline]
for (const g of rows.filter((r) => r?.strTimeline?.trim().toLowerCase() === 'goal')) {
  console.log('goal', g.intTime, g.strPlayer, 'strHome=', g.strHome)
}
const parsed = parseTimelineGoals(rows, {
  tsdbHomeTeamId: item.idHomeTeam,
  tsdbAwayTeamId: item.idAwayTeam,
  teamAId,
  teamBId,
})
console.log('parsed', parsed.map((p) => `${p.minute}' ${p.playerName} → ${p.teamSide}`))
