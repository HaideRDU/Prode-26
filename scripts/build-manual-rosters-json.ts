/**
 * Genera src/data/wc2026/manualRosters.json desde manualRostersSource.ts
 */
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WC2026_TEAMS_BY_GROUP } from '../src/data/wc2026/teamsByGroup.ts'
import {
  MANUAL_ROSTER_NAMES_BY_TEAM,
  MANUAL_ROSTERS_SOURCE,
  MANUAL_ROSTERS_VERSION,
} from '../src/data/wc2026/manualRostersSource.ts'
import type { PaniniRostersFile } from '../src/data/wc2026/paniniRosterTypes.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '../src/data/wc2026/manualRosters.json')

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

const teams: PaniniRostersFile['teams'] = {}
let totalPlayers = 0
const missing: string[] = []

for (const { teamId, nameEs } of WC2026_TEAMS_BY_GROUP) {
  const names = MANUAL_ROSTER_NAMES_BY_TEAM[teamId]
  if (!names?.length) {
    missing.push(`${teamId} (${nameEs})`)
    continue
  }
  teams[teamId] = names.map((name, i) => {
    const slot = i + 1
    return {
      stickerCode: `${teamId}${pad2(slot)}`,
      name,
      paniniSlot: slot,
    }
  })
  totalPlayers += names.length
}

if (missing.length > 0) {
  console.error('[build-manual-rosters] Equipos sin plantilla en manualRostersSource.ts:')
  for (const m of missing) console.error(`  - ${m}`)
  process.exit(1)
}

const file: PaniniRostersFile = {
  source: MANUAL_ROSTERS_SOURCE,
  version: MANUAL_ROSTERS_VERSION,
  teams,
}

writeFileSync(OUT, `${JSON.stringify(file, null, 2)}\n`, 'utf8')
console.log(
  `[build-manual-rosters] OK → ${OUT} (${WC2026_TEAMS_BY_GROUP.length} equipos, ${totalPlayers} jugadores)`,
)
