import type { Firestore } from 'firebase-admin/firestore'
import * as logger from 'firebase-functions/logger'
import { WC26_KO_MATCHES, koMatchDocId } from '../data/wc2026/knockoutBracket'
import type { MatchDoc } from './types/predictions'

function parseKoMatchNum(matchId: string): number | null {
  const m = /^wc26-ko-(\d+)$/.exec(matchId)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

function winnerTeamId(data: MatchDoc): string | null {
  const goalsA = data.goalsTeamA ?? data.goalsHome ?? null
  const goalsB = data.goalsTeamB ?? data.goalsAway ?? null
  if (goalsA === null || goalsB === null) return null

  const teamA = data.teamAId ?? data.teamHomeId ?? null
  const teamB = data.teamBId ?? data.teamAwayId ?? null

  if (goalsA > goalsB) return teamA
  if (goalsB > goalsA) return teamB

  // Empate en 90' → definición por penales
  if (data.penaltiesWinnerTeamA === true) return teamA
  if (data.penaltiesWinnerTeamB === true) return teamB
  if (data.penaltiesWinnerHome === true) return teamA
  if (data.penaltiesWinnerAway === true) return teamB

  return null
}

function loserTeamId(data: MatchDoc): string | null {
  const winner = winnerTeamId(data)
  if (!winner) return null
  const teamA = data.teamAId ?? data.teamHomeId ?? null
  const teamB = data.teamBId ?? data.teamAwayId ?? null
  if (winner === teamA) return teamB
  if (winner === teamB) return teamA
  return null
}

/**
 * Propaga el resultado de un partido KO finalizado al siguiente slot del cuadro.
 * Se llama desde onMatchWrite cuando status cambia a 'finished'.
 */
export async function propagateKoBracket(
  db: Firestore,
  matchId: string,
  data: MatchDoc,
): Promise<void> {
  if (data.phase !== 'knockout' || data.status !== 'finished') return

  const matchNum = parseKoMatchNum(matchId)
  if (!matchNum) return

  const winner = winnerTeamId(data)
  const loser = loserTeamId(data)

  if (!winner) {
    logger.warn(`[ko:bracket] matchId=${matchId} sin ganador determinado — penales no registrados aún`)
    return
  }

  const updates: { docId: string; patch: Record<string, string> }[] = []

  for (const next of WC26_KO_MATCHES) {
    const patch: Record<string, string> = {}

    if (next.home.kind === 'winner_of' && next.home.matchNum === matchNum) {
      patch.teamAId = winner
      patch.teamHomeId = winner
    }
    if (next.home.kind === 'loser_of' && next.home.matchNum === matchNum && loser) {
      patch.teamAId = loser
      patch.teamHomeId = loser
    }
    if (next.away.kind === 'winner_of' && next.away.matchNum === matchNum) {
      patch.teamBId = winner
      patch.teamAwayId = winner
    }
    if (next.away.kind === 'loser_of' && next.away.matchNum === matchNum && loser) {
      patch.teamBId = loser
      patch.teamAwayId = loser
    }

    if (Object.keys(patch).length > 0) {
      updates.push({ docId: koMatchDocId(next.matchNum), patch })
    }
  }

  if (updates.length === 0) {
    logger.info(`[ko:bracket] matchNum=${matchNum} sin slots siguientes en cuadro`)
    return
  }

  const writer = db.bulkWriter()
  for (const { docId, patch } of updates) {
    writer.set(db.collection('matches').doc(docId), patch, { merge: true })
  }
  await writer.close()

  logger.info(
    `[ko:bracket] matchNum=${matchNum} winner=${winner} → ${updates.map((u) => u.docId).join(', ')}`,
  )
}
