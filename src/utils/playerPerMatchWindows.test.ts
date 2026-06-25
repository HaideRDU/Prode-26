import { strict as assert } from 'node:assert'
import {
  classifyPlayerPickMatches,
  isMatchDisplayLive,
  isPrematureLiveStatus,
} from './playerPerMatchWindows'
import type { MatchDoc } from '../types/predictions'

function match(id: string, scheduledAt: string, status: MatchDoc['status'] = 'scheduled'): MatchDoc & { id: string } {
  return {
    id,
    teamAId: 'AAA',
    teamBId: 'BBB',
    goalsHome: null,
    goalsAway: null,
    goalsTeamA: null,
    goalsTeamB: null,
    phase: 'group',
    groupId: 'A',
    scheduledAt,
    status,
  }
}

const kickoff = '2026-06-24T19:00:00.000Z'
const staleNow = Date.parse('2026-06-25T20:53:00.000Z')
const freshNow = Date.parse('2026-06-24T20:00:00.000Z')
const beforeKickoff = Date.parse('2026-06-25T22:30:00.000Z')

assert.equal(
  isMatchDisplayLive(match('wc26-A-06', kickoff), freshNow),
  true,
  'scheduled match can be displayed as live shortly after kickoff',
)

assert.equal(
  isMatchDisplayLive(match('wc26-A-06', kickoff), staleNow),
  false,
  'scheduled match should not stay live on the next day',
)

assert.deepEqual(
  classifyPlayerPickMatches([match('wc26-A-06', kickoff)], staleNow).live.map((m) => m.id),
  [],
  'stale scheduled match should not appear in live picks',
)

assert.equal(
  isPrematureLiveStatus(match('wc26-F-05', '2026-06-25T23:00:00Z', 'live'), beforeKickoff),
  true,
  'live status before kickoff is premature',
)

assert.equal(
  isMatchDisplayLive(match('wc26-F-05', '2026-06-25T23:00:00Z', 'live'), beforeKickoff),
  false,
  'premature live should not display as in play',
)

assert.deepEqual(
  classifyPlayerPickMatches(
    [match('wc26-F-05', '2026-06-25T23:00:00Z', 'live')],
    beforeKickoff,
  ).live.map((m) => m.id),
  [],
  'premature live belongs in prediction/upcoming, not live section',
)

assert.ok(
  classifyPlayerPickMatches(
    [match('wc26-F-05', '2026-06-25T23:00:00Z', 'live')],
    beforeKickoff,
  ).prediction.some((m) => m.id === 'wc26-F-05'),
  'premature live with open pick window shows in prediction block',
)

console.log('playerPerMatchWindows.test.ts OK')
