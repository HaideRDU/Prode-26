import './seed-load-env.ts'
import { restGetDoc } from './lib/firestoreRest.ts'

const ids = ['wc26-C-05', 'wc26-C-06', 'wc26-A-05', 'wc26-A-06', 'wc26-E-05']
for (const id of ids) {
  const d = await restGetDoc('polla-mundialist', `matches/${id}`)
  if (!d) {
    console.log(id, 'NOT FOUND')
    continue
  }
  console.log(
    JSON.stringify({
      id: d.id,
      teams: `${d.teamAId}-${d.teamBId}`,
      status: d.status,
      goalsTeamA: d.goalsTeamA,
      goalsTeamB: d.goalsTeamB,
      goalsHome: d.goalsHome,
      goalsAway: d.goalsAway,
      scorers: Array.isArray(d.scorers) ? d.scorers.length : 0,
      scheduledAt: d.scheduledAt,
    }),
  )
}
