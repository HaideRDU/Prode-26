import type { Firestore } from 'firebase-admin/firestore'
import { WC26_KO_BY_NUM, WC26_KO_MATCHES, koMatchDocId, type KoBracketSide } from '../data/wc2026/knockoutBracket'
import type { MatchDoc } from './types/predictions'

type KoOutcome = {
  winnerId: string
  loserId: string
}

function koMatchNumFromId(matchId: string): number | null {
  const m = /^wc26-ko-(\d+)$/.exec(matchId)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

function penaltiesWinnerIsTeamA(match: MatchDoc): boolean | null {
  if (match.wentToPenalties !== true) return null
  if (match.penaltiesWinnerTeamA != null) return match.penaltiesWinnerTeamA
  if (match.penaltiesWinnerTeamB != null) return !match.penaltiesWinnerTeamB
  if (match.penaltiesWinnerHome != null) return match.penaltiesWinnerHome
  if (match.penaltiesWinnerAway != null) return !match.penaltiesWinnerAway
  return null
}

function outcomeFromMatch(match: MatchDoc): KoOutcome | null {
  if (match.phase !== 'knockout' || match.status !== 'finished') return null
  const teamAId = match.teamAId ?? match.teamHomeId
  const teamBId = match.teamBId ?? match.teamAwayId
  const goalsTeamA = match.goalsTeamA ?? match.goalsHome
  const goalsTeamB = match.goalsTeamB ?? match.goalsAway
  if (!teamAId || !teamBId || goalsTeamA == null || goalsTeamB == null) return null

  if (goalsTeamA > goalsTeamB) return { winnerId: teamAId, loserId: teamBId }
  if (goalsTeamB > goalsTeamA) return { winnerId: teamBId, loserId: teamAId }

  const penA = penaltiesWinnerIsTeamA(match)
  if (penA === true) return { winnerId: teamAId, loserId: teamBId }
  if (penA === false) return { winnerId: teamBId, loserId: teamAId }
  return null
}

function resolveSide(side: KoBracketSide, outcomes: Map<number, KoOutcome>): string | null {
  if (side.kind === 'winner_of') return outcomes.get(side.matchNum)?.winnerId ?? null
  if (side.kind === 'loser_of') return outcomes.get(side.matchNum)?.loserId ?? null
  return null
}

/**
 * Propaga clasificados reales en el cuadro KO.
 *
 * Cuando termina un partido (incluidos empates definidos por penales), rellena
 * los `teamAId/teamBId` del siguiente cruce oficial. Solo escribe si hay cambio.
 */
export async function cascadeOfficialKoMatchTeams(db: Firestore): Promise<{ updated: number }> {
  const snap = await db.collection('matches').get()
  const matchesByNum = new Map<number, MatchDoc>()
  snap.forEach((doc) => {
    const num = koMatchNumFromId(doc.id)
    if (num == null) return
    matchesByNum.set(num, doc.data() as MatchDoc)
  })

  const outcomes = new Map<number, KoOutcome>()
  const sortedNums = [...WC26_KO_BY_NUM.keys()].sort((a, b) => a - b)
  for (const num of sortedNums) {
    const match = matchesByNum.get(num)
    if (!match) continue
    const outcome = outcomeFromMatch(match)
    if (outcome) outcomes.set(num, outcome)
  }

  const writer = db.bulkWriter()
  let updated = 0
  for (const template of WC26_KO_MATCHES) {
    if (template.round === 'r32') continue
    const teamAId = resolveSide(template.home, outcomes)
    const teamBId = resolveSide(template.away, outcomes)

    const matchId = koMatchDocId(template.matchNum)
    const current = matchesByNum.get(template.matchNum)
    const patch: Record<string, unknown> = {
      phase: 'knockout',
      round: template.round,
    }
    if (teamAId) {
      patch.teamAId = teamAId
      patch.teamHomeId = teamAId
    } else if (current?.teamAId || current?.teamHomeId) {
      patch.teamAId = null
      patch.teamHomeId = null
    }
    if (teamBId) {
      patch.teamBId = teamBId
      patch.teamAwayId = teamBId
    } else if (current?.teamBId || current?.teamAwayId) {
      patch.teamBId = null
      patch.teamAwayId = null
    }

    if (
      (teamAId
        ? current?.teamAId === teamAId && current?.teamHomeId === teamAId
        : !current?.teamAId && !current?.teamHomeId) &&
      (teamBId
        ? current?.teamBId === teamBId && current?.teamAwayId === teamBId
        : !current?.teamBId && !current?.teamAwayId) &&
      current?.phase === 'knockout' &&
      current?.round === template.round
    ) {
      continue
    }

    writer.set(
      db.collection('matches').doc(matchId),
      patch,
      { merge: true },
    )
    updated += 1
  }

  await writer.close()
  return { updated }
}
