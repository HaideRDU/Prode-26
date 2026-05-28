import type { Firestore } from 'firebase-admin/firestore'
import { FieldValue } from 'firebase-admin/firestore'
import { EXTRA_IDS } from '../../src/data/questionIds.ts'
import {
  getChampionAndRunnerUpFromPredictions,
  getThirdAndFourthFromPredictions,
} from '../../src/domain/bracketResolve.ts'
import { groupScoresMapFromFinished } from './wc26BracketCascade.ts'
import { penaltiesWinnerFlagsFromPayload } from '../../src/domain/matchPenalties.ts'
import type { MatchDoc, MatchPredictionPayload, TournamentResultDoc } from '../../src/types/predictions.ts'
import { koMatchDocId } from '../../src/data/wc2026/knockoutBracket.ts'

function koScoresFromFinishedMatches(
  matches: Array<{ id: string; phase?: string; status?: string } & MatchDoc>,
): Map<string, MatchPredictionPayload> {
  const out = new Map<string, MatchPredictionPayload>()
  for (const m of matches) {
    if (m.phase !== 'knockout' || m.status !== 'finished' || !m.id.startsWith('wc26-ko-')) continue
    const gh = m.goalsTeamA ?? m.goalsHome
    const ga = m.goalsTeamB ?? m.goalsAway
    if (typeof gh !== 'number' || typeof ga !== 'number') continue
    const pens = penaltiesWinnerFlagsFromPayload(m)
    out.set(m.id, {
      goalsHome: gh,
      goalsAway: ga,
      goalsTeamA: gh,
      goalsTeamB: ga,
      ...(pens.wentToPenalties === true
        ? {
            wentToPenalties: true,
            ...(pens.penaltiesWinnerTeamA !== null
              ? {
                  penaltiesWinnerTeamA: pens.penaltiesWinnerTeamA,
                  penaltiesWinnerTeamB: pens.penaltiesWinnerTeamB!,
                  penaltiesWinnerHome: pens.penaltiesWinnerHome!,
                  penaltiesWinnerAway: pens.penaltiesWinnerAway!,
                }
              : {}),
          }
        : {}),
    })
  }
  return out
}

export type PodiumOfficial = {
  championId: string | null
  runnerUpId: string | null
  thirdId: string | null
  fourthId: string | null
}

export function derivePodiumFromMatches(
  matches: Array<{ id: string; phase?: string; status?: string } & MatchDoc>,
): PodiumOfficial {
  const groupScores = groupScoresMapFromFinished(matches)
  const koScores = koScoresFromFinishedMatches(matches)
  const { championId, runnerUpId } = getChampionAndRunnerUpFromPredictions(groupScores, koScores)
  const { thirdId, fourthId } = getThirdAndFourthFromPredictions(groupScores, koScores)
  return { championId, runnerUpId, thirdId, fourthId }
}

export async function writeTournamentResultsPodium(
  db: Firestore,
  podium: PodiumOfficial,
): Promise<string[]> {
  const written: string[] = []
  const entries: Array<{ id: string; teamId: string | null }> = [
    { id: EXTRA_IDS.champion, teamId: podium.championId },
    { id: EXTRA_IDS.runnerUp, teamId: podium.runnerUpId },
    { id: EXTRA_IDS.thirdPlace, teamId: podium.thirdId },
    { id: EXTRA_IDS.fourthPlace, teamId: podium.fourthId },
  ]

  const writer = db.bulkWriter()
  for (const { id, teamId } of entries) {
    if (!teamId) continue
    const doc: TournamentResultDoc = {
      questionId: id,
      resolved: true,
      answer: { kind: 'team', teamId },
      updatedAt: FieldValue.serverTimestamp(),
    }
    writer.set(db.collection('tournamentResults').doc(id), doc, { merge: true })
    written.push(`${id}=${teamId}`)
  }
  await writer.close()
  return written
}

/** Sincroniza podio oficial en tournamentResults desde matches/ terminados. */
export async function syncTournamentResultsFromMatches(db: Firestore): Promise<{
  podium: PodiumOfficial
  written: string[]
}> {
  const snap = await db.collection('matches').get()
  const matches = snap.docs.map((d) => ({ id: d.id, ...(d.data() as MatchDoc) }))
  const podium = derivePodiumFromMatches(matches)
  const written = await writeTournamentResultsPodium(db, podium)
  return { podium, written }
}

export function formatPodiumLog(podium: PodiumOfficial): Record<string, string | null> {
  return {
    champion: podium.championId,
    runnerUp: podium.runnerUpId,
    third: podium.thirdId,
    fourth: podium.fourthId,
    finalMatchId: koMatchDocId(104),
    thirdPlaceMatchId: koMatchDocId(103),
  }
}
