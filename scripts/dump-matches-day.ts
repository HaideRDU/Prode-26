/**
 * Volcado JSON de partidos de un día calendario del torneo (America/Bogota).
 * Uso: npx tsx scripts/dump-matches-day.ts 2026-06-25
 */
import './seed-load-env.ts'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { decodeFirestoreDoc } from './lib/firestoreRest.ts'

const day = process.argv[2] ?? '2026-06-25'
const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.VITE_FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  'polla-mundialist'

const FIREBASE_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com'
const FIREBASE_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi'

const cfg = JSON.parse(readFileSync(join(homedir(), '.config/configstore/firebase-tools.json'), 'utf8'))
const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: FIREBASE_CLIENT_ID,
    client_secret: FIREBASE_CLIENT_SECRET,
    refresh_token: cfg.tokens.refresh_token,
    grant_type: 'refresh_token',
  }),
})
const token = (await tokenRes.json() as { access_token?: string }).access_token
if (!token) throw new Error('Sin access_token')

function tournamentDay(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms))
}

const all: Record<string, unknown>[] = []
let pageToken: string | undefined
do {
  const url =
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/matches?pageSize=300` +
    (pageToken ? `&pageToken=${pageToken}` : '')
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const json = (await res.json()) as { documents?: unknown[]; nextPageToken?: string }
  for (const doc of json.documents ?? []) {
    const d = decodeFirestoreDoc(doc as { name: string; fields?: Record<string, unknown> })
    const t = Date.parse(String(d.scheduledAt ?? ''))
    if (!Number.isFinite(t) || tournamentDay(t) !== day) continue
    all.push(d)
  }
  pageToken = json.nextPageToken
} while (pageToken)

all.sort(
  (a, b) =>
    Date.parse(String(a.scheduledAt ?? '')) - Date.parse(String(b.scheduledAt ?? '')),
)

console.log(JSON.stringify(all, null, 2))
