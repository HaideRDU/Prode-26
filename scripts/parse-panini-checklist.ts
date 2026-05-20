/**
 * Parsea checklist Panini (texto) → src/data/wc2026/paniniRosters.json
 *
 * Uso:
 *   npm run parse:panini-checklist
 *   npm run parse:panini-checklist -- --input=data/wc2026/panini-checklist.txt
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WC2026_TEAMS_BY_GROUP } from '../src/data/wc2026/teamsByGroup.ts'
import type { PaniniPlayerRow, PaniniRostersFile } from '../src/data/wc2026/paniniRosterTypes.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const VALID_TEAM_IDS = new Set(WC2026_TEAMS_BY_GROUP.map((t) => t.teamId))

/** Typos en checklist público → ISO-3 Prode */
const PANINI_PREFIX_ALIASES: Record<string, string> = {
  SWI: 'SUI',
  KAS: 'KSA',
}

const SKIP_SLOTS = new Set([1, 13])

function parseInputArg(): string {
  const flag = process.argv.find((a) => a.startsWith('--input='))
  if (flag) return flag.slice('--input='.length)
  return join(ROOT, 'data/wc2026/panini-checklist.txt')
}

function normalizePrefix(raw: string): string | null {
  const upper = raw.toUpperCase()
  const mapped = PANINI_PREFIX_ALIASES[upper] ?? upper
  return VALID_TEAM_IDS.has(mapped) ? mapped : null
}

function parseLine(line: string): PaniniPlayerRow | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  const m = trimmed.match(/^([A-Za-z]{3})(\d{1,2})\s+(.+?)\s+-\s+.+$/i)
  if (!m) return null

  const prefixRaw = m[1].toUpperCase()
  if (prefixRaw === 'FWC' || prefixRaw.length !== 3) return null

  const teamId = normalizePrefix(prefixRaw)
  if (!teamId) return null

  const paniniSlot = Number.parseInt(m[2], 10)
  if (SKIP_SLOTS.has(paniniSlot)) return null

  let name = m[3].trim()
  if (name.endsWith(' FOIL')) name = name.slice(0, -5).trim()
  if (/^team\s+(logo|photo)/i.test(name)) return null

  const stickerCode = `${teamId}${paniniSlot}`
  return { stickerCode, name, paniniSlot }
}

function main(): void {
  const inputPath = parseInputArg()
  const outPath = join(ROOT, 'src/data/wc2026/paniniRosters.json')
  const raw = readFileSync(inputPath, 'utf8')
  const lines = raw.split(/\r?\n/)

  const teams: Record<string, PaniniPlayerRow[]> = {}
  const seenCodes = new Set<string>()
  const orphans: string[] = []
  let skippedLines = 0

  for (const line of lines) {
    const row = parseLine(line)
    if (!row) {
      if (line.trim()) skippedLines++
      continue
    }
    if (seenCodes.has(row.stickerCode)) continue
    seenCodes.add(row.stickerCode)

    const teamId = row.stickerCode.slice(0, 3)
    if (!teams[teamId]) teams[teamId] = []
    teams[teamId].push(row)
  }

  for (const t of WC2026_TEAMS_BY_GROUP) {
    if (!teams[t.teamId]) orphans.push(`missing_team:${t.teamId}`)
  }

  for (const [teamId, players] of Object.entries(teams)) {
    if (!VALID_TEAM_IDS.has(teamId)) orphans.push(`unknown_team:${teamId}`)
    players.sort((a, b) => a.paniniSlot - b.paniniSlot)
    if (players.length < 15) orphans.push(`low_count:${teamId}=${players.length}`)
  }

  const payload: PaniniRostersFile = {
    source: 'panini_fifa_wc_2026',
    version: '2026-04',
    teams,
  }

  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  const teamCount = Object.keys(teams).length
  const playerCount = Object.values(teams).reduce((n, p) => n + p.length, 0)

  console.log('[parse:panini-checklist] input:', inputPath)
  console.log('[parse:panini-checklist] output:', outPath)
  console.log('[parse:panini-checklist] equipos:', teamCount, '/ 48')
  console.log('[parse:panini-checklist] jugadores:', playerCount)
  console.log('[parse:panini-checklist] líneas no parseadas (aprox.):', skippedLines)

  if (orphans.length > 0) {
    console.warn('[parse:panini-checklist] advertencias:')
    for (const o of orphans) console.warn('  ', o)
    process.exitCode = 1
  }
}

main()
