import type { DocumentReference, Firestore } from 'firebase-admin/firestore'
import type { TeamPlayerDoc } from '../lib/types/predictions'
import type { PaniniPlayerRow, PaniniRostersFile, Wc2026TeamRow } from './types'

export type RosterSyncSource = 'panini' | 'manual'

export interface SyncPaniniRostersOptions {
  dryRun?: boolean
  rosterSource?: RosterSyncSource
}

export interface SyncPaniniRostersResult {
  synced: number
  skipped: number
  deletedPlayers: number
  errors: string[]
  syncedTeams: { teamId: string; nameEs: string; playerCount: number }[]
  skippedTeams: { teamId: string; nameEs: string; playerCount: number; reason: string }[]
}

function mapPlayerToDoc(row: PaniniPlayerRow, syncedAt: Date): TeamPlayerDoc {
  return {
    name: row.name,
    paniniStickerCode: row.stickerCode,
    paniniSlot: row.paniniSlot,
    syncedAt,
  }
}

async function deleteExistingPlayers(
  db: Firestore,
  teamRef: DocumentReference,
  dryRun: boolean,
): Promise<number> {
  const snap = await teamRef.collection('players').get()
  if (snap.empty) return 0
  if (dryRun) return snap.size

  const batch = db.batch()
  for (const doc of snap.docs) {
    batch.delete(doc.ref)
  }
  await batch.commit()
  return snap.size
}

/**
 * Importa plantillas Panini desde JSON estático hacia teams/{ISO}/players/{stickerCode}.
 * Reemplaza por completo la subcolección players del equipo.
 */
export async function syncPaniniRosters(
  db: Firestore,
  file: PaniniRostersFile,
  teams: readonly Wc2026TeamRow[],
  options: SyncPaniniRostersOptions = {},
): Promise<SyncPaniniRostersResult> {
  const rosterSource = options.rosterSource ?? 'panini'
  const result: SyncPaniniRostersResult = {
    synced: 0,
    skipped: 0,
    deletedPlayers: 0,
    errors: [],
    syncedTeams: [],
    skippedTeams: [],
  }

  const syncedAt = new Date()

  for (const team of teams) {
    const players = file.teams[team.teamId]
    if (!players?.length) {
      result.skipped += 1
      result.skippedTeams.push({
        teamId: team.teamId,
        nameEs: team.nameEs,
        playerCount: 0,
        reason: `sin_datos_${rosterSource}`,
      })
      continue
    }

    try {
      if (options.dryRun) {
        result.synced += 1
        result.syncedTeams.push({
          teamId: team.teamId,
          nameEs: team.nameEs,
          playerCount: players.length,
        })
        continue
      }

      const teamRef = db.collection('teams').doc(team.teamId)
      const deleted = await deleteExistingPlayers(db, teamRef, false)
      result.deletedPlayers += deleted

      const writer = db.bulkWriter()
      writer.set(
        teamRef,
        {
          rosterSyncedAt: syncedAt,
          rosterPlayerCount: players.length,
          rosterSource,
        },
        { merge: true },
      )

      for (const row of players) {
        const playerRef = teamRef.collection('players').doc(row.stickerCode)
        writer.set(playerRef, mapPlayerToDoc(row, syncedAt))
      }

      await writer.close()

      result.synced += 1
      result.syncedTeams.push({
        teamId: team.teamId,
        nameEs: team.nameEs,
        playerCount: players.length,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      result.errors.push(`${team.teamId}: ${msg}`)
      result.skipped += 1
      result.skippedTeams.push({
        teamId: team.teamId,
        nameEs: team.nameEs,
        playerCount: players.length,
        reason: msg,
      })
    }
  }

  return result
}
