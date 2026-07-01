/**
 * AUDITORÍA COMPLETA del bracket KO: compara los equipos que el código deriva
 * (usando standings REALES de grupos) contra los equipos REALES de cada doc en Firestore.
 * No modifica nada — solo lectura. Uso: npx tsx scripts/audit-bracket-full.ts
 */
import './seed-load-env.ts'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { decodeFirestoreDoc } from './lib/firestoreRest.ts'
import { WC26_KO_MATCHES } from '../src/data/wc2026/knockoutBracket.ts'
import { THIRD_ASSIGNMENT_ORDER, THIRD_SLOT_ELIGIBLE, assignThirdsToR32Slots } from '../src/domain/assignThirdsGreedy.ts'
import { computeGroupStandings, orderedGroupIds, topEightThirds } from '../src/domain/groupStandings.ts'
import { propagateKoWinners, resolveKoMatchTeams } from '../src/domain/bracketResolve.ts'
import type { MatchPredictionPayload } from '../src/types/predictions.ts'

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

const all: any[] = []
let pageToken
do {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/matches?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const json: any = await res.json()
  for (const doc of json.documents ?? []) { const d = decodeFirestoreDoc(doc); d.__id = doc.name.split('/').pop(); all.push(d) }
  pageToken = json.nextPageToken
} while (pageToken)

// 1) Consistencia interna: cada third_slot del bracket debe existir en la tabla de terceros
console.log('═══ 1. CONSISTENCIA BRACKET ↔ TABLA DE TERCEROS ═══\n')
const bracketThirdSlots = WC26_KO_MATCHES
  .filter(m => (m.home as any).kind === 'third_slot' || (m.away as any).kind === 'third_slot')
  .map(m => ((m.home as any).kind === 'third_slot' ? (m.home as any).matchNum : (m.away as any).matchNum))
  .sort((a, b) => a - b)
const tableKeys = [...THIRD_ASSIGNMENT_ORDER].sort((a, b) => a - b)
const eligibleKeys = Object.keys(THIRD_SLOT_ELIGIBLE).map(Number).sort((a, b) => a - b)
console.log('  Bracket usa third_slot en:', bracketThirdSlots.join(', '))
console.log('  THIRD_ASSIGNMENT_ORDER:   ', tableKeys.join(', '))
console.log('  THIRD_SLOT_ELIGIBLE keys: ', eligibleKeys.join(', '))
const setEq = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i])
console.log('  ¿Coinciden bracket↔order?', setEq(bracketThirdSlots, tableKeys) ? '✅ SÍ' : '❌ NO')
console.log('  ¿Coinciden order↔eligible?', setEq(tableKeys, eligibleKeys) ? '✅ SÍ' : '❌ NO')

// 2) Standings REALES de grupos (desde resultados finales en Firestore)
const realGroupPreds = new Map<string, MatchPredictionPayload>()
for (const m of all) {
  if (m.phase === 'group' && m.status === 'finished' && typeof m.goalsTeamA === 'number' && typeof m.goalsTeamB === 'number') {
    realGroupPreds.set(m.__id, { goalsTeamA: m.goalsTeamA, goalsTeamB: m.goalsTeamB } as MatchPredictionPayload)
  }
}
const tablesByGroup = new Map<string, ReturnType<typeof computeGroupStandings>>()
for (const g of orderedGroupIds()) tablesByGroup.set(g, computeGroupStandings(g, realGroupPreds))
const realThirds = topEightThirds(realGroupPreds)
const realThirdByMatchNum = assignThirdsToR32Slots(realThirds)
const realWinnerByMatchNum = propagateKoWinners(new Map(), tablesByGroup, realThirdByMatchNum)

console.log('\n═══ 2. R32: BRACKET (con standings reales) vs DOC REAL ═══\n')
console.log('  M#   BRACKET DERIVA          DOC REAL              ¿OK?')
console.log('  ──   ─────────────────────   ───────────────────   ────')
let mismatches = 0
for (const m of WC26_KO_MATCHES.filter(x => x.round === 'r32')) {
  const { teamAId, teamBId } = resolveKoMatchTeams(m.matchNum, tablesByGroup, realThirdByMatchNum, realWinnerByMatchNum)
  const doc = all.find(d => d.__id === `wc26-ko-${m.matchNum}`)
  const realA = doc?.teamAId ?? null, realB = doc?.teamBId ?? null
  const derived = `${teamAId ?? '∅'} vs ${teamBId ?? '∅'}`
  const real = realA ? `${realA} vs ${realB}` : '(sin equipos)'
  // Comparación sin importar orden local/visitante
  const ok = realA && teamAId && teamBId && (
    (teamAId === realA && teamBId === realB) || (teamAId === realB && teamBId === realA)
  )
  const missing = !teamAId || !teamBId
  const flag = !realA ? '—' : missing ? '❌ NULL' : ok ? '✅' : '❌ DIF'
  if (realA && !ok) mismatches++
  console.log(`  M${String(m.matchNum).padEnd(3)} ${derived.padEnd(23)} ${real.padEnd(21)} ${flag}`)
}

console.log(`\n═══ RESUMEN: ${mismatches === 0 ? '✅ 0 desajustes en R32' : `❌ ${mismatches} desajustes`} ═══`)

// 3) Terceros reales asignados por slot
console.log('\n═══ 3. ASIGNACIÓN REAL DE TERCEROS POR SLOT ═══\n')
for (const slot of THIRD_ASSIGNMENT_ORDER) {
  const tid = realThirdByMatchNum.get(slot)
  console.log(`  slot ${slot}: ${tid ?? '∅ (sin asignar)'}`)
}

// 4) BLUEPRINT REAL: rol de cada equipo en cada doc R32 (para reconstruir el bracket)
console.log('\n═══ 4. BLUEPRINT REAL (rol por doc) ═══\n')
function roleOf(teamId: string): string {
  for (const g of orderedGroupIds()) {
    const rows = tablesByGroup.get(g)!
    const idx = rows.findIndex((r: any) => r.teamId === teamId)
    if (idx === 0) return `1${g}`
    if (idx === 1) return `2${g}`
    if (idx === 2) return `3${g}`
    if (idx === 3) return `4${g}`
  }
  return '??'
}
for (let n = 73; n <= 88; n++) {
  const doc = all.find(d => d.__id === `wc26-ko-${n}`)
  if (!doc?.teamAId) { console.log(`  M${n}: (sin equipos)`); continue }
  console.log(`  M${n}: ${roleOf(doc.teamAId)} (${doc.teamAId}) vs ${roleOf(doc.teamBId)} (${doc.teamBId})`)
}
