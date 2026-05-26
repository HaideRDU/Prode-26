import './seed-load-env.ts'

/**
 * Vuelca la fase de grupos (72 partidos) en Firestore `matches/{matchId}`.
 *
 * Requisitos:
 * - Variable de entorno GOOGLE_APPLICATION_CREDENTIALS apuntando al JSON de cuenta de servicio
 *   con permisos de escritura en Firestore, o credenciales por defecto de gcloud (`gcloud auth application-default login`).
 * - ID del proyecto Firebase: define `FIREBASE_PROJECT_ID` (recomendado) o `GOOGLE_CLOUD_PROJECT` /
 *   `GCLOUD_PROJECT` si Application Default Credentials no incluyen project_id.
 *
 * Uso:
 *   npm run seed:group-matches
 *   npm run seed:wc2026-group-stage   (equipos + partidos en un solo paso)
 *
 * Origen de datos: solo `src/data/wc2026/groupStageSchedule.ts` (transcripción desde PDF FIFA).
 */
import { getApp, initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { GROUP_STAGE_SCHEDULE, GROUP_STAGE_MATCH_COUNT } from '../src/data/wc2026/groupStageSchedule.ts'

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
console.log('[seed:group-matches] Firebase Admin projectId:', resolvedProject)

const db = getFirestore()

async function main(): Promise<void> {
  if (GROUP_STAGE_MATCH_COUNT !== 72) {
    throw new Error(`Se esperaban 72 partidos de grupos, hay ${GROUP_STAGE_MATCH_COUNT}`)
  }

  const batch = db.batch()
  for (const row of GROUP_STAGE_SCHEDULE) {
    const ref = db.collection('matches').doc(row.matchId)
    batch.set(
      ref,
      {
        teamHomeId: row.teamHomeId,
        teamAwayId: row.teamAwayId,
        teamAId: row.teamHomeId,
        teamBId: row.teamAwayId,
        goalsHome: null,
        goalsAway: null,
        goalsTeamA: null,
        goalsTeamB: null,
        phase: 'group',
        groupId: row.groupId,
        scheduledAt: Timestamp.fromDate(new Date(row.scheduledAt)),
        status: 'scheduled',
      },
      { merge: true },
    )
  }
  await batch.commit()
  console.log(`OK: ${GROUP_STAGE_MATCH_COUNT} documentos escritos en matches/ (merge)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
