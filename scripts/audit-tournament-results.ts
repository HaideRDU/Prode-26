import './seed-load-env.ts'
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { ALL_QUESTION_METAS } from '../src/data/bonusQuestionsMeta.ts'
import { EXTRA_IDS } from '../src/data/questionIds.ts'
import { formatTournamentPayloadLabel } from '../src/domain/formatTournamentPayloadLabel.ts'
import type { MatchDoc, TeamDoc, TournamentResultDoc } from '../src/types/predictions.ts'

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  process.env.VITE_FIREBASE_PROJECT_ID

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    ...(projectId ? { projectId } : {}),
  })
}

const db = getFirestore()

const FIXED_QUESTION_LABELS: Record<string, string> = {
  [EXTRA_IDS.champion]: 'Campeon del torneo',
  [EXTRA_IDS.runnerUp]: 'Subcampeon',
  [EXTRA_IDS.thirdPlace]: 'Tercer puesto',
  [EXTRA_IDS.fourthPlace]: 'Cuarto puesto',
  [EXTRA_IDS.topScorer]: 'Goleador del torneo',
  [EXTRA_IDS.bestGoalkeeperAverage]: 'Mejor arquero',
}

async function loadTeamLabels(): Promise<(teamId: string) => string> {
  const snap = await db.collection('teams').get()
  const labels = new Map<string, string>()
  snap.forEach((doc) => {
    const data = doc.data() as TeamDoc
    labels.set(doc.id, data.nameEs ?? doc.id)
  })
  return (teamId) => labels.get(teamId) ?? teamId
}

async function main(): Promise<void> {
  const teamLabel = await loadTeamLabels()
  const matchSnap = await db.collection('matches').get()
  const matches: Array<MatchDoc & { id: string }> = []
  matchSnap.forEach((doc) => matches.push({ id: doc.id, ...(doc.data() as MatchDoc) }))
  const resultSnap = await db.collection('tournamentResults').get()
  const results = new Map<string, TournamentResultDoc>()
  resultSnap.forEach((doc) => {
    results.set(doc.id, { ...(doc.data() as TournamentResultDoc), questionId: doc.id })
  })

  const questions = [
    ...Object.values(EXTRA_IDS).map((id) => ({ id, label: FIXED_QUESTION_LABELS[id] ?? id })),
    ...ALL_QUESTION_METAS.map((q) => ({ id: q.id, label: q.labelEs })),
  ]

  console.log(`\n[audit:tournament-results] project=${projectId ?? '(default)'} docs=${resultSnap.size}\n`)
  for (const q of questions) {
    const result = results.get(q.id)
    const state = result?.resolved && result.answer ? 'RESUELTA' : result ? 'PENDIENTE' : 'SIN_DOC'
    const answer =
      result?.resolved && result.answer
        ? formatTournamentPayloadLabel(result.answer, teamLabel)
        : '-'
    console.log(`${state.padEnd(10)} | ${q.id.padEnd(38)} | ${q.label} | ${answer}`)
  }

  const groupMatches = matches.filter((m) => m.phase === 'group')
  const finishedGroupMatches = groupMatches.filter((m) => m.status === 'finished')
  const goalsByTeam = new Map<string, number>()
  for (const match of finishedGroupMatches) {
    goalsByTeam.set(match.teamAId, (goalsByTeam.get(match.teamAId) ?? 0) + (match.goalsTeamA ?? match.goalsHome ?? 0))
    goalsByTeam.set(match.teamBId, (goalsByTeam.get(match.teamBId) ?? 0) + (match.goalsTeamB ?? match.goalsAway ?? 0))
  }
  const topGroupScorers = [...goalsByTeam.entries()].sort((a, b) => b[1] - a[1])

  const biggestWins = matches
    .filter((m) => m.status === 'finished')
    .map((m) => {
      const a = m.goalsTeamA ?? m.goalsHome ?? 0
      const b = m.goalsTeamB ?? m.goalsAway ?? 0
      return { match: m, a, b, margin: Math.abs(a - b) }
    })
    .sort((a, b) => b.margin - a.margin || b.a + b.b - (a.a + a.b))

  const colombiaGoals = matches
    .filter((m) => m.teamAId === 'COL' || m.teamBId === 'COL')
    .flatMap((m) =>
      (m.scorers ?? [])
        .filter((s) => !s.ownGoal)
        .filter((s) => (s.teamSide === 'teamA' ? m.teamAId : s.teamSide === 'teamB' ? m.teamBId : null) === 'COL')
        .map((s) => ({ match: m, scorer: s })),
    )
    .sort((a, b) => {
      const da = new Date(a.match.scheduledAt as string).getTime()
      const db = new Date(b.match.scheduledAt as string).getTime()
      if (da !== db) return da - db
      return (a.scorer.minute ?? 999) - (b.scorer.minute ?? 999)
    })

  console.log('\n[audit:tournament-results] candidatos inferidos, no escritos')
  console.log(
    `- Equipo mas goleador en grupos: ${
      topGroupScorers[0]
        ? `${teamLabel(topGroupScorers[0][0])} (${topGroupScorers[0][1]} goles, grupos ${finishedGroupMatches.length}/${groupMatches.length} finalizados)`
        : 'sin datos'
    }`,
  )
  console.log(
    `- Mayor goleada actual: ${
      biggestWins[0]
        ? `${teamLabel(biggestWins[0].match.teamAId)} ${biggestWins[0].a}-${biggestWins[0].b} ${teamLabel(biggestWins[0].match.teamBId)} (${biggestWins[0].match.id})`
        : 'sin datos'
    }`,
  )
  console.log(
    `- Primer gol de Colombia: ${
      colombiaGoals[0]
        ? `${colombiaGoals[0].scorer.playerName ?? colombiaGoals[0].scorer.playerKey} (${colombiaGoals[0].match.id}, min ${colombiaGoals[0].scorer.minute ?? '?'})`
        : 'sin dato en scorers'
    }`,
  )
  console.log('- Primer expulsado: no inferible; MatchDoc no guarda tarjetas rojas.')
  console.log('- Equipo revelacion: requiere definicion/lista de elegibles y cierre de avance; no se escribe automaticamente.')
}

main().catch((err) => {
  console.error('[audit:tournament-results] ERROR:', err)
  process.exit(1)
})
