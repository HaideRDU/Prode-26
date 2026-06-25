/**
 * Ejecutar: npx tsx src/domain/bracketAdvancement.test.ts
 */
import assert from 'node:assert/strict'
import { scoreBracketAdvancement, predictedTeamsByAdvancementRound } from './bracketAdvancement'
import type { MatchPredictionPayload } from '../types/predictions'

function main() {
  const groupPred = new Map<string, MatchPredictionPayload>()
  const koPred = new Map<string, MatchPredictionPayload>()

  const predicted = predictedTeamsByAdvancementRound(groupPred, koPred)
  const official = new Map(Array.from(predicted.keys(), (k) => [k, new Set<string>()])) as typeof predicted

  assert.equal(scoreBracketAdvancement(predicted, official), 0)

  official.set('toR32', new Set(['BRA', 'ARG']))
  predicted.set('toR32', new Set(['BRA', 'FRA']))
  assert.equal(scoreBracketAdvancement(predicted, official), 2, 'Solo BRA acertó en R32')

  official.set('toR32', new Set(['BRA', 'ARG', 'FRA', 'COL']))
  predicted.set('toR32', new Set(['BRA', 'FRA', 'JPN', 'COL']))
  assert.equal(
    scoreBracketAdvancement(predicted, official),
    6,
    'Three R32 hits should score 2 points each',
  )

  official.set('toR16', new Set(['BRA']))
  predicted.set('toR16', new Set(['BRA']))
  assert.equal(
    scoreBracketAdvancement(predicted, official),
    10,
    'R32 and R16 advancement points should accumulate by round',
  )

  console.log('bracketAdvancement.test.ts: OK')
}

main()
