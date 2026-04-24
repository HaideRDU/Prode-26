import './seed-load-env.ts'

import { applicationDefault, getApp, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  process.env.VITE_FIREBASE_PROJECT_ID

initializeApp({
  credential: applicationDefault(),
  ...(projectId ? { projectId } : {}),
})

const resolvedProject = getApp().options.projectId ?? projectId ?? '(check ADC json)'
const db = getFirestore()

async function deleteCollectionDocs(path: string): Promise<number> {
  const refs = await db.collection(path).listDocuments()
  if (refs.length === 0) return 0
  const writer = db.bulkWriter()
  let deleted = 0
  for (const ref of refs) {
    writer.delete(ref)
    deleted++
  }
  await writer.close()
  return deleted
}

async function cleanupStandings(): Promise<{ userDocs: number; rootDocs: number }> {
  const roomRefs = await db.collection('standings').listDocuments()
  if (roomRefs.length === 0) return { userDocs: 0, rootDocs: 0 }

  const writer = db.bulkWriter()
  let userDocs = 0
  let rootDocs = 0

  for (const roomRef of roomRefs) {
    const userRefs = await roomRef.collection('users').listDocuments()
    for (const userRef of userRefs) {
      writer.delete(userRef)
      userDocs++
    }
    writer.delete(roomRef)
    rootDocs++
  }

  await writer.close()
  return { userDocs, rootDocs }
}

async function countCollection(path: string): Promise<number> {
  const refs = await db.collection(path).listDocuments()
  return refs.length
}

async function main(): Promise<void> {
  console.log('[cleanup] Firebase Admin projectId:', resolvedProject)
  console.log(
    '[cleanup] This will delete collections: predictions, roomMembers, rooms, standings (+ standings/*/users/*)',
  )
  console.log('[cleanup] It will keep collections: teams, matches, tournamentResults')

  console.log('[cleanup] Deleting predictions...')
  const deletedPredictions = await deleteCollectionDocs('predictions')
  console.log('[cleanup] Deleting roomMembers...')
  const deletedRoomMembers = await deleteCollectionDocs('roomMembers')
  console.log('[cleanup] Deleting rooms...')
  const deletedRooms = await deleteCollectionDocs('rooms')
  console.log('[cleanup] Deleting standings...')
  const standings = await cleanupStandings()

  console.log('[cleanup] Deleted predictions:', deletedPredictions)
  console.log('[cleanup] Deleted roomMembers:', deletedRoomMembers)
  console.log('[cleanup] Deleted rooms:', deletedRooms)
  console.log('[cleanup] Deleted standings user docs:', standings.userDocs)
  console.log('[cleanup] Deleted standings room docs:', standings.rootDocs)

  const predictionsLeft = await countCollection('predictions')
  const roomMembersLeft = await countCollection('roomMembers')
  const roomsLeft = await countCollection('rooms')
  const standingsLeft = await countCollection('standings')
  const teamsLeft = await countCollection('teams')
  const matchesLeft = await countCollection('matches')
  const resultsLeft = await countCollection('tournamentResults')

  console.log('[cleanup] Remaining predictions:', predictionsLeft)
  console.log('[cleanup] Remaining roomMembers:', roomMembersLeft)
  console.log('[cleanup] Remaining rooms:', roomsLeft)
  console.log('[cleanup] Remaining standings:', standingsLeft)
  console.log('[cleanup] Base data kept -> teams:', teamsLeft)
  console.log('[cleanup] Base data kept -> matches:', matchesLeft)
  console.log('[cleanup] Base data kept -> tournamentResults:', resultsLeft)
}

main().catch((err) => {
  console.error('[cleanup] Failed:', err)
  process.exit(1)
})
