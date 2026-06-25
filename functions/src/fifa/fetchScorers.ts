import type { Firestore } from 'firebase-admin/firestore'
import { normalizePlayerName, playerRefFromDoc } from '../lib/playerKeyMatch'
import type { MatchScorerEntry, TeamPlayerDoc } from '../lib/types/predictions'

const FIFA_COMPETITION_ID = '17'
const FIFA_SEASON_ID = '285023'

type FifaLocalized = { Locale?: string; Description?: string }

type FifaLivePlayer = {
  IdPlayer?: string
  PlayerName?: FifaLocalized[]
  ShortName?: FifaLocalized[]
}

type FifaLiveGoal = {
  Type?: number
  IdPlayer?: string
  Minute?: string
  IdTeam?: string
  Period?: number
}

type FifaLiveTeam = {
  IdTeam?: string
  IdCountry?: string
  Abbreviation?: string
  Players?: FifaLivePlayer[]
  Goals?: FifaLiveGoal[]
}

export type FifaLiveMatch = {
  HomeTeam?: FifaLiveTeam
  AwayTeam?: FifaLiveTeam
}

function playerDisplayName(player: FifaLivePlayer | undefined): string {
  if (!player) return ''
  return (
    player.PlayerName?.find((n) => n.Locale?.startsWith('es'))?.Description?.trim() ||
    player.PlayerName?.[0]?.Description?.trim() ||
    player.ShortName?.[0]?.Description?.trim() ||
    ''
  )
}

function parseFifaMinute(raw: string | null | undefined): number | null {
  if (!raw) return null
  const m = raw.match(/(\d+)/)
  return m ? parseInt(m[1]!, 10) : null
}

function teamSideForIso(iso: string | null, teamAId: string, teamBId: string): 'teamA' | 'teamB' | undefined {
  if (!iso) return undefined
  if (iso === teamAId) return 'teamA'
  if (iso === teamBId) return 'teamB'
  return undefined
}

async function resolveFifaPlayer(
  db: Firestore,
  teamAId: string,
  teamBId: string,
  fifaPlayerId: string,
  displayName: string,
  cache: Map<string, { playerKey: string; rosterName?: string }>,
): Promise<{ playerKey: string; rosterName?: string }> {
  const cached = cache.get(fifaPlayerId)
  if (cached) return cached

  const target = normalizePlayerName(displayName)
  if (target) {
    for (const teamId of [teamAId, teamBId]) {
      const snap = await db.collection('teams').doc(teamId).collection('players').get()
      for (const doc of snap.docs) {
        const data = doc.data() as TeamPlayerDoc
        const name = data.name?.trim()
        if (!name || normalizePlayerName(name) !== target) continue
        const ref = playerRefFromDoc(doc.id, data)
        const resolved = { playerKey: ref.playerKey, rosterName: name }
        cache.set(fifaPlayerId, resolved)
        return resolved
      }
    }
  }

  const fallback = {
    playerKey: `fifa-${fifaPlayerId}`,
    rosterName: displayName.trim() || undefined,
  }
  cache.set(fifaPlayerId, fallback)
  return fallback
}

export async function fetchFifaLiveMatch(
  idStage: string,
  idMatch: string,
  idSeason = FIFA_SEASON_ID,
): Promise<FifaLiveMatch> {
  const url = `https://api.fifa.com/api/v3/live/football/${FIFA_COMPETITION_ID}/${idSeason}/${idStage}/${idMatch}?language=es`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`FIFA live ${res.status}: ${await res.text()}`)
  return (await res.json()) as FifaLiveMatch
}

/** Goleadores desde HomeTeam.Goals / AwayTeam.Goals del endpoint live de FIFA. */
export async function fetchScorersFromFifaLive(
  db: Firestore,
  live: FifaLiveMatch,
  teamAId: string,
  teamBId: string,
): Promise<MatchScorerEntry[]> {
  const home = live.HomeTeam
  const away = live.AwayTeam
  if (!home || !away) return []

  const playersById = new Map<string, FifaLivePlayer>()
  for (const p of [...(home.Players ?? []), ...(away.Players ?? [])]) {
    if (p.IdPlayer) playersById.set(p.IdPlayer, p)
  }

  const scorers: MatchScorerEntry[] = []
  const cache = new Map<string, { playerKey: string; rosterName?: string }>()

  const sides: Array<{ goals: FifaLiveGoal[]; benefitsIso: string | null }> = [
    { goals: home.Goals ?? [], benefitsIso: home.IdCountry ?? home.Abbreviation ?? null },
    { goals: away.Goals ?? [], benefitsIso: away.IdCountry ?? away.Abbreviation ?? null },
  ]

  for (const { goals, benefitsIso } of sides) {
    const teamSide = teamSideForIso(benefitsIso, teamAId, teamBId)
    for (const goal of goals) {
      if (!goal.IdPlayer) continue
      // Type 2 = gol; Type 3 = autogol (observado en datos FIFA WC2026).
      if (goal.Type !== 2 && goal.Type !== 3) continue

      const player = playersById.get(goal.IdPlayer)
      const displayName = playerDisplayName(player)
      const { playerKey, rosterName } = await resolveFifaPlayer(
        db,
        teamAId,
        teamBId,
        goal.IdPlayer,
        displayName,
        cache,
      )
      const minute = parseFifaMinute(goal.Minute)
      scorers.push({
        playerKey,
        goals: 1,
        ...(goal.Type === 3 ? { ownGoal: true } : {}),
        ...(rosterName || displayName ? { playerName: rosterName || displayName } : {}),
        ...(minute != null ? { minute } : {}),
        ...(teamSide ? { teamSide } : {}),
      })
    }
  }

  scorers.sort((a, b) => {
    const ma = a.minute ?? 9999
    const mb = b.minute ?? 9999
    if (ma !== mb) return ma - mb
    return a.playerKey.localeCompare(b.playerKey)
  })

  return scorers
}
