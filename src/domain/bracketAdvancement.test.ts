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
  const official = new Map(predicted.keys().map((k) => [k, new Set<string>()])) as typeof predicted

  assert.equal(scoreBracketAdvancement(predicted, official), 0)

  official.set('toR32', new Set(['BRA', 'ARG']))
  predicted.set('toR32', new Set(['BRA', 'FRA']))
  assert.equal(scoreBracketAdvancement(predicted, official), 2, 'Solo BRA acertó en R32')

  console.log('bracketAdvancement.test.ts: OK')
}

main()
