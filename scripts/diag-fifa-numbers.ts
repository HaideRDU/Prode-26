/**
 * Compara el # de partido de FIFA (API oficial) vs nuestro doc wc26-ko-N.
 * Solo lectura. Uso: npx tsx scripts/diag-fifa-numbers.ts
 */
import './seed-load-env.ts'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { decodeFirestoreDoc } from './lib/firestoreRest.ts'

const FIFA_MATCHES_URL =
  'https://api.fifa.com/api/v3/calendar/matches?language=es&count=500&idCompetition=17&from=2026-06-01&to=2026-07-31'

// ── 1) FIFA API ──
const fres = await fetch(FIFA_MATCHES_URL)
if (!fres.ok) throw new Error(`FIFA API ${fres.status}`)
const fjson: any = await fres.json()
const fifaByNum = new Map<number, { home: string; away: string; hs: number | null; as: number | null }>()
for (const row of fjson.Results ?? []) {
  const num = Number(row.MatchNumber)
  if (!Number.isFinite(num) || num < 73 || num > 104) continue
  const home = (row.Home?.Abbreviation ?? row.Home?.IdCountry ?? 'TBD')?.trim()
  const away = (row.Away?.Abbreviation ?? row.Away?.IdCountry ?? 'TBD')?.trim()
  fifaByNum.set(num, {
    home, away,
    hs: typeof row.HomeTeamScore === 'number' ? row.HomeTeamScore : null,
    as: typeof row.AwayTeamScore === 'number' ? row.AwayTeamScore : null,
  })
}

// ── 2) Nuestros docs ──
const FIREBASE_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com'
const FIREBASE_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi'
const projectId = 'polla-mundialist'
const cfg = JSON.parse(readFileSync(join(homedir(), '.config/configstore/firebase-tools.json'), 'utf8'))
const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ client_id: FIREBASE_CLIENT_ID, client_secret: FIREBASE_CLIENT_SECRET, refresh_token: cfg.tokens.refresh_token, grant_type: 'refresh_token' }),
})
const token = (await tokenRes.json() as { access_token?: string }).access_token
if (!token) throw new Error('Sin access_token')
const oursByNum = new Map<number, { a: string; b: string; ga: any; gb: any }>()
for (let n = 73; n <= 104; n++) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/matches/wc26-ko-${n}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) continue
  const d = decodeFirestoreDoc(await res.json())
  oursByNum.set(n, { a: d.teamAId ?? 'TBD', b: d.teamBId ?? 'TBD', ga: d.goalsTeamA ?? null, gb: d.goalsTeamB ?? null })
}

// Normalizador de códigos para comparar (FIFA a veces usa 3 letras distintas)
const norm = (s: string) => (s ?? '').toUpperCase().trim()
function samePair(f: { home: string; away: string }, o: { a: string; b: string }): boolean {
  const F = [norm(f.home), norm(f.away)].sort()
  const O = [norm(o.a), norm(o.b)].sort()
  return F[0] === O[0] && F[1] === O[1]
}

console.log('\n═══ COMPARACIÓN: # FIFA vs # NUESTRO (mismo número) ═══\n')
console.log(' N    FIFA #N (teams)          NUESTRO doc-N (teams)      ¿mismo partido en ese N?')
console.log(' ──   ──────────────────────   ────────────────────────   ────────────────────────')
for (let n = 73; n <= 88; n++) {
  const f = fifaByNum.get(n)
  const o = oursByNum.get(n)
  const fStr = f ? `${f.home} vs ${f.away}` : '(sin dato FIFA)'
  const oStr = o ? `${o.a} vs ${o.b}` : '(sin doc)'
  const same = f && o && f.home !== 'TBD' && o.a !== 'TBD' ? (samePair(f, o) ? '✅ igual' : '❌ DISTINTO') : '—'
  console.log(` ${String(n).padEnd(4)} ${fStr.padEnd(24)} ${oStr.padEnd(26)} ${same}`)
}

// ── 3) Mapa inverso: cada partido real, ¿en qué # lo tiene FIFA y en qué # lo tenemos? ──
console.log('\n═══ MAPA: dónde está cada partido (por pareja de equipos) ═══\n')
console.log(' Partido (equipos)        # FIFA   # nuestro   ¿desfase?')
console.log(' ──────────────────────   ──────   ─────────   ─────────')
for (const [fn, f] of [...fifaByNum.entries()].filter(([n]) => n <= 88).sort((a, b) => a[0] - b[0])) {
  if (f.home === 'TBD' || f.away === 'TBD') continue
  // buscar en qué doc-N tenemos esta misma pareja
  let ourN: number | null = null
  for (const [on, o] of oursByNum) {
    if (o.a !== 'TBD' && samePair(f, o)) { ourN = on; break }
  }
  const flag = ourN == null ? '(no está en docs)' : ourN === fn ? '✅ mismo #' : `❌ desfase (FIFA ${fn} → doc ${ourN})`
  console.log(` ${`${f.home} vs ${f.away}`.padEnd(24)} ${String(fn).padEnd(8)} ${String(ourN ?? '—').padEnd(11)} ${flag}`)
}
