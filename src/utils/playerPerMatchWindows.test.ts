import { strict as assert } from 'node:assert'
import {
  classifyPlayerPickMatches,
  isMatchDisplayLive,
} from './playerPerMatchWindows'
import type { MatchDoc } from '../types/predictions'

function match(id: string, scheduledAt: string): MatchDoc & { id: string } {
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
    status: 'scheduled',
  }
}

const kickoff = '2026-06-24T19:00:00.000Z'
const staleNow = Date.parse('2026-06-25T20:53:00.000Z')
const freshNow = Date.parse('2026-06-24T20:00:00.000Z')

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

console.log('playerPerMatchWindows.test.ts OK')
