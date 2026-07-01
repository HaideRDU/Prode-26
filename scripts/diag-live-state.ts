/**
 * Diagnóstico: estado real en Firestore de los KO R32 + partidos de hoy.
 * Solo lectura. Uso: npx tsx scripts/diag-live-state.ts
 */
import './seed-load-env.ts'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { decodeFirestoreDoc } from './lib/firestoreRest.ts'

const FIREBASE_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com'
const FIREBASE_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi'
const projectId = 'polla-mundialist'

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

const all: any[] = []
let pageToken
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

const nowMs = Date.now()
function bogota(ms: number | null): string {
  if (ms == null) return '?'
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(ms))
}
function toMs(v: any): number | null {
  if (!v) return null
  if (typeof v === 'object' && 'seconds' in v) return v.seconds * 1000
  if (typeof v?.toDate === 'function') return v.toDate().getTime()
  const ms = Date.parse(String(v))
  return Number.isFinite(ms) ? ms : null
}

console.log(`\n=== AHORA: ${bogota(nowMs)} (Bogotá GMT-5) ===\n`)

// KO R32 (73-88)
console.log('── KNOCKOUT R32 (wc26-ko-73..88) ──')
console.log('id           status     score   pen?  kickoff(Bog)   flags')
const kos = all.filter(m => /^wc26-ko-(7[3-9]|8[0-8])$/.test(m.__id)).sort((a,b)=>a.__id.localeCompare(b.__id))
for (const m of kos) {
  const kMs = toMs(m.scheduledAt)
  const started = kMs != null && nowMs >= kMs
  const flags: string[] = []
  if (m.status === 'live' && kMs != null && nowMs < kMs) flags.push('⚠️LIVE-ANTES-DE-KICKOFF')
  if (m.status === 'live' && kMs != null && nowMs - kMs > 3*3600*1000) flags.push('⚠️LIVE->3h(atascado?)')
  if (m.wentToPenalties && m.status !== 'finished') flags.push('⚠️PEN-no-finished')
  console.log(
    `${m.__id.padEnd(12)} ${String(m.status).padEnd(10)} ${String(m.goalsTeamA)}-${String(m.goalsTeamB)}`.padEnd(34) +
    ` ${m.wentToPenalties?'PEN':'   '}  ${bogota(kMs).padEnd(14)} ${flags.join(' ')}`
  )
}

// Partidos de hoy (cualquier fase) en día Bogotá
console.log('\n── PARTIDOS HOY (día Bogotá) ──')
function dayBog(ms: number|null){ return ms==null?'':new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota'}).format(new Date(ms)) }
const today = dayBog(nowMs)
const todays = all.filter(m => dayBog(toMs(m.scheduledAt)) === today).sort((a,b)=> (toMs(a.scheduledAt)??0)-(toMs(b.scheduledAt)??0))
for (const m of todays) {
  const kMs = toMs(m.scheduledAt)
  const flag = m.status === 'live' && kMs != null && nowMs < kMs ? '  ⚠️ LIVE pero kickoff futuro' : ''
  console.log(`${m.__id.padEnd(12)} ${String(m.status).padEnd(10)} ${m.teamAId}-${m.teamBId} ${m.goalsTeamA}-${m.goalsTeamB}  ${bogota(kMs)}${flag}`)
}
console.log('')
