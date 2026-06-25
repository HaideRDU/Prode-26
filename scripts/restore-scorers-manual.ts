/**
 * Restaura scorers completos (un registro por gol, con minuto) para partidos cuya
 * data se degradó. Fuente: data original completa de API-Sports + minutos de los
 * highlights oficiales. Un mismo jugador puede aparecer varias veces (goles distintos).
 */
import './seed-load-env.ts'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { restPatchDoc } from './lib/firestoreRest.ts'

const FIREBASE_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com'
const FIREBASE_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi'
const projectId = 'polla-mundialist'

async function getAccessToken(): Promise<string> {
  const cfg = JSON.parse(readFileSync(join(homedir(), '.config/configstore/firebase-tools.json'), 'utf8'))
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: FIREBASE_CLIENT_ID,
      client_secret: FIREBASE_CLIENT_SECRET,
      refresh_token: cfg.tokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  return (await res.json()).access_token
}

type S = {
  playerKey: string
  playerName: string
  teamSide: 'teamA' | 'teamB'
  goals: number
  minute?: number
  theSportsDbPlayerId?: string
  ownGoal?: boolean
}

// Reconstrucción autoritativa: jugadores+lado de la data original completa de API-Sports,
// minutos de los highlights oficiales (TSDB web) donde se conocen.
const RESTORE: Record<string, { score: string; scorers: S[] }> = {
  // FRA 3-1 SEN — highlights: Mbappé 66', Barcola 82', Mbappé 90' / Mbaye 90'
  'wc26-I-01': {
    score: '3-1',
    scorers: [
      { playerKey: '4-kylian-mbappe', playerName: 'Kylian Mbappé', teamSide: 'teamA', goals: 1, minute: 66, theSportsDbPlayerId: '34162098' },
      { playerKey: '4-bradley-barcola', playerName: 'Bradley Barcola', teamSide: 'teamA', goals: 1, minute: 82, theSportsDbPlayerId: '34197250' },
      { playerKey: '4-kylian-mbappe', playerName: 'Kylian Mbappé', teamSide: 'teamA', goals: 1, minute: 90, theSportsDbPlayerId: '34162098' },
      { playerKey: '4-ibrahim-mbaye', playerName: 'Ibrahim Mbaye', teamSide: 'teamB', goals: 1, minute: 90 },
    ],
  },
  // ARG 3-0 ALG — highlights: Messi 17', 60', 76'
  'wc26-J-01': {
    score: '3-0',
    scorers: [
      { playerKey: '4-lionel-messi', playerName: 'Lionel Messi', teamSide: 'teamA', goals: 1, minute: 17 },
      { playerKey: '4-lionel-messi', playerName: 'Lionel Messi', teamSide: 'teamA', goals: 1, minute: 60 },
      { playerKey: '4-lionel-messi', playerName: 'Lionel Messi', teamSide: 'teamA', goals: 1, minute: 76 },
    ],
  },
  // USA 4-1 PAR — lista original API-Sports completa; minutos parciales (timeline TSDB)
  'wc26-D-01': {
    score: '4-1',
    scorers: [
      { playerKey: '3-damian-bobadilla', playerName: 'Damián Bobadilla', teamSide: 'teamA', goals: 1, minute: 7 },
      { playerKey: '4-folarin-balogun', playerName: 'Folarin Balogun', teamSide: 'teamA', goals: 1, minute: 31 },
      { playerKey: '4-folarin-balogun', playerName: 'Folarin Balogun', teamSide: 'teamA', goals: 1, minute: 45 },
      { playerKey: '3-giovanni-reyna', playerName: 'Giovanni Reyna', teamSide: 'teamA', goals: 1 },
      { playerKey: '3-mauricio', playerName: 'Maurício', teamSide: 'teamB', goals: 1 },
    ],
  },
  // GER 7-1 CUW — highlights completos: Nmecha 6', Schlotterbeck 38', Havertz 45+5'(P) y 88',
  // Musiala 47', Brown 68', Undav 78' / Comenencia 21'
  'wc26-E-01': {
    score: '7-1',
    scorers: [
      { playerKey: '3-felix-nmecha', playerName: 'Felix Nmecha', teamSide: 'teamA', goals: 1, minute: 6 },
      { playerKey: '3-livano-comenencia', playerName: 'Livano Comenencia', teamSide: 'teamB', goals: 1, minute: 21 },
      { playerKey: '2-nico-schlotterbeck', playerName: 'Nico Schlotterbeck', teamSide: 'teamA', goals: 1, minute: 38 },
      { playerKey: '4-kai-havertz', playerName: 'Kai Havertz', teamSide: 'teamA', goals: 1, minute: 45 },
      { playerKey: '3-jamal-musiala', playerName: 'Jamal Musiala', teamSide: 'teamA', goals: 1, minute: 47 },
      { playerKey: '2-nathaniel-brown', playerName: 'Nathaniel Brown', teamSide: 'teamA', goals: 1, minute: 68 },
      { playerKey: '4-deniz-undav', playerName: 'Deniz Undav', teamSide: 'teamA', goals: 1, minute: 78 },
      { playerKey: '4-kai-havertz', playerName: 'Kai Havertz', teamSide: 'teamA', goals: 1, minute: 88 },
    ],
  },
  // IRQ 1-4 NOR — highlights: Hussein 39' / Haaland 29', 43', Østigård 76', Hussein (autogol) 90+6'
  'wc26-I-02': {
    score: '1-4',
    scorers: [
      { playerKey: '4-erling-haaland', playerName: 'Erling Haaland', teamSide: 'teamB', goals: 1, minute: 29, theSportsDbPlayerId: '34169116' },
      { playerKey: '4-aymen-hussein', playerName: 'Aymen Hussein', teamSide: 'teamA', goals: 1, minute: 39, theSportsDbPlayerId: '34246295' },
      { playerKey: '4-erling-haaland', playerName: 'Erling Haaland', teamSide: 'teamB', goals: 1, minute: 43, theSportsDbPlayerId: '34169116' },
      { playerKey: '2-leo-stigard', playerName: 'Leo Østigård', teamSide: 'teamB', goals: 1, minute: 76 },
      { playerKey: '4-aymen-hussein', playerName: 'Aymen Hussein', teamSide: 'teamB', goals: 1, minute: 96, theSportsDbPlayerId: '34246295', ownGoal: true },
    ],
  },
  // AUT 3-1 JOR — highlights: Schmid 21', Al-Arab (autogol) 76', Arnautović 90' / Olwan 50'
  'wc26-J-02': {
    score: '3-1',
    scorers: [
      { playerKey: '3-romano-schmid', playerName: 'Romano Schmid', teamSide: 'teamA', goals: 1, minute: 21 },
      { playerKey: '4-ali-olwan', playerName: 'Ali Olwan', teamSide: 'teamB', goals: 1, minute: 50 },
      { playerKey: '2-yazan-al-arab', playerName: 'Yazan Al-Arab', teamSide: 'teamA', goals: 1, minute: 76, ownGoal: true },
      { playerKey: '4-marko-arnautovic', playerName: 'Marko Arnautović', teamSide: 'teamA', goals: 1, minute: 90 },
    ],
  },
  // IRN 2-2 NZL — lista original API-Sports completa; minutos parciales (timeline TSDB)
  'wc26-G-02': {
    score: '2-2',
    scorers: [
      { playerKey: '3-elijah-just', playerName: 'Elijah Just', teamSide: 'teamB', goals: 1, minute: 7 },
      { playerKey: '2-ramin-rezaeian', playerName: 'Ramin Rezaeian', teamSide: 'teamA', goals: 1, minute: 32 },
      { playerKey: '3-elijah-just', playerName: 'Elijah Just', teamSide: 'teamB', goals: 1, minute: 54 },
      { playerKey: '3-mohammad-mohebi', playerName: 'Mohammad Mohebi', teamSide: 'teamA', goals: 1 },
    ],
  },
}

const token = await getAccessToken()

for (const [matchId, { score, scorers }] of Object.entries(RESTORE)) {
  const sumA = scorers.filter((s) => s.teamSide === 'teamA').reduce((a, s) => a + s.goals, 0)
  const sumB = scorers.filter((s) => s.teamSide === 'teamB').reduce((a, s) => a + s.goals, 0)
  console.log(`\n${matchId} (oficial ${score}) → ${sumA}-${sumB}`)
  for (const s of scorers) console.log(`  [${s.teamSide}] ${s.playerName} ${s.minute ?? '?'}'`)
  if (`${sumA}-${sumB}` !== score) {
    console.log(`  ✗ La suma no coincide con el marcador oficial — NO se guarda`)
    continue
  }
  await restPatchDoc(projectId, `matches/${matchId}`, { scorers }, ['scorers'])
  console.log(`  → ✓ Guardado`)
}
