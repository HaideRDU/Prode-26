/**
 * Busca en TODAS las predicciones de bracket KO quién predijo BRA vs JPN
 * (o JPN vs BRA) para el partido wc26-ko-74.
 *
 * Uso: npx tsx scripts/find-bra-jpn-preds.ts
 */
import './seed-load-env.ts'
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import type { PredictionDoc } from '../functions/lib/lib/types/predictions.js'
import { getPredictedKoLineupForMatch } from '../functions/lib/lib/koPredictedLineup.js'

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.VITE_FIREBASE_PROJECT_ID

if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), ...(projectId ? { projectId } : {}) })
}

const db = getFirestore()

async function main(): Promise<void> {
  const matchId = 'wc26-ko-74'

  // Cargar todas las predicciones
  const predsSnap = await db.collection('predictions').get()
  const allPreds: PredictionDoc[] = []
  predsSnap.forEach((d) => allPreds.push({ id: d.id, ...(d.data() as PredictionDoc) }))

  // Cargar nombres de usuarios
  const usersSnap = await db.collection('users').get()
  const userNames = new Map<string, string>()
  usersSnap.forEach((d) => {
    const data = d.data()
    userNames.set(d.id, data.displayName ?? data.username ?? d.id)
  })

  // Agrupar por (userId, roomId) y para cada grupo buscar el cruce predicho
  type GroupKey = string
  const groups = new Map<GroupKey, PredictionDoc[]>()
  for (const p of allPreds) {
    const key = `${p.userId}||${p.roomId}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(p)
  }

  const hits: { userId: string; roomId: string; name: string; predA: string; predB: string }[] = []
  const checked: string[] = []

  for (const [key, preds] of groups) {
    const [userId, roomId] = key.split('||') as [string, string]
    const lineup = getPredictedKoLineupForMatch(preds, matchId)
    const a = lineup.predictedTeamAId ?? ''
    const b = lineup.predictedTeamBId ?? ''

    if (!a && !b) continue

    checked.push(`  ${userNames.get(userId) ?? userId} (${roomId}): ${a || '?'} vs ${b || '?'}`)

    const isBraJpn =
      (a === 'BRA' || b === 'BRA') && (a === 'JPN' || b === 'JPN')

    if (isBraJpn) {
      hits.push({ userId, roomId, name: userNames.get(userId) ?? userId, predA: a, predB: b })
    }
  }

  console.log(`\nTotal combinaciones usuario+sala analizadas: ${groups.size}`)
  console.log('\n── Todos los cruces predichos para wc26-ko-74 ──')
  for (const line of checked) console.log(line)

  console.log('\n══ USUARIOS QUE PREDIJERON BRA vs JPN ══')
  if (hits.length === 0) {
    console.log('  ❌ Nadie predijo BRA vs JPN en ninguna sala.')
  } else {
    for (const h of hits) {
      console.log(`  ✅ ${h.name} (userId=${h.userId}) sala=${h.roomId}  →  ${h.predA} vs ${h.predB}`)
    }
  }
}

main().catch((e) => {
  console.error('[find-bra-jpn-preds] ERROR', e)
  process.exit(1)
})
