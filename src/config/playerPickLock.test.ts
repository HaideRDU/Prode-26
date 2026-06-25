import { strict as assert } from 'node:assert'
import {
  DEFAULT_RULESET,
  getPlayerPickLockAt,
  isPlayerPickLocked,
} from './ruleset'

const kickoff = '2026-06-25T22:00:00.000Z'
const lock = getPlayerPickLockAt(kickoff, DEFAULT_RULESET)

assert.ok(lock, 'lock date should resolve')
assert.equal(lock!.toISOString(), '2026-06-25T21:00:00.000Z')

assert.equal(
  isPlayerPickLocked(kickoff, Date.parse('2026-06-25T20:59:00.000Z'), DEFAULT_RULESET),
  false,
  '61 minutes before kickoff should remain open',
)

assert.equal(
  isPlayerPickLocked(kickoff, Date.parse('2026-06-25T21:00:00.000Z'), DEFAULT_RULESET),
  true,
  'exactly 1 hour before kickoff should be locked',
)

console.log('playerPickLock.test.ts OK')
