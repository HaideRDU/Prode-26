import type { Firestore } from 'firebase-admin/firestore'
import type { MatchDoc, TeamPlayerDoc } from './types/predictions'
import { type PlayerRef, playerRefFromDoc } from './playerKeyMatch'

/** Índice playerKey / docId / theSportsDbPlayerId → PlayerRef */
export type PlayerRosterIndex = Map<string, PlayerRef>

export async function buildPlayerRosterIndex(
  db: Firestore,
  teamIds: Iterable<string>,
): Promise<PlayerRosterIndex> {
  const index: PlayerRosterIndex = new Map()
  const unique = [...new Set([...teamIds].filter(Boolean))]

  await Promise.all(
    unique.map(async (teamId) => {
      const snap = await db.collection('teams').doc(teamId).collection('players').get()
      for (const doc of snap.docs) {
        const ref = playerRefFromDoc(doc.id, doc.data() as TeamPlayerDoc)
        index.set(ref.playerKey, ref)
        if (doc.id !== ref.playerKey) index.set(doc.id, ref)
        if (ref.theSportsDbPlayerId) index.set(ref.theSportsDbPlayerId, ref)
        if (ref.apiSportsPlayerId != null) index.set(String(ref.apiSportsPlayerId), ref)
      }
    }),
  )

  return index
}

export function teamIdsFromMatches(matches: Iterable<MatchDoc>): string[] {
  const ids = new Set<string>()
  for (const m of matches) {
    const a = m.teamAId ?? m.teamHomeId
    const b = m.teamBId ?? m.teamAwayId
    if (a) ids.add(a)
    if (b) ids.add(b)
  }
  return [...ids]
}

export function resolvePickPlayer(
  playerKey: string,
  rosterIndex: PlayerRosterIndex | undefined,
): PlayerRef {
  const trimmed = playerKey.trim()
  return rosterIndex?.get(trimmed) ?? { playerKey: trimmed }
}
