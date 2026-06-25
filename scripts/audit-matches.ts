import './seed-load-env.ts'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { decodeFirestoreDoc } from './lib/firestoreRest.ts'

const FIREBASE_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com'
const FIREBASE_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi'
const projectId = 'polla-mundialist'

async function getAccessToken(): Promise<string> {
  const cfg = JSON.parse(readFileSync(join(homedir(), '.config/configstore/firebase-tools.json'), 'utf8'))
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: FIREBASE_CLIENT_ID,
      client_secret: FIREBASE_CLIENT_SECRET,
      refresh_token: cfg.tokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const json = await res.json()
  return json.access_token
}

const token = await getAccessToken()
let pageToken: string | undefined
const all: Record<string, unknown>[] = []
do {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/matches?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const json = await res.json()
  for (const doc of json.documents ?? []) {
    const d = decodeFirestoreDoc(doc)
    all.push({ ...d, __id: doc.name.split('/').pop() })
  }
  pageToken = json.nextPageToken
} while (pageToken)

// ---- AUDIT ----
const byStatus: Record<string, number> = {}
const issues: Record<string, unknown>[] = []
const idsSeen = new Set<string>()

for (const m of all) {
  const id = m.__id as string
  if (idsSeen.has(id)) issues.push({ id, issue: 'ID duplicado' })
  idsSeen.add(id)

  const status = m.status as string
  byStatus[status] = (byStatus[status] || 0) + 1

  const finished = status === 'finished'
  const goalsA = (m.goalsTeamA ?? m.goalsHome ?? null) as number | null
  const goalsB = (m.goalsTeamB ?? m.goalsAway ?? null) as number | null

  if (finished && (goalsA == null || goalsB == null))
    issues.push({ id, teamA: m.teamAId, teamB: m.teamBId, goalsA, goalsB, issue: 'Finalizado sin marcador completo' })

  if ((goalsA != null) !== (goalsB != null))
    issues.push({ id, goalsA, goalsB, issue: 'Marcador parcial (falta un lado)' })

  if (m.goalsTeamA != null && m.goalsHome != null && m.goalsTeamA !== m.goalsHome)
    issues.push({ id, goalsTeamA: m.goalsTeamA, goalsHome: m.goalsHome, issue: 'goalsTeamA ≠ goalsHome' })
  if (m.goalsTeamB != null && m.goalsAway != null && m.goalsTeamB !== m.goalsAway)
    issues.push({ id, goalsTeamB: m.goalsTeamB, goalsAway: m.goalsAway, issue: 'goalsTeamB ≠ goalsAway' })

  const scorers = (m.scorers ?? []) as Record<string, unknown>[]
  if (scorers.length > 0) {
    // Un jugador puede anotar varias veces: duplicado REAL = mismo playerKey + lado + minuto.
    const seen = new Set<string>()
    for (const s of scorers) {
      const k = `${s.playerKey}|${s.teamSide ?? ''}|${s.minute ?? ''}`
      if (seen.has(k)) issues.push({ id, playerKey: s.playerKey, teamSide: s.teamSide, minute: s.minute, issue: 'Scorer duplicado (mismo minuto)' })
      seen.add(k)
    }
    const hasTeamSides = scorers.some((s) => s.teamSide)
    if (hasTeamSides && finished) {
      const sA = scorers.filter((s) => s.teamSide === 'teamA').reduce((a, s) => a + ((s.goals as number) || 0), 0)
      const sB = scorers.filter((s) => s.teamSide === 'teamB').reduce((a, s) => a + ((s.goals as number) || 0), 0)
      if (goalsA != null && sA !== goalsA)
        issues.push({ id, scorerSum: sA, official: goalsA, side: 'A', issue: 'Suma scorers TeamA ≠ oficial' })
      if (goalsB != null && sB !== goalsB)
        issues.push({ id, scorerSum: sB, official: goalsB, side: 'B', issue: 'Suma scorers TeamB ≠ oficial' })
    }
  } else if (finished && goalsA != null && (goalsA > 0 || (goalsB ?? 0) > 0)) {
    issues.push({ id, teamA: m.teamAId, teamB: m.teamBId, goalsA, goalsB, issue: 'Goles pero sin lista de scorers' })
  }
}

console.log('=== RESUMEN ===')
console.log('Total partidos:', all.length)
console.log('Por estado:', byStatus)
const finishedOk = all.filter((m) => {
  const gA = (m.goalsTeamA ?? m.goalsHome) as number | null
  const gB = (m.goalsTeamB ?? m.goalsAway) as number | null
  return m.status === 'finished' && gA != null && gB != null
})
console.log('Finalizados con marcador completo:', finishedOk.length)
console.log('\n=== PROBLEMAS ENCONTRADOS:', issues.length, '===')
for (const i of issues) console.log(JSON.stringify(i))
