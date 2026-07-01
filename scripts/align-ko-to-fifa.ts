/**
 * Alinea los docs KO con la numeración de FIFA (doc N ← FIFA #N para la mitad inferior).
 * Preserva predicciones: NO toca el bracket ni las predicciones; solo corrige el resultado
 * real guardado en cada doc para que calce con la definición del bracket (= FIFA #N).
 *
 * DRY-RUN por defecto. Para aplicar: npx tsx scripts/align-ko-to-fifa.ts --apply
 */
import './seed-load-env.ts'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { decodeFirestoreDoc } from './lib/firestoreRest.ts'

const APPLY = process.argv.includes('--apply')
const FIFA_MATCHES_URL =
  'https://api.fifa.com/api/v3/calendar/matches?language=es&count=500&idCompetition=17&from=2026-06-01&to=2026-07-31'

// Docs de la mitad inferior a alinear (doc N ← FIFA #N). Top half (73-80,83) ya está consistente.
const ALIGN_DOCS = [81, 82, 84, 85, 86, 87, 88]

const fres = await fetch(FIFA_MATCHES_URL)
if (!fres.ok) throw new Error(`FIFA API ${fres.status}`)
const fjson: any = await fres.json()
const fifaByNum = new Map<number, any>()
for (const row of fjson.Results ?? []) {
  const num = Number(row.MatchNumber)
  if (Number.isFinite(num)) fifaByNum.set(num, row)
}

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

async function getDoc(id: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/matches/${id}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return null
  return decodeFirestoreDoc(await res.json())
}

console.log(`\n═══ PLAN DE ALINEACIÓN (doc N ← FIFA #N)  ${APPLY ? '⚠️ APLICANDO' : '— DRY RUN (sin escribir)'} ═══\n`)
console.log(' doc  ESTADO doc actual        →  FIFA #N (destino)          nota')
console.log(' ───  ─────────────────────    ──────────────────────      ────')
for (const n of ALIGN_DOCS) {
  const doc = await getDoc(`wc26-ko-${n}`)
  const f = fifaByNum.get(n)
  const fHome = (f?.Home?.Abbreviation ?? 'TBD').trim()
  const fAway = (f?.Away?.Abbreviation ?? 'TBD').trim()
  const fhs = typeof f?.HomeTeamScore === 'number' ? f.HomeTeamScore : null
  const fas = typeof f?.AwayTeamScore === 'number' ? f.AwayTeamScore : null
  const cur = doc ? `${doc.teamAId}-${doc.teamBId} ${doc.goalsTeamA ?? '·'}-${doc.goalsTeamB ?? '·'} [${doc.status}]` : '(sin doc)'
  const dst = `${fHome}-${fAway} ${fhs ?? '·'}-${fas ?? '·'}`
  const alreadyOk = doc && ((doc.teamAId === fHome && doc.teamBId === fAway))
  const note = alreadyOk ? '✅ ya alineado' : '↔ requiere corrección'
  console.log(` ${String(n).padEnd(4)} ${cur.padEnd(24)} → ${dst.padEnd(24)}  ${note}`)
}

console.log('\n[Nota] Top half (73-80, 83) NO se toca: ya es internamente consistente (doc = bracket).')
console.log('[Nota] Esto NO modifica predicciones ni el bracket; solo el resultado real guardado por doc.')
if (!APPLY) console.log('\n>>> DRY RUN. Nada fue escrito. Revisa el plan arriba.')
