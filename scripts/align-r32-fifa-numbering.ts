/**
 * Aligns R32 Firestore match IDs and prediction matchIds to FIFA numbering.
 *
 * The current DB has several R32 fixtures under local numbers that differ from
 * the official FIFA match number. This script moves both the match documents
 * and every prediction tied to those match IDs so predictions stay attached to
 * the same fixture after the number changes.
 *
 * Usage:
 *   npx tsx scripts/align-r32-fifa-numbering.ts --dry-run
 *   npx tsx scripts/align-r32-fifa-numbering.ts --apply
 */
import './seed-load-env.ts'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

const args = new Set(process.argv.slice(2))
const apply = args.has('--apply')

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

const oldToFifa = new Map<number, number>([
  [73, 73],
  [75, 74],
  [76, 75],
  [74, 76],
  [78, 77],
  [77, 78],
  [79, 79],
  [80, 80],
  [85, 81],
  [81, 82],
  [83, 83],
  [82, 84],
  [84, 85],
  [87, 86],
  [88, 87],
  [86, 88],
])

function matchId(n: number): string {
  return `wc26-ko-${n}`
}

function parseMatchNum(id: string): number | null {
  const m = /^wc26-ko-(\d+)$/.exec(id)
  if (!m) return null
  const n = Number(m[1])
  return oldToFifa.has(n) ? n : null
}

function remapDocId(id: string, from: string, to: string): string {
  if (!id.includes(from)) {
    throw new Error(`Cannot remap prediction doc id ${id}; missing ${from}`)
  }
  return id.replace(from, to)
}

async function loadMatches() {
  const out: Record<string, FirebaseFirestore.DocumentData> = {}
  for (const oldNum of oldToFifa.keys()) {
    const id = matchId(oldNum)
    const snap = await db.collection('matches').doc(id).get()
    if (!snap.exists) throw new Error(`Missing matches/${id}`)
    out[id] = snap.data() ?? {}
  }
  return out
}

async function loadPredictions() {
  const out: Array<{ id: string; data: FirebaseFirestore.DocumentData }> = []
  for (const oldNum of oldToFifa.keys()) {
    const id = matchId(oldNum)
    const snap = await db.collection('predictions').where('matchId', '==', id).get()
    snap.forEach((doc) => out.push({ id: doc.id, data: doc.data() }))
  }
  return out
}

function backupPayload(
  matches: Record<string, FirebaseFirestore.DocumentData>,
  predictions: Array<{ id: string; data: FirebaseFirestore.DocumentData }>,
) {
  return {
    createdAt: new Date().toISOString(),
    projectId,
    mapping: Object.fromEntries([...oldToFifa].map(([oldNum, fifaNum]) => [matchId(oldNum), matchId(fifaNum)])),
    matches,
    predictions,
  }
}

function saveBackup(payload: unknown): string {
  const dir = join(process.cwd(), 'backups')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const path = join(dir, `r32-fifa-align-${stamp}.json`)
  writeFileSync(path, JSON.stringify(payload, null, 2), 'utf8')
  return path
}

async function writeMatches(
  writer: FirebaseFirestore.BulkWriter,
  matches: Record<string, FirebaseFirestore.DocumentData>,
) {
  for (const [oldId, data] of Object.entries(matches)) {
    const oldNum = parseMatchNum(oldId)
    if (oldNum == null) continue
    const fifaNum = oldToFifa.get(oldNum)!
    writer.set(db.collection('matches').doc(matchId(fifaNum)), data)
  }
}

async function writePredictions(
  writer: FirebaseFirestore.BulkWriter,
  predictions: Array<{ id: string; data: FirebaseFirestore.DocumentData }>,
) {
  const targetIds = new Set<string>()
  const sourceIds = new Set<string>()
  const writes: Array<{ sourceId: string; targetId: string; data: FirebaseFirestore.DocumentData }> = []

  for (const pred of predictions) {
    const oldMatchId = pred.data.matchId
    if (typeof oldMatchId !== 'string') continue
    const oldNum = parseMatchNum(oldMatchId)
    if (oldNum == null) continue
    const newMatchId = matchId(oldToFifa.get(oldNum)!)
    const targetId = remapDocId(pred.id, oldMatchId, newMatchId)
    sourceIds.add(pred.id)
    targetIds.add(targetId)
    writes.push({
      sourceId: pred.id,
      targetId,
      data: { ...pred.data, matchId: newMatchId },
    })
  }

  for (const w of writes) {
    writer.set(db.collection('predictions').doc(w.targetId), w.data)
  }

  for (const sourceId of sourceIds) {
    if (!targetIds.has(sourceId)) {
      writer.delete(db.collection('predictions').doc(sourceId))
    }
  }

  return { writes: writes.length, deletes: [...sourceIds].filter((id) => !targetIds.has(id)).length }
}

async function printPlan(
  matches: Record<string, FirebaseFirestore.DocumentData>,
  predictions: Array<{ id: string; data: FirebaseFirestore.DocumentData }>,
) {
  console.log(`[align-r32] project=${projectId ?? '(default)'}`)
  console.log(`[align-r32] mode=${apply ? 'APPLY' : 'DRY-RUN'}`)
  console.log('[align-r32] matches:')
  for (const [oldNum, fifaNum] of oldToFifa) {
    const from = matchId(oldNum)
    const to = matchId(fifaNum)
    const m = matches[from]
    console.log(`  ${from} -> ${to}: ${m.teamAId ?? '?'} vs ${m.teamBId ?? '?'} (${m.status ?? '?'})`)
  }

  const counts = new Map<string, number>()
  for (const pred of predictions) {
    const oldMatchId = pred.data.matchId
    if (typeof oldMatchId !== 'string') continue
    counts.set(oldMatchId, (counts.get(oldMatchId) ?? 0) + 1)
  }
  console.log('[align-r32] predictions:')
  for (const [oldNum, fifaNum] of oldToFifa) {
    const from = matchId(oldNum)
    console.log(`  ${from} -> ${matchId(fifaNum)}: ${counts.get(from) ?? 0} doc(s)`)
  }
}

async function verify(db: Firestore) {
  const expectedByFifa = new Map<number, string>([
    [73, 'RSA-CAN'],
    [74, 'GER-PAR'],
    [75, 'NED-MAR'],
    [76, 'BRA-JPN'],
    [77, 'FRA-SWE'],
    [78, 'CIV-NOR'],
    [79, 'MEX-ECU'],
    [80, 'ENG-COD'],
    [81, 'USA-BIH'],
    [82, 'BEL-SEN'],
    [83, 'POR-CRO'],
    [84, 'ESP-AUT'],
    [85, 'SUI-ALG'],
    [86, 'ARG-CPV'],
    [87, 'COL-GHA'],
    [88, 'AUS-EGY'],
  ])
  for (const [num, expected] of expectedByFifa) {
    const snap = await db.collection('matches').doc(matchId(num)).get()
    const m = snap.data() ?? {}
    const actual = `${m.teamAId ?? '?'}-${m.teamBId ?? '?'}`
    if (actual !== expected) {
      throw new Error(`Verification failed for ${matchId(num)}: expected ${expected}, got ${actual}`)
    }
  }
}

async function main() {
  const matches = await loadMatches()
  const predictions = await loadPredictions()
  const backupPath = saveBackup(backupPayload(matches, predictions))
  await printPlan(matches, predictions)
  console.log(`[align-r32] backup=${backupPath}`)

  if (!apply) {
    console.log('[align-r32] Dry run complete. Re-run with --apply to write Firestore.')
    return
  }

  const writer = db.bulkWriter()
  await writeMatches(writer, matches)
  const predResult = await writePredictions(writer, predictions)
  await writer.close()
  await verify(db)
  console.log(`[align-r32] Applied. predictions writes=${predResult.writes}, deletes=${predResult.deletes}`)
}

main().catch((e) => {
  console.error('[align-r32] ERROR:', e)
  process.exit(1)
})
