import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const FIREBASE_CLIENT_ID =
  '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com'
const FIREBASE_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi'

let accessToken: string | null = null

async function getAccessToken(): Promise<string> {
  if (accessToken) return accessToken
  const cfg = JSON.parse(
    readFileSync(join(homedir(), '.config/configstore/firebase-tools.json'), 'utf8'),
  ) as { tokens?: { refresh_token?: string } }
  const refresh = cfg.tokens?.refresh_token
  if (!refresh) throw new Error('Sin firebase login')

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: FIREBASE_CLIENT_ID,
      client_secret: FIREBASE_CLIENT_SECRET,
      refresh_token: refresh,
      grant_type: 'refresh_token',
    }),
  })
  const json = (await res.json()) as { access_token?: string }
  if (!json.access_token) throw new Error('No access_token')
  accessToken = json.access_token
  return accessToken
}

export function encodeFirestoreValue(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return { nullValue: null }
  if (typeof value === 'string') return { stringValue: value }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return { integerValue: String(value) }
    return { doubleValue: value }
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map((v) => encodeFirestoreValue(v)) } }
  }
  if (typeof value === 'object') {
    const fields: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue
      fields[k] = encodeFirestoreValue(v)
    }
    return { mapValue: { fields } }
  }
  return { stringValue: String(value) }
}

function decodeFirestoreValue(v: Record<string, unknown>): unknown {
  if ('stringValue' in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('booleanValue' in v) return v.booleanValue
  if ('nullValue' in v) return null
  if ('timestampValue' in v) return v.timestampValue
  if ('mapValue' in v) {
    const fields = (v.mapValue as { fields?: Record<string, unknown> }).fields ?? {}
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(fields)) out[k] = decodeFirestoreValue(val as Record<string, unknown>)
    return out
  }
  if ('arrayValue' in v) {
    const values = (v.arrayValue as { values?: Record<string, unknown>[] }).values ?? []
    return values.map((x) => decodeFirestoreValue(x))
  }
  return v
}

export function decodeFirestoreDoc(doc: {
  name: string
  fields?: Record<string, unknown>
}): Record<string, unknown> & { id: string } {
  const out: Record<string, unknown> & { id: string } = {
    id: doc.name.split('/').pop() ?? '',
  }
  for (const [k, v] of Object.entries(doc.fields ?? {})) {
    out[k] = decodeFirestoreValue(v as Record<string, unknown>)
  }
  return out
}

export async function restGetDoc(
  projectId: string,
  path: string,
): Promise<(Record<string, unknown> & { id: string }) | null> {
  const token = await getAccessToken()
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GET ${path}: ${res.status} ${await res.text()}`)
  return decodeFirestoreDoc(await res.json())
}

export async function restPatchDoc(
  projectId: string,
  path: string,
  data: Record<string, unknown>,
  fieldPaths: string[],
): Promise<void> {
  const token = await getAccessToken()
  const mask = fieldPaths.map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&')
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}?${mask}`
  const fields: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) fields[k] = encodeFirestoreValue(v)
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) throw new Error(`PATCH ${path}: ${res.status} ${await res.text()}`)
}
