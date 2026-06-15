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
  return (await res.json()).access_token
}

const token = await getAccessToken()
let pageToken
const all: any[] = []
do {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/matches?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const json: any = await res.json()
  for (const doc of json.documents ?? []) {
    const d = decodeFirestoreDoc(doc)
    d.__id = doc.name.split('/').pop()
    all.push(d)
  }
  pageToken = json.nextPageToken
} while (pageToken)

for (const m of all) {
  if (m.status === 'live' || m.status === 'finished') {
    console.log(`${m.__id}: status=${m.status} score=${m.goalsTeamA}-${m.goalsTeamB} scorers=${JSON.stringify(m.scorers)}`)
  }
}
