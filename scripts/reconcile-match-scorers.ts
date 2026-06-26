/**
 * Limpia goleadores duplicados en Firestore según el marcador (sin llamar APIs).
 *
 * Uso:
 *   npm run build:functions
 *   npx tsx --tsconfig tsconfig.node.json scripts/reconcile-match-scorers.ts wc26-I-05 wc26-I-06
 */
import './seed-load-env.ts'
import { reconcileScorersWithScore } from '../functions/lib/lib/scorerSync.js'
import { scorersChanged } from '../functions/lib/theSportsDb/fetchScorers.js'
import type { MatchDoc } from '../functions/lib/lib/types/predictions.js'
import { restGetDoc, restPatchDoc } from './lib/firestoreRest.ts'

const matchIds = process.argv.slice(2).filter((a) => !a.startsWith('-'))

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.VITE_FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  'polla-mundialist'

if (matchIds.length === 0) {
  console.error('Uso: npx tsx scripts/reconcile-match-scorers.ts wc26-I-05 [wc26-I-06 ...]')
  process.exit(1)
}

async function main(): Promise<void> {
  for (const matchId of matchIds) {
    const raw = await restGetDoc(projectId, `matches/${matchId}`)
    if (!raw) {
      console.warn(`[reconcile] skip: no existe matches/${matchId}`)
      continue
    }
    const current = raw as unknown as MatchDoc
    const goalsTeamA = current.goalsTeamA ?? current.goalsHome ?? null
    const goalsTeamB = current.goalsTeamB ?? current.goalsAway ?? null
    const scorers = reconcileScorersWithScore(current.scorers ?? [], goalsTeamA, goalsTeamB)
    if (!scorersChanged(current.scorers, scorers)) {
      console.log(`[reconcile] ${matchId}: sin cambios`)
      continue
    }
    await restPatchDoc(projectId, `matches/${matchId}`, { scorers }, ['scorers'])
    console.log(`[reconcile] ${matchId}: ${(current.scorers ?? []).length} → ${scorers.length} goles`)
  }
}

main().catch((e) => {
  console.error('[reconcile] ERROR:', e)
  process.exit(1)
})
