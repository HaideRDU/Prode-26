import './seed-load-env.ts'

import { applicationDefault, getApp, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  process.env.VITE_FIREBASE_PROJECT_ID

const GLOBAL_ROOM_ID = 'global'
const DEFAULT_RULESET_ID = 'wc2026_v1'

initializeApp({
  credential: applicationDefault(),
  ...(projectId ? { projectId } : {}),
})

const resolvedProject = getApp().options.projectId ?? projectId ?? '(check ADC json)'
const db = getFirestore()
const auth = getAuth()

function envFlag(name: string): boolean {
  const v = (process.env[name] ?? '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'y'
}

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

async function cleanupUsers(): Promise<{ userDocs: number; predictionStateDocs: number }> {
  const userRefs = await db.collection('users').listDocuments()
  if (userRefs.length === 0) return { userDocs: 0, predictionStateDocs: 0 }

  const writer = db.bulkWriter()
  let predictionStateDocs = 0
  let userDocs = 0

  for (const userRef of userRefs) {
    const psRefs = await userRef.collection('predictionState').listDocuments()
    for (const psRef of psRefs) {
      writer.delete(psRef)
      predictionStateDocs++
    }
    writer.delete(userRef)
    userDocs++
  }

  await writer.close()
  return { userDocs, predictionStateDocs }
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

async function ensureGlobalRoom(): Promise<void> {
  const ref = db.collection('rooms').doc(GLOBAL_ROOM_ID)
  await ref.set(
    {
      name: 'Sala Global',
      description: 'Sala global (recreada automáticamente por cleanup).',
      inviteCode: 'GLOBAL',
      maxMembers: 100,
      createdBy: 'system',
      createdAt: new Date(),
      type: 'global',
      rulesetId: DEFAULT_RULESET_ID,
    },
    { merge: true },
  )
}

async function cleanupAuthUsers(): Promise<number> {
  // Firebase Auth Admin: borra todos los usuarios. Es destructivo, se controla por flag.
  let nextPageToken: string | undefined
  const uids: string[] = []
  do {
    const res = await auth.listUsers(1000, nextPageToken)
    for (const u of res.users) uids.push(u.uid)
    nextPageToken = res.pageToken
  } while (nextPageToken)

  if (uids.length === 0) return 0

  let deleted = 0
  for (let i = 0; i < uids.length; i += 1000) {
    const batch = uids.slice(i, i + 1000)
    const res = await auth.deleteUsers(batch)
    deleted += res.successCount
    if (res.failureCount) {
      console.warn('[cleanup] Auth delete failures:', res.errors.slice(0, 5))
    }
  }
  return deleted
}

async function countCollection(path: string): Promise<number> {
  const refs = await db.collection(path).listDocuments()
  return refs.length
}

async function main(): Promise<void> {
  console.log('[cleanup] Firebase Admin projectId:', resolvedProject)
  console.log(
    '[cleanup] This will delete collections: predictions, roomMembers, rooms, standings (+ standings/*/users/*), users (+ users/*/predictionState/*)',
  )
  console.log('[cleanup] It will keep collections: teams, matches (unless flags change)')

  const wipeTournamentResults = envFlag('CLEANUP_WIPE_TOURNAMENT_RESULTS')
  const deleteAuthUsers = envFlag('CLEANUP_DELETE_AUTH_USERS')
  const keepGlobalRoom = envFlag('CLEANUP_KEEP_GLOBAL_ROOM')

  console.log('[cleanup] Flags:')
  console.log('  - CLEANUP_KEEP_GLOBAL_ROOM:', keepGlobalRoom)
  console.log('  - CLEANUP_WIPE_TOURNAMENT_RESULTS:', wipeTournamentResults)
  console.log('  - CLEANUP_DELETE_AUTH_USERS:', deleteAuthUsers)

  console.log('[cleanup] Deleting predictions...')
  const deletedPredictions = await deleteCollectionDocs('predictions')
  console.log('[cleanup] Deleting roomMembers...')
  const deletedRoomMembers = await deleteCollectionDocs('roomMembers')
  console.log('[cleanup] Deleting rooms...')
  const deletedRooms = await deleteCollectionDocs('rooms')
  console.log('[cleanup] Deleting standings...')
  const standings = await cleanupStandings()
  console.log('[cleanup] Deleting users + predictionState...')
  const users = await cleanupUsers()

  let deletedResults = 0
  if (wipeTournamentResults) {
    console.log('[cleanup] Deleting tournamentResults...')
    deletedResults = await deleteCollectionDocs('tournamentResults')
  }

  let deletedAuth = 0
  if (deleteAuthUsers) {
    console.log('[cleanup] Deleting Firebase Auth users...')
    deletedAuth = await cleanupAuthUsers()
  }

  if (keepGlobalRoom) {
    console.log(`[cleanup] Recreating rooms/${GLOBAL_ROOM_ID}...`)
    await ensureGlobalRoom()
  }

  console.log('[cleanup] Deleted predictions:', deletedPredictions)
  console.log('[cleanup] Deleted roomMembers:', deletedRoomMembers)
  console.log('[cleanup] Deleted rooms:', deletedRooms)
  console.log('[cleanup] Deleted standings user docs:', standings.userDocs)
  console.log('[cleanup] Deleted standings room docs:', standings.rootDocs)
  console.log('[cleanup] Deleted users predictionState docs:', users.predictionStateDocs)
  console.log('[cleanup] Deleted users root docs:', users.userDocs)
  if (wipeTournamentResults) console.log('[cleanup] Deleted tournamentResults:', deletedResults)
  if (deleteAuthUsers) console.log('[cleanup] Deleted Auth users:', deletedAuth)

  const predictionsLeft = await countCollection('predictions')
  const roomMembersLeft = await countCollection('roomMembers')
  const roomsLeft = await countCollection('rooms')
  const standingsLeft = await countCollection('standings')
  const usersLeft = await countCollection('users')
  const teamsLeft = await countCollection('teams')
  const matchesLeft = await countCollection('matches')
  const resultsLeft = await countCollection('tournamentResults')

  console.log('[cleanup] Remaining predictions:', predictionsLeft)
  console.log('[cleanup] Remaining roomMembers:', roomMembersLeft)
  console.log('[cleanup] Remaining rooms:', roomsLeft)
  console.log('[cleanup] Remaining standings:', standingsLeft)
  console.log('[cleanup] Remaining users:', usersLeft)
  console.log('[cleanup] Base data kept -> teams:', teamsLeft)
  console.log('[cleanup] Base data kept -> matches:', matchesLeft)
  console.log('[cleanup] Base data kept -> tournamentResults:', resultsLeft)
}

main().catch((err) => {
  console.error('[cleanup] Failed:', err)
  process.exit(1)
})
