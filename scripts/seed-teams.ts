import './seed-load-env.ts'

/**
 * Vuelca las 48 selecciones del Mundial 2026 (fase de grupos) en Firestore `teams/{teamId}`.
 *
 * Mismas credenciales y variables que `seed-group-matches.ts`.
 *
 * Uso:
 *   npm run seed:teams
 *
 * Origen: `src/data/wc2026/teamsByGroup.ts`
 */
import { getApp, initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { WC2026_TEAMS_BY_GROUP, WC2026_TEAM_COUNT } from '../src/data/wc2026/teamsByGroup.ts'

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  process.env.VITE_FIREBASE_PROJECT_ID

initializeApp({
  credential: applicationDefault(),
  ...(projectId ? { projectId } : {}),
})

const resolvedProject = getApp().options.projectId ?? projectId ?? '(ver JSON ADC)'
console.log('[seed:teams] Firebase Admin projectId:', resolvedProject)

const db = getFirestore()

async function main(): Promise<void> {
  if (WC2026_TEAM_COUNT !== 48) {
    throw new Error(`Se esperaban 48 equipos, hay ${WC2026_TEAM_COUNT}`)
  }

  const batch = db.batch()
  for (const row of WC2026_TEAMS_BY_GROUP) {
    const ref = db.collection('teams').doc(row.teamId)
    batch.set(
      ref,
      {
        teamId: row.teamId,
        groupId: row.groupId,
        nameEs: row.nameEs,
      },
      { merge: true },
    )
  }
  await batch.commit()
  console.log(`OK: ${WC2026_TEAM_COUNT} documentos escritos en teams/ (merge)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
