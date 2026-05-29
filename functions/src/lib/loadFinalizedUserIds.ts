import type { Firestore } from 'firebase-admin/firestore'

/** Usuarios que cerraron su pronóstico en esta sala (Guardar predicción). */
export async function loadFinalizedUserIds(
  db: Firestore,
  roomId: string,
  userIds: string[],
): Promise<Set<string>> {
  const unique = [...new Set(userIds)]
  const finalized = new Set<string>()
  await Promise.all(
    unique.map(async (uid) => {
      const snap = await db.collection('users').doc(uid).collection('predictionState').doc(roomId).get()
      if (!snap.exists) return
      const data = snap.data() as { predictionFinalized?: boolean }
      if (data.predictionFinalized === true) finalized.add(uid)
    }),
  )
  return finalized
}

export function filterPredictionsForStandings<T extends { userId: string }>(
  predictions: T[],
  finalizedUserIds: ReadonlySet<string>,
): T[] {
  return predictions.filter((p) => finalizedUserIds.has(p.userId))
}
