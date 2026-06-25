/**
 * Parcha los 3 autogoles que tienen teamSide correcto pero les falta ownGoal: true.
 * Verificado contra: ESPN, FIFA, Sky Sports, Outlook India.
 *
 * - wc26-D-01 Bobadilla 7'  → Paraguayan OG for USA (CBS Sports: "Bobadilla own goal")
 * - wc26-D-03 Burgess 11'   → Australian OG for USA  (Outlook India: "Burgess' Own Goal")
 * - wc26-G-01 Hany 66'      → Egyptian OG for BEL   (FIFA report: "Hany own goal")
 */
import './seed-load-env.ts'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { restPatchDoc, decodeFirestoreDoc } from './lib/firestoreRest.ts'

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

async function getMatch(token: string, matchId: string): Promise<Record<string, unknown>> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/matches/${matchId}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  return decodeFirestoreDoc(await res.json())
}

// Identificados por minuto (único en cada partido). playerName es solo para log.
const FIXES: Record<string, { minute: number; playerName: string }[]> = {
  'wc26-D-01': [{ minute: 7,  playerName: 'Damián Bobadilla (PAR)' }],
  'wc26-D-03': [{ minute: 11, playerName: 'Cameron Burgess (AUS)' }],
  'wc26-G-01': [{ minute: 66, playerName: 'Mohamed Hany (EGY)' }],
}

const token = await getAccessToken()

for (const [matchId, fixes] of Object.entries(FIXES)) {
  const match = await getMatch(token, matchId)
  const scorers = (match.scorers ?? []) as Record<string, unknown>[]
  let changed = false

  for (const fix of fixes) {
    const idx = scorers.findIndex((s) => s.minute === fix.minute)
    if (idx === -1) {
      console.log(`✗ [${matchId}] No encontrado minuto ${fix.minute}' — ${fix.playerName}`)
      continue
    }
    if (scorers[idx]!.ownGoal === true) {
      console.log(`~ [${matchId}] Ya tiene ownGoal=true: ${fix.playerName} ${fix.minute}'`)
      continue
    }
    console.log(`  Antes: ${JSON.stringify(scorers[idx])}`)
    scorers[idx] = { ...scorers[idx], ownGoal: true }
    console.log(`  Después: ${JSON.stringify(scorers[idx])}`)
    changed = true
  }

  if (changed) {
    await restPatchDoc(projectId, `matches/${matchId}`, { scorers }, ['scorers'])
    console.log(`✓ [${matchId}] Guardado — ${fixes.map((f) => f.playerName).join(', ')}`)
  }
}

console.log('\nListo.')
