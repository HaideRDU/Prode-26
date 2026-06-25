import './seed-load-env.ts'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { restGetDoc } from './lib/firestoreRest.ts'

const projectId = 'polla-mundialist'

async function getAccessToken(): Promise<string> {
  const cfg = JSON.parse(readFileSync(join(homedir(), '.config/configstore/firebase-tools.json'), 'utf8'))
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
      client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
      refresh_token: cfg.tokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  return (await res.json()).access_token
}

function decodeValue(v: Record<string, unknown>): unknown {
  if ('stringValue' in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('booleanValue' in v) return v.booleanValue
  if ('nullValue' in v) return null
  if ('timestampValue' in v) return v.timestampValue
  if ('mapValue' in v) {
    const fields = (v.mapValue as { fields?: Record<string, unknown> }).fields ?? {}
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(fields)) out[k] = decodeValue(val as Record<string, unknown>)
    return out
  }
  if ('arrayValue' in v) {
    const values = (v.arrayValue as { values?: Record<string, unknown>[] }).values ?? []
    return values.map((x) => decodeValue(x))
  }
  return v
}

const token = await getAccessToken()
const matchId = 'wc26-E-05'

const match = await restGetDoc(projectId, `matches/${matchId}`)
console.log('=== MATCH ===')
console.log(JSON.stringify(match, null, 2))

// Query predictions for this match
const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`
const res = await fetch(url, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    structuredQuery: {
      from: [{ collectionId: 'predictions' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'matchId' },
          op: 'EQUAL',
          value: { stringValue: matchId },
        },
      },
    },
  }),
})
const rows = (await res.json()) as Array<{ document?: { name: string; fields: Record<string, unknown> } }>
console.log('\n=== PREDICTIONS (player_per_match) ===')
for (const row of rows) {
  if (!row.document) continue
  const id = row.document.name.split('/').pop()
  const fields: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row.document.fields)) fields[k] = decodeValue(v as Record<string, unknown>)
  if (fields.scope !== 'player_per_match') continue
  console.log(id, JSON.stringify(fields, null, 2))
}

// GER roster keys sample
const ger = await restGetDoc(projectId, 'teams/GER')
console.log('\n=== GER team doc keys ===')
console.log(ger ? Object.keys(ger) : 'no doc')
